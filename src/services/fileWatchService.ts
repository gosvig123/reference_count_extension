import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandling';
import { configManager } from '../config';
import { IWorkspaceSymbolManager, IDecorationManager } from '../interfaces/symbolInterfaces';
import { clearImportLineCache } from '../utils/utils';

/**
 * Service that watches for file changes in the workspace
 */
export class FileWatchService {
    private workspaceSymbolManager: IWorkspaceSymbolManager;
    private decorationManager: IDecorationManager;
    private disposables: vscode.Disposable[] = [];

    constructor(workspaceSymbolManager: IWorkspaceSymbolManager, decorationManager: IDecorationManager) {
        this.workspaceSymbolManager = workspaceSymbolManager;
        this.decorationManager = decorationManager;
    }

    /**
     * Initialize the file watch service
     */
    public initialize(context: vscode.ExtensionContext): void {
        try {
            // Register listener for when a text document is saved
            const disposable = vscode.workspace.onDidSaveTextDocument(
                async (document) => await this.handleDocumentSave(document)
            );
            
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);

            ErrorHandler.info('File watch service initialized', 'FileWatchService');
        } catch (error) {
            ErrorHandler.error('Failed to initialize file watch service', error, 'FileWatchService');
        }
    }

    /**
     * Handle document save events
     */
    private async handleDocumentSave(document: vscode.TextDocument): Promise<void> {
        await ErrorHandler.tryExecution(
            async () => {
                // Check if the saved file is supported
                if (configManager.isFileSupported(document.uri)) {
                    // Clear the import line cache for this file to ensure we detect any import changes
                    clearImportLineCache();
                    
                    // Update the symbols for the saved file
                    await this.workspaceSymbolManager.updateFileSymbols(document.uri);

                    // If the saved document is the currently active editor, update its decorations
                    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === document) {
                        this.decorationManager.updateDecorations(vscode.window.activeTextEditor, true);
                    }
                }
            },
            `Failed to update symbols for file: ${document.uri.fsPath}`,
            'FileWatchService'
        );
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                ErrorHandler.error('Error disposing file watch service', error, 'FileWatchService');
            }
        }
    }
}