import * as vscode from 'vscode';
import { configManager } from '../config';
import { ErrorHandler } from '../utils/errorHandling';
import { IWorkspaceSymbolManager, UnusedSymbolInfo } from '../interfaces/symbolInterfaces';
import { SymbolCollector } from './symbolCollector';
import { 
    collectSymbols, 
    isPositionInRange,
    calculateReferenceCount,
    getSupportedFiles,
    getSymbolReferences,
} from '../utils/symbolUtils';
import { ProgressReporter } from '../utils/progressUtils';

/**
 * Manages workspace-level symbol operations
 */
export class WorkspaceSymbolManager implements IWorkspaceSymbolManager {
    // Workspace-level symbol storage
    private workspaceSymbols: Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }> = new Map();
    
    // Cache for reference counts to avoid duplicate calculations
    private referenceCountCache: Map<string, number> = new Map();
    
    private symbolCollector: SymbolCollector;

    /**
     * Initialize with a symbol collector
     */
    constructor(symbolCollector: SymbolCollector) {
        this.symbolCollector = symbolCollector;
    }

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
                    await this.processWorkspaceFile(fileUri);

                    // Report progress
                    if (reporter) {
                        reporter.report(`Processed ${fileUri.path.split('/').pop()}`);
                    }
                } catch (error) {
                    ErrorHandler.error(`Error processing file ${fileUri.fsPath}`, error, 'WorkspaceSymbolManager');
                }
            }

            return this.workspaceSymbols;
        } catch (error) {
            ErrorHandler.error('Error getting workspace symbols', error, 'WorkspaceSymbolManager');
            return new Map();
        }
    }

    /**
     * Process a single file in the workspace to extract symbols
     */
    private async processWorkspaceFile(fileUri: vscode.Uri): Promise<void> {
        try {
            // Try to open the document first to ensure it's loaded
            try {
                await vscode.workspace.openTextDocument(fileUri);
            } catch (docError) {
                // Continue anyway, as getDocumentSymbols might still work
            }

            // Get symbols for the file
            const symbols = await this.symbolCollector.collectSymbols(fileUri);

            if (symbols.length === 0) {
                return;
            }

            // Collect symbols and add them to the workspace symbols map
            collectSymbols(symbols, fileUri, this.workspaceSymbols);
        } catch (error) {
            ErrorHandler.error(`Error processing file ${fileUri.fsPath}`, error, 'WorkspaceSymbolManager');
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
                ErrorHandler.error(`Error analyzing symbol ${symbol.name}`, error, 'WorkspaceSymbolManager');
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
     * Update symbols for a specific file
     */
    public async updateFileSymbols(fileUri: vscode.Uri): Promise<void> {
        // Remove existing symbols for this file
        for (const [key, value] of this.workspaceSymbols.entries()) {
            if (value.uri.fsPath === fileUri.fsPath) {
                this.workspaceSymbols.delete(key);
                // Also clear the reference count cache for this symbol
                this.referenceCountCache.delete(key);
            }
        }

        // Process the file again
        await this.processWorkspaceFile(fileUri);
        
        // If this is the active file, update the active file symbols too
        if (this.symbolCollector.activeFile && this.symbolCollector.activeFile.fsPath === fileUri.fsPath) {
            await this.symbolCollector.getAndSetSymbolsForActiveFile(fileUri);
        }
    }

    /**
     * Clear all caches
     */
    public clearCaches(): void {
        this.referenceCountCache.clear();
    }
}