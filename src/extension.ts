import * as vscode from 'vscode';
// Import the required components
import { fileRefCounter } from './fileRefCounter';
import { workspaceSymbolManager } from './workspaceSymbolManager';
import { UnusedSymbolsProvider } from './unusedSymbolsView';

// Constants for IDs used within the extension
const REFRESH_UNUSED_SYMBOLS_COMMAND_ID = 'referenceCounter.refreshUnusedSymbols';
const UNUSED_SYMBOLS_VIEW_ID = 'referenceCounter.unusedSymbols';

/**
 * Sets up the Unused Symbols Tree View and its associated refresh command.
 * @returns An array of disposables related to the unused symbols view.
 */
function setupUnusedSymbolsView(): vscode.Disposable[] {
  console.log('Setting up Unused Symbols view');

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
    // Scan for workspace symbols and identify unused ones
    await workspaceSymbolManager.getWorkspaceSymbols();
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
  console.log('Setting up Decoration handling');

  // Apply decorations to the currently active editor, if any
  if (vscode.window.activeTextEditor) {
    // updateDecorations handles debouncing internally, so no need to await
    fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
  }

  // Register listener to update decorations when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        // updateDecorations handles debouncing internally
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
  console.log('Setting up File Save handling');

  // Register listener for when a text document is saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {

      // Check if the saved file's extension is supported by the configuration
      const fileExtension = document.uri.fsPath.split('.').pop()?.toLowerCase() || '';
      const supportedExtensions = vscode.workspace.getConfiguration('referenceCounter').get<string[]>('fileExtensions', []);

      if (supportedExtensions.includes(fileExtension)) {
        // Update the symbols for the saved file in the workspace manager
        await workspaceSymbolManager.updateFileSymbols(document.uri);

        // If the saved document is the currently active editor, update its decorations
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === document) {
          // updateDecorations handles debouncing internally
          fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
        }

        // Trigger a refresh of the unused symbols view only if the feature is enabled
        const config = vscode.workspace.getConfiguration('referenceCounter');
        if (config.get<boolean>('enableUnusedSymbols', true)) {
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
  console.log('Activating Reference Counter extension');

  let unusedSymbolsDisposables: vscode.Disposable[] | null = null;

  /** Helper function to enable the unused symbols feature */
  const enableUnusedSymbolsFeature = () => {
    if (unusedSymbolsDisposables === null) {
      console.log('Enabling Unused Symbols feature');
      unusedSymbolsDisposables = setupUnusedSymbolsView();
      context.subscriptions.push(...unusedSymbolsDisposables);
      // Perform an initial scan after a short delay
      setTimeout(() => {
        vscode.commands.executeCommand(REFRESH_UNUSED_SYMBOLS_COMMAND_ID);
      }, 1000); // 1-second delay
    }
  };

  /** Helper function to disable the unused symbols feature */
  const disableUnusedSymbolsFeature = () => {
    if (unusedSymbolsDisposables !== null) {
      console.log('Disabling Unused Symbols feature');
      // Dispose each disposable
      unusedSymbolsDisposables.forEach(d => d.dispose());
      // Clear the array - Note: Disposables pushed to context.subscriptions are managed there.
      // Disposing them here is sufficient. We set to null to track state.
      unusedSymbolsDisposables = null;
    }
  };

  // Initial setup based on configuration
  const initialConfig = vscode.workspace.getConfiguration('referenceCounter');
  if (initialConfig.get<boolean>('enableUnusedSymbols', true)) {
    enableUnusedSymbolsFeature();
  }

  // Setup other features (these are always active)
  setupDecorationHandling(context);
  setupFileSaveHandling(context); // Refined: Now only triggers refresh if view is enabled.

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('referenceCounter.enableUnusedSymbols')) {
        const config = vscode.workspace.getConfiguration('referenceCounter');
        const enabled = config.get<boolean>('enableUnusedSymbols', true);
        if (enabled) {
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
 * It cleans up resources used by the extension, such as disposables
 * and timeouts related to decorations.
 */
export function deactivate() {
  console.log('Deactivating Reference Counter extension');
  // Dispose of the decoration type if it exists
  if (fileRefCounter.decorationType) {
    fileRefCounter.decorationType.dispose();
  }
  // Clear any pending decoration update timeout
  if (fileRefCounter.decorationUpdateTimeout) {
    clearTimeout(fileRefCounter.decorationUpdateTimeout);
  }
}
