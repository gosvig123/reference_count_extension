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
import { ProgressReporter } from './utils/progressUtils';

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

    // Cache for reference counts to avoid duplicate calculations
    private referenceCountCache: Map<string, number> = new Map();

    /**
     * Get all symbols in the workspace with progress reporting
     */
    public async getWorkspaceSymbols(reporter?: ProgressReporter): Promise<Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }>> {
        try {
            // Get all supported files in the workspace
            const workspaceFiles = await getSupportedFiles(
                configManager.getSupportedFilesPattern(),
                configManager.getExcludePattern()
            );

            // Update total items if we have a reporter
            if (reporter) {
                reporter.setTotalItems(workspaceFiles.length);
            }

            // Clear previous symbols and cache
            this.workspaceSymbols.clear();
            this.referenceCountCache.clear();

            // Process each file to collect symbols
            for (const fileUri of workspaceFiles) {
                // Check for cancellation
                if (reporter?.isCancelled()) {
                    break;
                }

                try {
                    await this.processFile(fileUri);

                    // Report progress
                    if (reporter) {
                        reporter.report(`Processed ${fileUri.path.split('/').pop()}`);
                    }
                } catch (error) {
                    console.error(`Error processing file ${fileUri.fsPath}:`, error);
                }
            }

            return this.workspaceSymbols;
        } catch (error) {
            console.error('Error getting workspace symbols:', error);
            return new Map();
        }
    }

    /**
     * Get unused symbols in the workspace with progress reporting
     */
    public async getUnusedSymbols(reporter?: ProgressReporter): Promise<UnusedSymbolInfo[]> {
        // Make sure we have the latest symbols
        if (this.workspaceSymbols.size === 0) {
            // If we don't have a reporter, create one for the symbol collection phase
            await this.getWorkspaceSymbols(reporter);
        }

        const unusedSymbols: UnusedSymbolInfo[] = [];
        const symbolEntries = Array.from(this.workspaceSymbols.entries());

        // Update total items if we have a reporter
        if (reporter) {
            reporter.setTotalItems(symbolEntries.length);
        }

        // Check each symbol for references
        for (let i = 0; i < symbolEntries.length; i++) {
            // Check for cancellation
            if (reporter?.isCancelled()) {
                break;
            }

            const [key, symbolInfo] = symbolEntries[i];
            const { symbol, uri } = symbolInfo;

            // Skip symbols without selectionRange (should not happen, but just in case)
            if (!symbol.selectionRange) {
                continue;
            }

            try {
                // Check if we already have a cached reference count
                if (!this.referenceCountCache.has(key)) {
                    // Get all references including declaration
                    const allReferences = await getSymbolReferences(uri, symbol, true) || [];

                    // Filter out the declaration itself
                    const nonDeclarationRefs = allReferences.filter(ref => {
                        // Check if this reference is the declaration itself
                        const isDeclaration = ref.uri.fsPath === uri.fsPath &&
                            isPositionInRange(ref.range.start, symbol.range);
                        return !isDeclaration;
                    });

                    // Calculate reference count and cache it
                    const referenceCount = await this.calculateEffectiveReferenceCount(
                        nonDeclarationRefs,
                        symbol,
                        uri
                    );
                    this.referenceCountCache.set(key, referenceCount);
                }

                // Get the reference count from cache
                const referenceCount = this.referenceCountCache.get(key) || 0;

                // If no references, it's unused
                if (referenceCount <= 0) {
                    unusedSymbols.push({ symbol, uri });
                }

                // Report progress
                if (reporter) {
                    reporter.report(`Analyzing ${symbol.name}`);
                }
            } catch (error) {
                console.error(`Error analyzing symbol ${symbol.name}:`, error);
            }
        }

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
        try {
            // Try to open the document first to ensure it's loaded
            try {
                await vscode.workspace.openTextDocument(fileUri);
            } catch (docError) {
                // Continue anyway, as getDocumentSymbols might still work
            }

            // Get symbols for the file
            const symbols = await getDocumentSymbols(fileUri);

            if (symbols.length === 0) {
                return;
            }

            // Collect symbols and add them to the workspace symbols map
            collectSymbols(symbols, fileUri, this.workspaceSymbols);
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