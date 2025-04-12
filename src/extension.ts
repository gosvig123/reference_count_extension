import * as vscode from 'vscode';
// Only import the fileRefCounter instance now
import { fileRefCounter } from './fileRefCounter';

// Debouncing is now handled within fileRefCounter

export async function activate(context: vscode.ExtensionContext) {
 
  // Update decorations for the current active editor using fileRefCounter
  if (vscode.window.activeTextEditor) {
    // No need to await here, updateDecorations handles debouncing internally
    fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log('Active editor changed');
      if (editor) {
        // No need to await here, updateDecorations handles debouncing internally
        fileRefCounter.updateDecorations(editor);
      }
    }),
  );

  // Update when the document is edited
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      console.log('Document changed');
      if (event.document === vscode.window.activeTextEditor?.document) {
        // No need to await here, updateDecorations handles debouncing internally
        fileRefCounter.updateDecorations(vscode.window.activeTextEditor);
      }
    }),
  );

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
