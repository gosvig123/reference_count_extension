import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandling';
import { ISymbolCollector, ISymbolProcessor } from '../interfaces/symbolInterfaces';
import { SUPPORTED_SYMBOL_KINDS, getDocumentSymbols, getSymbolReferences } from '../utils/symbolUtils';
import { categorizeReferences } from '../utils/utils';

/**
 * Responsible for collecting symbols from files
 */
export class SymbolCollector implements ISymbolCollector, ISymbolProcessor {
    // Current active file being processed
    public activeFile: vscode.Uri | null = null;
    
    // Maps to store symbols and their references for the active file
    public activeFileSymbolStore: Map<string, vscode.DocumentSymbol> = new Map();
    public activeFileSymbolReferences: Map<string, vscode.Location[]> = new Map();
    
    // Maps to store import references and usage references separately
    public activeFileImportReferences: Map<string, vscode.Location[]> = new Map();
    public activeFileUsageReferences: Map<string, vscode.Location[]> = new Map();

    /**
     * Get and store symbols for the active file
     */
    public async getAndSetSymbolsForActiveFile(documentUri: vscode.Uri, forceRefresh: boolean = false): Promise<void> {
        this.activeFile = documentUri;
        this.activeFileSymbolStore = new Map();
        this.activeFileSymbolReferences = new Map();
        this.activeFileImportReferences = new Map();
        this.activeFileUsageReferences = new Map();

        try {
            const symbols = await this.collectSymbols(documentUri);
            if (symbols.length === 0) return;

            // Process symbols and their children
            await this.processSymbols(symbols);
        } catch (error) {
            ErrorHandler.error(`Error getting symbols for ${documentUri.fsPath}`, error, 'SymbolCollector');
        }
    }

    /**
     * Collect symbols from a document URI
     */
    public async collectSymbols(documentUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
        try {
            return await getDocumentSymbols(documentUri);
        } catch (error) {
            ErrorHandler.error(`Error getting symbols for ${documentUri.fsPath}`, error, 'SymbolCollector');
            return [];
        }
    }

    /**
     * Process symbols recursively
     */
    public async processSymbols(symbolList: vscode.DocumentSymbol[]): Promise<void> {
        for (const symbol of symbolList) {
            // Only process supported symbol kinds
            if (SUPPORTED_SYMBOL_KINDS.includes(symbol.kind)) {
                // Add the symbol to the store
                this.addSymbol(symbol);

                // Get references for this symbol
                if (this.activeFile) {
                    const references = await getSymbolReferences(this.activeFile, symbol);
                    this.activeFileSymbolReferences.set(symbol.name, references);
                    
                    // Categorize references as imports or usage
                    try {
                        const { importReferences, usageReferences } = await categorizeReferences(references);
                        this.activeFileImportReferences.set(symbol.name, importReferences);
                        this.activeFileUsageReferences.set(symbol.name, usageReferences);
                    } catch (categorizationError) {
                        ErrorHandler.error(`Error categorizing references for ${symbol.name}`, categorizationError, 'SymbolCollector');
                        // Fallback to empty arrays for imports/usage if categorization fails
                        this.activeFileImportReferences.set(symbol.name, []);
                        this.activeFileUsageReferences.set(symbol.name, references); // Assume all are usage in case of error
                    }
                }
            }

            // Process children recursively only if this is a class
            if (symbol.kind === vscode.SymbolKind.Class && symbol.children && symbol.children.length > 0) {
                await this.processSymbols(symbol.children);
            }
        }
    }

    /**
     * Add a symbol to the active file store
     */
    private addSymbol(symbol: vscode.DocumentSymbol): void {
        if (this.activeFile) {
            this.activeFileSymbolStore.set(symbol.name, symbol);
        }
    }
}