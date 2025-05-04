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
    private async handleConfigChange(newConfig: IExtensionConfig): Promise<void> {
        try {
            // Clear caches when configuration changes
            this.workspaceSymbolManager.clearCaches();
            
            // If the active editor exists, update decorations with new config
            if (vscode.window.activeTextEditor) {
                this.decorationManager.updateDecorations(vscode.window.activeTextEditor);
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