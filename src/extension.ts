import * as vscode from 'vscode';
import { fileRefCounter } from './fileRefCounter';
import { workspaceSymbolManager } from './workspaceSymbolManager';
import { UnusedSymbolsProvider } from './unusedSymbolsView';
import { configManager } from './config';
import { withProgress } from './utils/progressUtils';

// Constants for IDs used within the extension
const FIND_UNUSED_SYMBOLS_COMMAND_ID = 'referenceCounter.findUnusedSymbols';
const UNUSED_SYMBOLS_VIEW_ID = 'referenceCounter.unusedSymbols';

/**
 * Sets up the Unused Symbols Tree View and its associated refresh command.
 * @returns An array of disposables related to the unused symbols view.
 */
function setupUnusedSymbolsView(): vscode.Disposable[] {
  // Initialize the unused symbols provider
  const unusedSymbolsProvider = new UnusedSymbolsProvider();

  // Register the tree data provider for unused symbols view
  const unusedSymbolsView = vscode.window.createTreeView(UNUSED_SYMBOLS_VIEW_ID, {
    treeDataProvider: unusedSymbolsProvider,
    showCollapseAll: true
  });

  // Create an array to hold the disposables for this feature
  const disposables: vscode.Disposable[] = [];
  disposables.push(unusedSymbolsView);

  // Register the command to find unused symbols
  const findUnusedSymbolsCommand = vscode.commands.registerCommand(FIND_UNUSED_SYMBOLS_COMMAND_ID, async () => {
    // Use our enhanced progress reporting
    await withProgress(
      'Scanning for unused symbols',
      100, // Initial estimate, will be updated during scan
      async (reporter) => {
        // First phase: Collect all symbols from the workspace
        await workspaceSymbolManager.getWorkspaceSymbols(reporter);

        // Second phase: Analyze symbols for references
        const unusedSymbols = await workspaceSymbolManager.getUnusedSymbols(reporter);

        // Refresh the tree view with the results
        unusedSymbolsProvider.refresh(unusedSymbols);

        // Show a status message with the results
        vscode.window.setStatusBarMessage(
          `Found ${unusedSymbols.length} unused symbols`,
          5000
        );

        return unusedSymbols;
      }
    );
  });
  disposables.push(findUnusedSymbolsCommand);

  return disposables;
}

/**
 * Sets up the handling for reference count decorations in text editors.
 * This includes initial decoration for the active editor and updating decorations
 * when the active editor changes.
 * @param context The extension context provided by VS Code.
 */
function setupDecorationHandling(context: vscode.ExtensionContext) {
  // Apply decorations to the currently active editor, if any
  if (vscode.window.activeTextEditor) {
    fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
  }

  // Register listener to update decorations when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        fileRefCounter.updateDecorations(editor);
      }
    }),
  );
}

/**
 * Sets up the listener for file save events to trigger symbol updates
 * and decoration updates.
 * @param context The extension context provided by VS Code.
 */
function setupFileSaveHandling(context: vscode.ExtensionContext) {
  // Register listener for when a text document is saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      // Check if the saved file is supported
      if (configManager.isFileSupported(document.uri)) {
        // Update the symbols for the saved file in the workspace manager
        await workspaceSymbolManager.updateFileSymbols(document.uri);

        // If the saved document is the currently active editor, update its decorations
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === document) {
          fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
        }

        // Note: We no longer automatically refresh the unused symbols view here
        // The user must manually run the command to refresh the view
      }
    })
  );
}

/**
 * This method is called when the extension is activated.
 * It initializes the core functionalities like the unused symbols view,
 * decoration handling, and file save listeners.
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
  // Track disposables for the unused symbols feature
  let unusedSymbolsDisposables: vscode.Disposable[] | null = null;

  // Setup core features
  setupDecorationHandling(context);
  setupFileSaveHandling(context);

  // Initial setup of unused symbols feature
  setupUnusedSymbolsView();
}

/**
 * This method is called when the extension is deactivated.
 * It cleans up resources used by the extension.
 */
export function deactivate() {
  // Dispose of the decoration type if it exists
  if (fileRefCounter.decorationType) {
    fileRefCounter.decorationType.dispose();
  }

  // Clear any pending decoration update timeout
  if (fileRefCounter.decorationUpdateTimeout) {
    clearTimeout(fileRefCounter.decorationUpdateTimeout);
  }
}
