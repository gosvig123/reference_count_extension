import * as vscode from 'vscode';
import { ISymbolManager, UnusedSymbolInfo } from '../interfaces/symbolInterfaces';
import { SymbolCollector } from './symbolCollector';
import { DecorationManager } from './decorationManager';
import { WorkspaceSymbolManager } from './workspaceSymbolManager';
import { ProgressReporter } from '../utils/progressUtils';

/**
 * Unified symbol manager that delegates to specialized classes
 * Acts as a facade for the underlying components
 */
export class SymbolManager implements ISymbolManager {
    // Components that handle specific responsibilities
    private symbolCollector: SymbolCollector;
    private decorationManager: DecorationManager;
    private workspaceSymbolManager: WorkspaceSymbolManager;

    constructor() {
        // Create the components in the right order (dependencies first)
        this.symbolCollector = new SymbolCollector();
        this.decorationManager = new DecorationManager(this.symbolCollector);
        this.workspaceSymbolManager = new WorkspaceSymbolManager(this.symbolCollector);
    }

    // Properties delegated to the symbol collector
    public get activeFile(): vscode.Uri | null {
        return this.symbolCollector.activeFile;
    }

    public get activeFileSymbolStore(): Map<string, vscode.DocumentSymbol> {
        return this.symbolCollector.activeFileSymbolStore;
    }

    public get activeFileSymbolReferences(): Map<string, vscode.Location[]> {
        return this.symbolCollector.activeFileSymbolReferences;
    }

    // Properties delegated to the decoration manager
    public get decorationType(): vscode.TextEditorDecorationType {
        return this.decorationManager.decorationType;
    }

    public get decorationUpdateTimeout(): NodeJS.Timeout | undefined {
        return this.decorationManager.decorationUpdateTimeout;
    }

    // ISymbolCollector implementation - delegated to symbolCollector
    public async collectSymbols(documentUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
        return this.symbolCollector.collectSymbols(documentUri);
    }

    public async getAndSetSymbolsForActiveFile(documentUri: vscode.Uri, forceRefresh: boolean = false): Promise<void> {
        return this.symbolCollector.getAndSetSymbolsForActiveFile(documentUri, forceRefresh);
    }

    public async processSymbols(symbolList: vscode.DocumentSymbol[]): Promise<void> {
        return this.symbolCollector.processSymbols(symbolList);
    }

    // IDecorationManager implementation - delegated to decorationManager
    public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
        return this.decorationManager.updateDecorations(editor);
    }

    public dispose(): void {
        return this.decorationManager.dispose();
    }

    // IWorkspaceSymbolManager implementation - delegated to workspaceSymbolManager
    public async getWorkspaceSymbols(reporter?: ProgressReporter): Promise<Map<string, { symbol: vscode.DocumentSymbol; uri: vscode.Uri; }>> {
        return this.workspaceSymbolManager.getWorkspaceSymbols(reporter);
    }

    public async getUnusedSymbols(reporter?: ProgressReporter): Promise<UnusedSymbolInfo[]> {
        return this.workspaceSymbolManager.getUnusedSymbols(reporter);
    }

    public async updateFileSymbols(fileUri: vscode.Uri): Promise<void> {
        return this.workspaceSymbolManager.updateFileSymbols(fileUri);
    }

    public clearCaches(): void {
        return this.workspaceSymbolManager.clearCaches();
    }
}

// Export a singleton instance
export const symbolManager = new SymbolManager();