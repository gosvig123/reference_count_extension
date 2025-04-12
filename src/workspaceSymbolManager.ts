import * as vscode from 'vscode';
import { filterReferences, categorizeReferences } from './utils/utils';

// Interface for unused symbol information
export interface UnusedSymbolInfo {
    symbol: vscode.DocumentSymbol;
    uri: vscode.Uri;
}

class WorkspaceSymbolManager {
    private workspaceSymbols: Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> = new Map();
    private config: vscode.WorkspaceConfiguration;
    private supportedFileExtensions: string[];
    private excludePatterns: string[];
    private includeImports: boolean;
    private readonly SUPPORTED_SYMBOL_KINDS = [
        vscode.SymbolKind.Function,
        vscode.SymbolKind.Method,
        vscode.SymbolKind.Class
    ];

    constructor() {
        this.config = vscode.workspace.getConfiguration('referenceCounter');
        this.supportedFileExtensions = this.config.get('fileExtensions', ['py', 'js', 'jsx', 'ts', 'tsx']);
        this.excludePatterns = this.config.get('excludePatterns', []);
        this.includeImports = this.config.get('includeImports', false);
    }

    /**
     * Get all workspace symbols
     */
    public async getWorkspaceSymbols() {
        const workspaceFiles = await this.getSupportedFiles();

        // Clear previous symbols
        this.workspaceSymbols.clear();

        for (const fileUri of workspaceFiles) {
            await this.processFile(fileUri);
        }

        return this.workspaceSymbols;
    }

    /**
     * Get unused symbols in the workspace
     */
    public async getUnusedSymbols(): Promise<UnusedSymbolInfo[]> {
        // Make sure we have the latest symbols if the map is empty
        if (this.workspaceSymbols.size === 0) {
            await this.getWorkspaceSymbols();
        }

        const unusedSymbols: UnusedSymbolInfo[] = [];

        // Check each symbol for references
        for (const [_, symbolInfo] of this.workspaceSymbols) {
            const { symbol, uri } = symbolInfo;

            // Only check supported symbol kinds
            if (!this.SUPPORTED_SYMBOL_KINDS.includes(symbol.kind)) {
                continue;
            }

            // Skip symbols without selectionRange (should not happen, but just in case)
            if (!symbol.selectionRange) {
                console.warn(`Symbol ${symbol.name} has no selectionRange, skipping`);
                continue;
            }

            // Get all references for this symbol (including declaration)
            try {
                // First, get all references including declaration
                const allReferences = await vscode.commands.executeCommand<vscode.Location[]>(
                    'vscode.executeReferenceProvider',
                    uri,
                    symbol.selectionRange.start,
                    { includeDeclaration: true }
                ) || [];

                // Filter out the declaration itself
                const nonDeclarationRefs = allReferences.filter(ref => {
                    // Check if this reference is the declaration itself
                    const isDeclaration = ref.uri.fsPath === uri.fsPath &&
                        this.isPositionInRange(ref.range.start, symbol.range);
                    return !isDeclaration;
                });

                // Filter references based on exclude patterns
                const filteredReferences = filterReferences(nonDeclarationRefs, this.excludePatterns);

                // Categorize references as imports or actual usage
                const { usageReferences } = await categorizeReferences(filteredReferences);

                // Check if the symbol is exported (likely used externally)
                const symbolText = symbol.detail || '';
                const isExported = symbolText.includes('export') ||
                                  (uri.fsPath.includes('/api/') || uri.fsPath.includes('/pages/api/'));

                // Calculate the actual reference count based on includeImports setting
                let referenceCount = this.includeImports
                    ? filteredReferences.length
                    : usageReferences.length;

                // For exported symbols in API routes, ensure a minimum count of 1 if there are any references
                if (isExported && filteredReferences.length > 0 && referenceCount === 0) {
                    referenceCount = 1;
                }

                // If no references after filtering and import handling, it's unused
                if (referenceCount <= 0) {
                    unusedSymbols.push({ symbol, uri });
                }
            } catch (error) {
                console.error(`Error getting references for ${symbol.name}:`, error);
            }
        }

        console.log(`Found ${unusedSymbols.length} unused symbols out of ${this.workspaceSymbols.size} total symbols`);
        return unusedSymbols;
    }

    /**
     * Check if a position is within a range
     */
    private isPositionInRange(position: vscode.Position, range: vscode.Range): boolean {
        return position.line >= range.start.line &&
               position.line <= range.end.line &&
               (position.line !== range.start.line || position.character >= range.start.character) &&
               (position.line !== range.end.line || position.character <= range.end.character);
    }

    /**
     * Process a single file to extract symbols
     */
    private async processFile(fileUri: vscode.Uri) {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[] | vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                fileUri
            );

            if (Array.isArray(symbols)) {
                this.processSymbols(symbols, fileUri);
            }
        } catch (error) {
            console.error(`Error getting symbols for ${fileUri.fsPath}:`, error);
        }
    }

    /**
     * Process symbols recursively
     */
    private processSymbols(
        symbolList: (vscode.SymbolInformation | vscode.DocumentSymbol)[],
        uri: vscode.Uri
    ) {
        symbolList.forEach(symbol => {
            // Only store supported symbol kinds
            if (this.SUPPORTED_SYMBOL_KINDS.includes(symbol.kind)) {
                // Get the position from either range or location (depending on symbol type)
                let position: vscode.Position;
                if ('range' in symbol) {
                    position = symbol.range.start;
                } else if ('location' in symbol) {
                    position = symbol.location.range.start;
                } else {
                    return; // Skip if we can't get a position
                }

                const key = `${uri.fsPath}:${symbol.name}:${position.line}`;
                this.workspaceSymbols.set(key, {
                    symbol: symbol as vscode.DocumentSymbol,
                    uri
                });
            }

            // If it's a class with children, recurse (only process children of classes)
            if (symbol.kind === vscode.SymbolKind.Class && 'children' in symbol && symbol.children) {
                this.processSymbols(symbol.children, uri);
            }
        });
    }

    /**
     * Get supported files in the workspace
     */
    public async getSupportedFiles() {
        // Create include pattern from file extensions
        const includePattern = `**/*.{${this.supportedFileExtensions.join(',')}}`;

        // Create exclude pattern from exclude patterns
        const excludePattern = this.excludePatterns.length > 0
            ? `{${this.excludePatterns.map(p => `**/${p}/**`).join(',')}}`
            : null;

        const files = await vscode.workspace.findFiles(
            includePattern,
            excludePattern,
            1000
        );

        return files;
    }

    /**
     * Update symbols for a specific file
     */
    public async updateFileSymbols(fileUri: vscode.Uri) {
        // Remove existing symbols for this file
        for (const [key, value] of this.workspaceSymbols.entries()) {
            if (value.uri.fsPath === fileUri.fsPath) {
                this.workspaceSymbols.delete(key);
            }
        }

        // Process the file again
        await this.processFile(fileUri);
    }
}

export const workspaceSymbolManager = new WorkspaceSymbolManager();