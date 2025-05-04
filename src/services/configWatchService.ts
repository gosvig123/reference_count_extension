import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandling';
import { configManager, IExtensionConfig } from '../config';
import { IWorkspaceSymbolManager, IDecorationManager } from '../interfaces/symbolInterfaces';

/**
 * Service that watches for configuration changes
 */
export class ConfigWatchService {
    private workspaceSymbolManager: IWorkspaceSymbolManager;
    private decorationManager: IDecorationManager;
    private disposables: vscode.Disposable[] = [];

    constructor(workspaceSymbolManager: IWorkspaceSymbolManager, decorationManager: IDecorationManager) {
        this.workspaceSymbolManager = workspaceSymbolManager;
        this.decorationManager = decorationManager;
    }

    /**
     * Initialize the configuration watch service
     */
    public initialize(context: vscode.ExtensionContext): void {
        try {
            // Add a listener for configuration changes
            const disposable = configManager.onConfigChanged(
                async (newConfig) => await this.handleConfigChange(newConfig)
            );
            
            this.disposables.push(disposable);
            context.subscriptions.push(disposable);
            
            ErrorHandler.info('Configuration watch service initialized', 'ConfigWatchService');
        } catch (error) {
            ErrorHandler.error('Failed to initialize configuration watch service', error, 'ConfigWatchService');
        }
    }

    /**
     * Handle configuration changes
     */
    private async handleConfigChange(newConfig: IExtensionConfig & { _importSettingChanged?: boolean }): Promise<void> {
        try {
            // Check if the imports setting changed, which requires special handling
            const importSettingChanged = newConfig._importSettingChanged === true;
            
            // Clear caches when configuration changes
            this.workspaceSymbolManager.clearCaches();
            
            // If the active editor exists, update decorations with new config
            if (vscode.window.activeTextEditor) {
                // If the import setting changed, force a refresh of symbols
                // to recategorize imports and usages
                if (importSettingChanged) {
                    console.log('[ReferenceCounter Debug] Import setting changed, forcing symbol refresh');
                    ErrorHandler.info('Import setting changed, forcing symbol refresh', 'ConfigWatchService');
                    // Force a refresh by passing true as the second parameter
                    await this.decorationManager.updateDecorations(vscode.window.activeTextEditor, true);
                } else {
                    await this.decorationManager.updateDecorations(vscode.window.activeTextEditor);
                }
            }
            
            ErrorHandler.info('Applied configuration changes', 'ConfigWatchService');
        } catch (error) {
            ErrorHandler.error('Error handling configuration change', error, 'ConfigWatchService');
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                ErrorHandler.error('Error disposing config watch service', error, 'ConfigWatchService');
            }
        }
    }
}