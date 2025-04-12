import * as vscode from 'vscode';
// Import the required components
import { fileRefCounter } from './fileRefCounter';
import { workspaceSymbolManager } from './workspaceSymbolManager';
import { UnusedSymbolsProvider } from './unusedSymbolsView';

// Debouncing is now handled within fileRefCounter

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating Reference Counter extension');

  // Initialize the unused symbols provider
  const unusedSymbolsProvider = new UnusedSymbolsProvider();

  // Register the tree data provider for unused symbols
  const unusedSymbolsView = vscode.window.createTreeView('referenceCounter.unusedSymbols', {
    treeDataProvider: unusedSymbolsProvider,
    showCollapseAll: true
  });

  // Register the tree view in the context
  context.subscriptions.push(unusedSymbolsView);

  // Register a command to refresh the unused symbols view
  context.subscriptions.push(
    vscode.commands.registerCommand('referenceCounter.refreshUnusedSymbols', async () => {
      // Scan for unused symbols first
      await workspaceSymbolManager.getWorkspaceSymbols();
      await workspaceSymbolManager.getUnusedSymbols();
      // Then refresh the view
      unusedSymbolsProvider.refresh();
    })
  );

  // Update decorations for the current active editor using fileRefCounter
  if (vscode.window.activeTextEditor) {
    // No need to await here, updateDecorations handles debouncing internally
    fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        // No need to await here, updateDecorations handles debouncing internally
        fileRefCounter.updateDecorations(editor);
      }
    }),
  );

  // Update when the document is edited
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        // Update workspace symbols
        await workspaceSymbolManager.updateFileSymbols(event.document.uri);

        fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
      }
    }),
  );

  // Add listener for file save events
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {

      // Check if the file extension is supported
      const fileExtension = document.uri.fsPath.split('.').pop()?.toLowerCase() || '';
      const supportedExtensions = vscode.workspace.getConfiguration('referenceCounter').get('fileExtensions', []);

      if (supportedExtensions.includes(fileExtension)) {
        // Update symbols for the saved file
        await workspaceSymbolManager.updateFileSymbols(document.uri);

        // Refresh the unused symbols view
        vscode.commands.executeCommand('referenceCounter.refreshUnusedSymbols');
      }
    })
  );

  // Initial scan for unused symbols (with a slight delay to ensure extension is fully loaded)
  setTimeout(() => {
    vscode.commands.executeCommand('referenceCounter.refreshUnusedSymbols');
  }, 1000);
}

// All decoration logic moved to fileRefCounter.ts
export function deactivate() {
  if (fileRefCounter.decorationType) {
    fileRefCounter.decorationType.dispose();
  }
  if (fileRefCounter.decorationUpdateTimeout) {
    clearTimeout(fileRefCounter.decorationUpdateTimeout);
  }
}
