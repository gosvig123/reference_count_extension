import * as vscode from 'vscode';
import { configManager } from '../config';
import { ErrorHandler } from '../utils/errorHandling';
import { IDecorationManager } from '../interfaces/symbolInterfaces';
import { SymbolCollector } from './symbolCollector';
import { calculateReferenceCount } from '../utils/symbolUtils';

/**
 * Manages decorations for symbols in the editor
 */
export class DecorationManager implements IDecorationManager {
    // Decoration type for displaying reference counts
    public decorationType: vscode.TextEditorDecorationType;
    public decorationUpdateTimeout: NodeJS.Timeout | undefined;
    private readonly DEBOUNCE_DELAY = 500; // ms

    private symbolCollector: SymbolCollector;

    /**
     * Initialize the decoration manager with a symbol collector
     */
    constructor(symbolCollector: SymbolCollector) {
        this.symbolCollector = symbolCollector;

        // Create decoration type based on configuration
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: configManager.minimalisticDecorations ? '0' : '0 0 0 0.5em',
                textDecoration: 'none',
            },
        });
    }

    /**
     * Check if the active file is supported for reference counting
     */
    public isActiveFileSupported(): boolean {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return false;

        return configManager.isFileSupported(activeEditor.document.uri);
    }

    /**
     * Update decorations for the editor with debouncing
     * @param editor The text editor to update decorations for
     * @param forceImmediate Optional flag to force immediate update (skip debouncing)
     */
    public async updateDecorations(editor: vscode.TextEditor, forceImmediate: boolean = false): Promise<void> {
        // Clear any pending update
        if (this.decorationUpdateTimeout) {
            clearTimeout(this.decorationUpdateTimeout);
        }

        if (forceImmediate) {
            // Perform update immediately if force flag is set
            await this.performDecorationsUpdate(editor);
        } else {
            // Schedule new update with debouncing
            this.decorationUpdateTimeout = setTimeout(async () => {
                await this.performDecorationsUpdate(editor);
            }, this.DEBOUNCE_DELAY);
        }
    }

    /**
     * Perform the actual decoration update
     */
    private async performDecorationsUpdate(editor: vscode.TextEditor): Promise<void> {
        try {
            if (!this.isActiveFileSupported()) {
                return;
            }

            // Get symbols for the active file
            await this.symbolCollector.getAndSetSymbolsForActiveFile(editor.document.uri, false);

            // If no symbols were found, exit early
            if (this.symbolCollector.activeFileSymbolStore.size === 0) {
                return;
            }

            // Create decorations for each symbol
            const decorations = await this.createDecorations(editor);

            // Apply decorations to the editor
            editor.setDecorations(this.decorationType, decorations);
        } catch (error) {
            ErrorHandler.error('Error in performDecorationsUpdate', error, 'DecorationManager');
            // Don't rethrow - we want to silently fail for binary files
        }
    }

    /**
     * Create decorations for all symbols in the active file
     */
    private async createDecorations(editor: vscode.TextEditor): Promise<vscode.DecorationOptions[]> {
        try {
            // Process each symbol and create a decoration
            const decorationPromises = Array.from(this.symbolCollector.activeFileSymbolStore.values())
                .map(symbol => this.createDecorationForSymbol(editor.document.uri, symbol));

            // Wait for all decorations to be created
            const decorations = await Promise.all(decorationPromises);

            // Filter out null decorations
            return decorations.filter(Boolean) as vscode.DecorationOptions[];
        } catch (error) {
            ErrorHandler.error('Error creating decorations', error, 'DecorationManager');
            return [];
        }
    }

    /**
     * Create a decoration for a single symbol
     */
    private async createDecorationForSymbol(
        documentUri: vscode.Uri,
        symbol: vscode.DocumentSymbol
    ): Promise<vscode.DecorationOptions | null> {
        try {
            // Get references for this symbol
            const references = this.symbolCollector.activeFileSymbolReferences.get(symbol.name) || [];
            if (references.length === 0) return null;

            // Calculate reference count
            const referenceCount = await calculateReferenceCount(
                references,
                configManager.excludePatterns,
                configManager.includeImports,
                symbol.range
            );

            // Create decoration
            return this.createDecoration(referenceCount, symbol.range.start);
        } catch (error) {
            ErrorHandler.error(`Error creating decoration for symbol ${symbol.name}`, error, 'DecorationManager');
            return null;
        }
    }

    /**
     * Create a decoration for showing reference count
     */
    private createDecoration(
        refCount: number,
        rangeStart: vscode.Position
    ): vscode.DecorationOptions {
        const displayText = refCount > 0 || configManager.minimalisticDecorations ? `(${refCount})` : 'No references';
        const textColor = refCount > 0 ? 'gray' : 'red';

        // Create a position that's guaranteed to be within the document
        const decorationPosition = new vscode.Position(
            Math.max(0, rangeStart.line),
            rangeStart.character
        );

        // Create a zero-width range at the calculated position
        const range = new vscode.Range(decorationPosition, decorationPosition);

        return {
            range,
            renderOptions: {
                after: {
                    contentText: displayText,
                    color: textColor,
                    margin: '0 0 0 1em' // Add some margin to prevent overlap
                },
            },
        };
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        if (this.decorationType) {
            this.decorationType.dispose();
        }

        if (this.decorationUpdateTimeout) {
            clearTimeout(this.decorationUpdateTimeout);
        }
    }
}