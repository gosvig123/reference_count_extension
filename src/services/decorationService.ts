import * as vscode from 'vscode';
import { ErrorHandler } from '../utils/errorHandling';
import { IDecorationManager } from '../interfaces/symbolInterfaces';

/**
 * Service that manages decorations in the editor
 */
export class DecorationService {
    private decorationManager: IDecorationManager;
    private disposables: vscode.Disposable[] = [];

    constructor(decorationManager: IDecorationManager) {
        this.decorationManager = decorationManager;
    }

    /**
     * Initialize the decoration service
     */
    public initialize(context: vscode.ExtensionContext): void {
        try {
            // Apply decorations to the currently active editor, if any
            if (vscode.window.activeTextEditor) {
                this.decorationManager.updateDecorations(vscode.window.activeTextEditor);
            }

            // Register listener to update decorations when the active editor changes
            const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.decorationManager.updateDecorations(editor);
                }
            });

            this.disposables.push(disposable);
            context.subscriptions.push(disposable);

            ErrorHandler.info('Decoration service initialized', 'DecorationService');
        } catch (error) {
            ErrorHandler.error('Failed to initialize decoration service', error, 'DecorationService');
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
                ErrorHandler.error('Error disposing decoration service', error, 'DecorationService');
            }
        }

        // Dispose the decoration manager
        this.decorationManager.dispose();
    }
}