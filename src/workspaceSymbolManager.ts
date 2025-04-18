import * as vscode from 'vscode';
import { configManager } from './config';
import {
    getDocumentSymbols,
    getSymbolReferences,
    collectSymbols,
    calculateReferenceCount,
    getSupportedFiles,
    isPositionInRange
} from './utils/symbolUtils';

/**
 * Interface for unused symbol information
 */
export interface UnusedSymbolInfo {
    symbol: vscode.DocumentSymbol;
    uri: vscode.Uri;
}

/**
 * Manages symbols across the workspace
 * Provides functionality for finding unused symbols
 */
class WorkspaceSymbolManager {
    // Map to store all symbols in the workspace
    private workspaceSymbols: Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> = new Map();

    /**
     * Get all symbols in the workspace
     */
    public async getWorkspaceSymbols(): Promise<Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }>> {
        console.log('Getting all workspace symbols...');

        try {
            // Get all supported files in the workspace
            const workspaceFiles = await getSupportedFiles(
                configManager.getSupportedFilesPattern(),
                configManager.getExcludePattern()
            );
            console.log(`Found ${workspaceFiles.length} supported files in workspace`);

            // Clear previous symbols
            this.workspaceSymbols.clear();

            // Process each file to collect symbols
            for (const fileUri of workspaceFiles) {
                try {
                    await this.processFile(fileUri);
                } catch (error) {
                    console.error(`Error processing file ${fileUri.fsPath}:`, error);
                }
            }

            console.log(`Collected symbols from ${this.workspaceSymbols.size} locations in the workspace`);
            return this.workspaceSymbols;
        } catch (error) {
            console.error('Error getting workspace symbols:', error);
            return new Map();
        }
    }

    /**
     * Get unused symbols in the workspace
     */
    public async getUnusedSymbols(): Promise<UnusedSymbolInfo[]> {
        console.log('Getting unused symbols...');

        // Make sure we have the latest symbols
        if (this.workspaceSymbols.size === 0) {
            console.log('No symbols in cache, fetching workspace symbols...');
            await this.getWorkspaceSymbols();
            console.log(`Fetched ${this.workspaceSymbols.size} symbols from workspace`);
        }

        const unusedSymbols: UnusedSymbolInfo[] = [];

        // Check each symbol for references
        for (const [_, symbolInfo] of this.workspaceSymbols) {
            const { symbol, uri } = symbolInfo;

            // Skip symbols without selectionRange (should not happen, but just in case)
            if (!symbol.selectionRange) {
                console.log(`Symbol ${symbol.name} has no selectionRange, skipping`);
                continue;
            }

            try {
                // Get all references including declaration
                const allReferences = await getSymbolReferences(uri, symbol, true) || [];
                console.log(`Symbol ${symbol.name} has ${allReferences.length} total references`);

                // Filter out the declaration itself
                const nonDeclarationRefs = allReferences.filter(ref => {
                    // Check if this reference is the declaration itself
                    const isDeclaration = ref.uri.fsPath === uri.fsPath &&
                        isPositionInRange(ref.range.start, symbol.range);
                    return !isDeclaration;
                });
                console.log(`Symbol ${symbol.name} has ${nonDeclarationRefs.length} non-declaration references`);

                // Calculate reference count
                const referenceCount = await this.calculateEffectiveReferenceCount(
                    nonDeclarationRefs,
                    symbol,
                    uri
                );
                console.log(`Symbol ${symbol.name} has effective reference count: ${referenceCount}`);

                // If no references, it's unused
                if (referenceCount <= 0) {
                    console.log(`Adding ${symbol.name} to unused symbols list`);
                    unusedSymbols.push({ symbol, uri });
                }
            } catch (error) {
                console.error(`Error analyzing symbol ${symbol.name}:`, error);
            }
        }

        console.log(`Found ${unusedSymbols.length} unused symbols out of ${this.workspaceSymbols.size} total symbols`);
        return unusedSymbols;
    }

    /**
     * Calculate the effective reference count for a symbol
     * Takes into account exports and special cases
     */
    private async calculateEffectiveReferenceCount(
        references: vscode.Location[],
        symbol: vscode.DocumentSymbol,
        uri: vscode.Uri
    ): Promise<number> {
        // Calculate basic reference count
        const basicReferenceCount = await calculateReferenceCount(
            references,
            configManager.excludePatterns,
            configManager.includeImports,
            symbol.range
        );

        // Check if the symbol is exported (likely used externally)
        const symbolText = symbol.detail || '';
        const isExported = symbolText.includes('export') ||
                          (uri.fsPath.includes('/api/') || uri.fsPath.includes('/pages/api/'));

        // For exported symbols with references, ensure a minimum count of 1
        if (isExported && references.length > 0 && basicReferenceCount === 0) {
            return 1;
        }

        return basicReferenceCount;
    }

    /**
     * Process a single file to extract symbols
     */
    private async processFile(fileUri: vscode.Uri): Promise<void> {
        console.log(`Processing file: ${fileUri.fsPath}`);

        try {
            // Try to open the document first to ensure it's loaded
            try {
                await vscode.workspace.openTextDocument(fileUri);
            } catch (docError) {
                console.warn(`Could not open document ${fileUri.fsPath}:`, docError);
                // Continue anyway, as getDocumentSymbols might still work
            }

            // Get symbols for the file
            const symbols = await getDocumentSymbols(fileUri);

            if (symbols.length === 0) {
                console.log(`No symbols found in ${fileUri.fsPath}`);
                return;
            }

            // Collect symbols and add them to the workspace symbols map
            const initialSize = this.workspaceSymbols.size;
            collectSymbols(symbols, fileUri, this.workspaceSymbols);
            const newSymbols = this.workspaceSymbols.size - initialSize;

            console.log(`Added ${newSymbols} symbols from ${fileUri.fsPath}`);
        } catch (error) {
            console.error(`Error processing file ${fileUri.fsPath}:`, error);
        }
    }

    /**
     * Update symbols for a specific file
     */
    public async updateFileSymbols(fileUri: vscode.Uri): Promise<void> {
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

// Export a singleton instance
export const workspaceSymbolManager = new WorkspaceSymbolManager();