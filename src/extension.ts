import * as vscode from 'vscode';
import { updateDecorations } from './updateDecorations';
import { disposeDecorationType } from './views/decorateFile';


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
}

// Optimize the getReferencedFiles function
export function deactivate() {
  disposeDecorationType();
}
