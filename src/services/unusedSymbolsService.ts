import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandling';
import { IWorkspaceSymbolManager, UnusedSymbolInfo } from '../interfaces/symbolInterfaces';
import { UnusedSymbolsProvider } from '../views/unusedSymbolsView';
import { withProgress } from '../utils/progressUtils';

// Constants for IDs used within the extension
export const FIND_UNUSED_SYMBOLS_COMMAND_ID = 'referenceCounter.findUnusedSymbols';
export const UNUSED_SYMBOLS_VIEW_ID = 'referenceCounter.unusedSymbols';

/**
 * Service for managing unused symbols functionality
 */
export class UnusedSymbolsService {
    private workspaceSymbolManager: IWorkspaceSymbolManager;
    private unusedSymbolsProvider: UnusedSymbolsProvider;
    private unusedSymbolsView: vscode.TreeView<any> | undefined;
    private findUnusedSymbolsCommand: vscode.Disposable | undefined;

    constructor(workspaceSymbolManager: IWorkspaceSymbolManager) {
        this.workspaceSymbolManager = workspaceSymbolManager;
        this.unusedSymbolsProvider = new UnusedSymbolsProvider();
    }

    /**
     * Initialize the service and register commands and views
     */
    public initialize(): vscode.Disposable[] {
        try {
            const disposables: vscode.Disposable[] = [];

            // Create the tree view
            this.unusedSymbolsView = vscode.window.createTreeView(UNUSED_SYMBOLS_VIEW_ID, {
                treeDataProvider: this.unusedSymbolsProvider,
                showCollapseAll: true
            });
            disposables.push(this.unusedSymbolsView);

            // Register the command to find unused symbols
            this.findUnusedSymbolsCommand = vscode.commands.registerCommand(
                FIND_UNUSED_SYMBOLS_COMMAND_ID, 
                async () => await this.findUnusedSymbols()
            );
            disposables.push(this.findUnusedSymbolsCommand);

            ErrorHandler.info('Unused symbols service initialized', 'UnusedSymbolsService');
            return disposables;
        } catch (error) {
            ErrorHandler.critical('Failed to initialize unused symbols service', error, 'UnusedSymbolsService');
            return [];
        }
    }

    /**
     * Find unused symbols in the workspace with progress reporting
     */
    private async findUnusedSymbols(): Promise<UnusedSymbolInfo[]> {
        return await ErrorHandler.tryExecution(
            async () => {
                // Use our enhanced progress reporting
                return await withProgress(
                    'Scanning for unused symbols',
                    100, // Initial estimate, will be updated during scan
                    async (reporter) => {
                        // First phase: Collect all symbols from the workspace
                        await this.workspaceSymbolManager.getWorkspaceSymbols(reporter);

                        // Second phase: Analyze symbols for references
                        const unusedSymbols = await this.workspaceSymbolManager.getUnusedSymbols(reporter);

                        // Refresh the tree view with the results
                        this.unusedSymbolsProvider.refresh(unusedSymbols);

                        // Show a status message with the results
                        vscode.window.setStatusBarMessage(
                            `Found ${unusedSymbols.length} unused symbols`,
                            5000
                        );

                        return unusedSymbols;
                    }
                );
            },
            'Failed to scan for unused symbols',
            'UnusedSymbolsService',
            true,  // Show error to user
            []     // Default value (empty array)
        );
    }
}