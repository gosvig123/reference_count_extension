import * as vscode from 'vscode';
import { updateDecorations } from './updateDecorations';
import { disposeDecorationType } from './views/decorateFile'; 
import { findUnusedSymbolsInWorkspace } from './workspaceSymbolService';
import { UnusedSymbolsViewProvider } from './unusedSymbolsViewProvider';

let unusedSymbolsProvider: UnusedSymbolsViewProvider;

export async function activate(context: vscode.ExtensionContext) {

  // Update decorations for the current active editor
  if (vscode.window.activeTextEditor) {
    await updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log('Active editor changed');
      if (editor) {
        await updateDecorations(editor);
      }
    }),
  );

  // Update when the document is saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (event) => {
      console.log('Document saved');
      if (event === vscode.window.activeTextEditor?.document) {
        await updateDecorations(vscode.window.activeTextEditor);
      }
    }),
  );

  // New: Unused Symbols Feature
  unusedSymbolsProvider = new UnusedSymbolsViewProvider(context);
  // Register the TreeView and ensure its registration is added to subscriptions for disposal
  context.subscriptions.push(
    vscode.window.createTreeView('unusedSymbolsView', {
      treeDataProvider: unusedSymbolsProvider,
      showCollapseAll: true
    })
  );
  
  // Find unused symbols command - main scanning functionality
  context.subscriptions.push(
    vscode.commands.registerCommand('referenceCounter.findUnusedSymbols', async () => {
      // Provide initial feedback in the tree view
      unusedSymbolsProvider.refresh(undefined, "Scanning for unused symbols...");
      
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Finding Unused Symbols',
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ increment: 0, message: "Initializing scan..." });
          try {
            // Pass the progress and token to the symbol finding function
            const symbols = await findUnusedSymbolsInWorkspace(progress, token);
            
            if (token.isCancellationRequested) {
              unusedSymbolsProvider.refresh(undefined, "Scan cancelled by user.");
              vscode.window.showInformationMessage('Unused symbol scan cancelled.');
              return;
            }

            // Refresh the tree view with the found symbols
            unusedSymbolsProvider.refresh(symbols);

            if (symbols.length > 0) {
                vscode.window.showInformationMessage(`Found ${symbols.length} unused symbols. Check the 'Reference Counter' sidebar view.`);
            } else {
                vscode.window.showInformationMessage('No unused symbols found in the workspace.');
            }
          } catch (error) { // Catch any error from findUnusedSymbolsInWorkspace
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Error finding unused symbols:", error);
            vscode.window.showErrorMessage(`Error finding unused symbols: ${errorMessage}`);
            // Update tree view to show error state
            unusedSymbolsProvider.refresh(undefined, `Error during scan: ${errorMessage.substring(0,100)}... (See console for details)`);
          }
        }
      );
    })
  );
  
  // Refresh command - rerun the last scan if symbols exist, otherwise treat as new scan
  context.subscriptions.push(
    vscode.commands.registerCommand('referenceCounter.refreshUnusedSymbols', async () => {
      // Simply re-execute the findUnusedSymbols command
      vscode.commands.executeCommand('referenceCounter.findUnusedSymbols');
    })
  );
  
  // Clear command - clear the unused symbols view
  context.subscriptions.push(
    vscode.commands.registerCommand('referenceCounter.clearUnusedSymbols', () => {
      unusedSymbolsProvider.clear();
      vscode.window.showInformationMessage('Unused symbols cleared.');
    })
  );
}

// Optimize the getReferencedFiles function
export function deactivate() {
  disposeDecorationType();
}
