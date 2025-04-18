import * as vscode from 'vscode';
import { getDocumentSymbols, getSymbolReferences, SUPPORTED_SYMBOL_KINDS } from './utils/symbolUtils';

/**
 * Base class for symbol management
 * Provides core functionality for tracking symbols in a file
 */
export class SymbolManagerClass {
    // Current file being analyzed
    public activeFile: vscode.Uri | null = null;

    // Maps to store symbols and their references
    public activeFileSymbolStore: Map<string, vscode.DocumentSymbol> = new Map();
    public activeFileSymbolReferences: Map<string, vscode.Location[]> = new Map();

    constructor() {
        this.activeFile = null;
        this.activeFileSymbolStore = new Map();
        this.activeFileSymbolReferences = new Map();
    }

    /**
     * Get and store symbols for the active file
     */
    public async getAndSetSymbolsForActiveFile(documentUri: vscode.Uri): Promise<void> {
        this.activeFile = documentUri;
        this.activeFileSymbolStore = new Map();
        this.activeFileSymbolReferences = new Map();

        try {
            const symbols = await getDocumentSymbols(documentUri);
            if (symbols.length === 0) return;

            // Process symbols and their children
            await this.processSymbols(symbols);
        } catch (error) {
            console.error(`Error getting symbols for ${documentUri.fsPath}:`, error);
        }
    }

    /**
     * Process symbols recursively
     */
    private async processSymbols(symbolList: vscode.DocumentSymbol[]): Promise<void> {
        for (const symbol of symbolList) {
            // Only process supported symbol kinds
            if (SUPPORTED_SYMBOL_KINDS.includes(symbol.kind)) {
                // Add the symbol to the store
                this.addSymbol(symbol);

                // Get references for this symbol
                if (this.activeFile) {
                    const references = await getSymbolReferences(this.activeFile, symbol);
                    this.activeFileSymbolReferences.set(symbol.name, references);
                }
            }

            // Process children recursively only if this is a class
            if (symbol.kind === vscode.SymbolKind.Class && symbol.children && symbol.children.length > 0) {
                await this.processSymbols(symbol.children);
            }
        }
    }

    /**
     * Add a symbol to the store
     */
    protected addSymbol(symbol: vscode.DocumentSymbol): void {
        if (this.activeFile) {
            this.activeFileSymbolStore.set(symbol.name, symbol);
        }
    }
}
