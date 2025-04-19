import * as vscode from 'vscode';

export async function getReferencesForSymbol(symbol: vscode.DocumentSymbol): Promise<vscode.Location[]> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return [];
  }

  const references = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    editor.document.uri,
    symbol.selectionRange.start
  );

  return references || [];
}
