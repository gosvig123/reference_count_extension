import * as vscode from 'vscode';
import { filterReferences, categorizeReferences } from './utils';

/**
 * Supported symbol kinds for reference counting and unused symbol detection
 */
export const SUPPORTED_SYMBOL_KINDS = [
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Method,
    vscode.SymbolKind.Class
];

/**
 * Get symbols for a document with retry mechanism
 */
export async function getDocumentSymbols(documentUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    try {
        // Try to ensure the document is loaded
        try {
            await vscode.workspace.openTextDocument(documentUri);
        } catch (docError) {
            // Continue anyway - the symbol provider might still work without it
        }

        // Try up to 3 times with a small delay between attempts
        // This helps with language servers that might not be ready immediately
        let symbols: vscode.DocumentSymbol[] | undefined;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts && (!symbols || !Array.isArray(symbols) || symbols.length === 0)) {
            attempts++;

            try {
                symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    documentUri
                );

                if (!Array.isArray(symbols) || symbols.length === 0) {
                    if (attempts < maxAttempts) {
                        // Wait a bit before trying again
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            } catch (symbolError) {
                if (attempts < maxAttempts) {
                    // Wait a bit before trying again
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }

        return Array.isArray(symbols) ? symbols : [];
    } catch (error) {
        console.error(`Error getting symbols for ${documentUri.fsPath}:`, error);
        return [];
    }
}

/**
 * Get references for a symbol with improved error handling
 */
export async function getSymbolReferences(
    documentUri: vscode.Uri,
    symbol: vscode.DocumentSymbol,
    includeDeclaration: boolean = false
): Promise<vscode.Location[]> {
    try {
        if (!symbol.selectionRange) {
            console.warn(`Symbol ${symbol.name} has no selection range`);
            return [];
        }

        const position = symbol.selectionRange.start;

        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            documentUri,
            position,
            { includeDeclaration }
        );

        return Array.isArray(references) ? references : [];
    } catch (error) {
        console.error(`Error getting references for symbol ${symbol.name}:`, error);
        return [];
    }
}

/**
 * Process symbols recursively, collecting supported symbols
 */
export function collectSymbols(
    symbolList: vscode.DocumentSymbol[],
    uri: vscode.Uri,
    symbolMap: Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> = new Map()
): Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> {
    for (const symbol of symbolList) {
        // Only store supported symbol kinds
        if (SUPPORTED_SYMBOL_KINDS.includes(symbol.kind)) {
            const key = generateSymbolKey(uri, symbol);

            // Check if we already have this symbol to avoid duplicates
            if (!symbolMap.has(key)) {
                symbolMap.set(key, { symbol, uri });
            }
        }

        // If it's a class with children, recurse
        if (symbol.kind === vscode.SymbolKind.Class && symbol.children && symbol.children.length > 0) {
            collectSymbols(symbol.children, uri, symbolMap);
        }
    }

    return symbolMap;
}

/**
 * Generate a unique key for a symbol based on its location
 */
export function generateSymbolKey(uri: vscode.Uri, symbol: vscode.DocumentSymbol): string {
    const position = symbol.range.start;
    return `${uri.fsPath}:${symbol.name}:${position.line}:${position.character}`;
}

/**
 * Groups references by file path
 */
function groupReferencesByFile(references: vscode.Location[]): Map<string, vscode.Location[]> {
    const referencesByFile = new Map<string, vscode.Location[]>();

    for (const ref of references) {
        const filePath = ref.uri.fsPath;
        if (!referencesByFile.has(filePath)) {
            referencesByFile.set(filePath, []);
        }
        referencesByFile.get(filePath)!.push(ref);
    }

    return referencesByFile;
}

/**
 * Counts references in the same file as the symbol definition
 */
function countSameFileReferences(
    fileRefs: vscode.Location[],
    symbolRange: vscode.Range
): number {
    // Count self-references (references contained within the symbol's definition range)
    const selfReferences = fileRefs.filter(ref => symbolRange.contains(ref.range));

    // If there are any non-self references in the same file, count them
    if (fileRefs.length > selfReferences.length) {
        return fileRefs.length - selfReferences.length;
    } else {
        // If all references in this file are self-references, count at least 1
        // This ensures functions used only within their own definition are counted
        return 1;
    }
}

/**
 * Calculate reference count for a symbol, excluding self-references
 */
export async function calculateReferenceCount(
    references: vscode.Location[],
    excludePatterns: string[],
    includeImports: boolean,
    symbolRange: vscode.Range
): Promise<number> {
    // Filter references based on exclude patterns
    const filteredReferences = filterReferences(references, excludePatterns);

    // Categorize references as imports or actual usage
    const { usageReferences } = await categorizeReferences(filteredReferences);

    // Determine which references to count based on settings
    const relevantReferences = includeImports ? filteredReferences : usageReferences;

    // Group references by file to handle same-file references properly
    const referencesByFile = groupReferencesByFile(relevantReferences);

    // Count references, handling self-references appropriately
    let totalCount = 0;

    // Get the file path from one of the references to compare with
    const symbolFilePath = references.length > 0 ? references[0].uri.fsPath : '';

    for (const [filePath, fileRefs] of referencesByFile.entries()) {
        // For references in the same file as the symbol definition
        if (filePath === symbolFilePath) {
            totalCount += countSameFileReferences(fileRefs, symbolRange);
        } else {
            // For references in other files, count all of them
            totalCount += fileRefs.length;
        }
    }

    return totalCount;
}

/**
 * Check if a position is within a range
 */
export function isPositionInRange(position: vscode.Position, range: vscode.Range): boolean {
    return position.line >= range.start.line &&
           position.line <= range.end.line &&
           (position.line !== range.start.line || position.character >= range.start.character) &&
           (position.line !== range.end.line || position.character <= range.end.character);
}

/**
 * Get all supported files in the workspace
 */
export async function getSupportedFiles(includePattern: string, excludePattern: string | null): Promise<vscode.Uri[]> {
    try {
        return await vscode.workspace.findFiles(
            includePattern,
            excludePattern || undefined,
            1000
        );
    } catch (error) {
        console.error(`Error finding files with pattern ${includePattern}:`, error);
        return [];
    }
}