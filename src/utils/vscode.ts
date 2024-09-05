import * as vscode from 'vscode';

export async function getSymbols(
  editor: vscode.TextEditor
): Promise<vscode.DocumentSymbol[] | undefined> {
  return await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    editor.document.uri
  );
}

