import * as vscode from 'vscode';
import { ProgressReporter } from '../utils/progressUtils';

/**
 * Interface for unused symbol information
 */
export interface UnusedSymbolInfo {
    symbol: vscode.DocumentSymbol;
    uri: vscode.Uri;
}

/**
 * Interface for a symbol processor
 */
export interface ISymbolProcessor {
    /**
     * Process symbols from a document and handle their references
     */
    processSymbols(symbolList: vscode.DocumentSymbol[]): Promise<void>;
}

/**
 * Interface for a symbol collector
 */
export interface ISymbolCollector {
    /**
     * Get symbols for a document URI
     */
    collectSymbols(documentUri: vscode.Uri): Promise<vscode.DocumentSymbol[]>;
    
    /**
     * Get symbols for the active file and store them
     * @param documentUri The URI of the document to process
     * @param forceRefresh Whether to force a refresh of symbols and references
     */
    getAndSetSymbolsForActiveFile(documentUri: vscode.Uri, forceRefresh?: boolean): Promise<void>;
}

/**
 * Interface for a decoration manager
 */
export interface IDecorationManager {
    /**
     * Update decorations for the specified editor
     * @param editor The text editor to update decorations for
     * @param forceImmediate Optional flag to force immediate update (skip debouncing)
     */
    updateDecorations(editor: vscode.TextEditor, forceImmediate?: boolean): Promise<void>;
    
    /**
     * Clean up resources used by decorations
     */
    dispose(): void;
}

/**
 * Interface for a workspace symbol manager
 */
export interface IWorkspaceSymbolManager {
    /**
     * Get all symbols in the workspace
     */
    getWorkspaceSymbols(reporter?: ProgressReporter): Promise<Map<string, { symbol: vscode.DocumentSymbol, uri: vscode.Uri }>>;
    
    /**
     * Get unused symbols in the workspace
     */
    getUnusedSymbols(reporter?: ProgressReporter): Promise<UnusedSymbolInfo[]>;
    
    /**
     * Update symbols for a specific file
     */
    updateFileSymbols(fileUri: vscode.Uri): Promise<void>;
    
    /**
     * Clear all caches
     */
    clearCaches(): void;
}

/**
 * Interface for a symbol manager that combines functionality
 */
export interface ISymbolManager extends ISymbolCollector, IDecorationManager, IWorkspaceSymbolManager {}