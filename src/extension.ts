import * as vscode from 'vscode';
import { fileRefCounter } from './fileRefCounter';
import { workspaceSymbolManager } from './workspaceSymbolManager';
import { UnusedSymbolsProvider } from './unusedSymbolsView';
import { configManager } from './config';

// Constants for IDs used within the extension
const REFRESH_UNUSED_SYMBOLS_COMMAND_ID = 'referenceCounter.refreshUnusedSymbols';
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

  // Register the command to refresh the unused symbols view
  const refreshCommand = vscode.commands.registerCommand(REFRESH_UNUSED_SYMBOLS_COMMAND_ID, async () => {
    console.log('Refreshing unused symbols view...');
    // Clear the workspace symbols to force a fresh scan
    await workspaceSymbolManager.getWorkspaceSymbols();
    // Scan for unused symbols
    await workspaceSymbolManager.getUnusedSymbols();
    // Refresh the tree view to display the latest results
    unusedSymbolsProvider.refresh();
  });
  disposables.push(refreshCommand);

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
 * Sets up the listener for file save events to trigger symbol updates,
 * decoration updates, and unused symbols view refresh.
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

        // Trigger a refresh of the unused symbols view only if the feature is enabled
        if (configManager.enableUnusedSymbols) {
          vscode.commands.executeCommand(REFRESH_UNUSED_SYMBOLS_COMMAND_ID);
        }
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

  /** Helper function to enable the unused symbols feature */
  const enableUnusedSymbolsFeature = () => {
    if (unusedSymbolsDisposables === null) {
      unusedSymbolsDisposables = setupUnusedSymbolsView();
      context.subscriptions.push(...unusedSymbolsDisposables);

      // Perform an initial scan after a short delay to allow language servers to initialize
      setTimeout(async () => {
        console.log('Performing initial scan for unused symbols...');
        try {
          // First clear and rebuild the workspace symbols
          await workspaceSymbolManager.getWorkspaceSymbols();
          // Then scan for unused symbols
          await workspaceSymbolManager.getUnusedSymbols();
          // Finally refresh the view
          vscode.commands.executeCommand(REFRESH_UNUSED_SYMBOLS_COMMAND_ID);
        } catch (error) {
          console.error('Error during initial unused symbols scan:', error);
        }
      }, 3000); // Increased delay to 3 seconds
    }
  };

  /** Helper function to disable the unused symbols feature */
  const disableUnusedSymbolsFeature = () => {
    if (unusedSymbolsDisposables !== null) {
      // Dispose each disposable
      unusedSymbolsDisposables.forEach(d => d.dispose());
      unusedSymbolsDisposables = null;
    }
  };

  // Setup core features
  setupDecorationHandling(context);
  setupFileSaveHandling(context);

  // Initial setup of unused symbols feature based on configuration
  if (configManager.enableUnusedSymbols) {
    enableUnusedSymbolsFeature();
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('referenceCounter.enableUnusedSymbols')) {
        configManager.refresh();

        if (configManager.enableUnusedSymbols) {
          enableUnusedSymbolsFeature();
        } else {
          disableUnusedSymbolsFeature();
        }
      }
    })
  );
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
