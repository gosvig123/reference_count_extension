import * as vscode from 'vscode';

export async function handleReferencesForPython(symbol) {
  const symbolReferences = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    symbol.name,
  );

  if (!symbolReferences) {
    return [];
  }

  return symbolReferences;
}
