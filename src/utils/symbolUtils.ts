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
 * Get symbols for a document
 */
export async function getDocumentSymbols(documentUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    try {
        // Try to ensure the document is loaded
        try {
            await vscode.workspace.openTextDocument(documentUri);
            // Just opening it is enough to ensure it's loaded for the symbol provider
        } catch (docError) {
            // Continue anyway
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

        if (!Array.isArray(symbols) || symbols.length === 0) {
            return [];
        }

        return symbols;
    } catch (error) {
        console.error(`Error getting symbols for ${documentUri.fsPath}:`, error);
        return [];
    }
}

/**
 * Get references for a symbol
 */
export async function getSymbolReferences(
    documentUri: vscode.Uri,
    symbol: vscode.DocumentSymbol,
    includeDeclaration: boolean = false
): Promise<vscode.Location[]> {
    try {
        const position = symbol.selectionRange.start;

        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            documentUri,
            position,
            { includeDeclaration }
        );

        return references || [];
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
    symbolMap: Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> = new Map(),
    isRecursiveCall: boolean = false
): Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> {
    symbolList.forEach(symbol => {
        // Only store supported symbol kinds
        if (SUPPORTED_SYMBOL_KINDS.includes(symbol.kind)) {
            const position = symbol.range.start;
            const key = `${uri.fsPath}:${symbol.name}:${position.line}:${position.character}`;

            // Check if we already have this symbol to avoid duplicates
            if (!symbolMap.has(key)) {
                symbolMap.set(key, { symbol, uri });
            }
        }

        // If it's a class with children, recurse (only process children of classes)
        if (symbol.kind === vscode.SymbolKind.Class && symbol.children && symbol.children.length > 0) {
            collectSymbols(symbol.children, uri, symbolMap, true);
        }
    });

    return symbolMap;
}

/**
 * Calculate reference count for a symbol
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

    // Calculate reference count based on settings
    let referenceCount = includeImports ? filteredReferences.length : usageReferences.length;

    // Check for self-references
    const selfReferenceCount = references.filter(ref =>
        ref.range.start.line === symbolRange.start.line
    ).length;

    // Deduct self-references from the count
    if (selfReferenceCount > 0) {
        referenceCount = Math.max(0, referenceCount - selfReferenceCount);
    }

    return referenceCount;
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
    return await vscode.workspace.findFiles(
        includePattern,
        excludePattern,
        1000
    );
}
