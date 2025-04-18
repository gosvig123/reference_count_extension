import * as vscode from 'vscode';
import { SymbolManagerClass } from './symbolManager';
import { decorateFile } from './decorateFile';
import { configManager } from './config';
import { calculateReferenceCount, getSymbolReferences } from './utils/symbolUtils';

/**
 * Handles reference counting and decoration for the active file
 */
class FileRefCounterClass extends SymbolManagerClass {
    // Decoration properties
    public decorationType: vscode.TextEditorDecorationType;
    public decorationUpdateTimeout: NodeJS.Timeout | undefined;
    private readonly DEBOUNCE_DELAY = 500; // ms

    constructor() {
        super();

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
     */
    public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
        // Clear any pending update
        if (this.decorationUpdateTimeout) {
            clearTimeout(this.decorationUpdateTimeout);
        }

        // Schedule new update with debouncing
        this.decorationUpdateTimeout = setTimeout(async () => {
            await this.performDecorationsUpdate(editor);
        }, this.DEBOUNCE_DELAY);
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
            await this.getAndSetSymbolsForActiveFile(editor.document.uri);

            // If no symbols were found, exit early
            if (this.activeFileSymbolStore.size === 0) {
                return;
            }

            // Create decorations for each symbol
            const decorations = await this.createDecorations(editor);

            // Apply decorations to the editor
            editor.setDecorations(this.decorationType, decorations);
        } catch (error) {
            console.error('Error in performDecorationsUpdate:', error);
            // Don't rethrow - we want to silently fail for binary files
        }
    }

    /**
     * Create decorations for all symbols in the active file
     */
    private async createDecorations(editor: vscode.TextEditor): Promise<vscode.DecorationOptions[]> {
        try {
            // Process each symbol and create a decoration
            const decorationPromises = Array.from(this.activeFileSymbolStore.values())
                .map(symbol => this.createDecorationForSymbol(editor.document.uri, symbol));

            // Wait for all decorations to be created
            const decorations = await Promise.all(decorationPromises);

            // Filter out null decorations
            return decorations.filter(Boolean) as vscode.DecorationOptions[];
        } catch (error) {
            console.error('Error creating decorations:', error);
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
            const references = await getSymbolReferences(documentUri, symbol);
            if (references.length === 0) return null;

            // Calculate reference count
            const referenceCount = await calculateReferenceCount(
                references,
                configManager.excludePatterns,
                configManager.includeImports,
                symbol.range
            );

            // Create decoration
            return decorateFile(referenceCount, symbol.range.start, configManager.minimalisticDecorations);
        } catch (error) {
            console.error(`Error creating decoration for symbol ${symbol.name}:`, error);
            return null;
        }
    }
}

// Export a singleton instance
export const fileRefCounter = new FileRefCounterClass();
