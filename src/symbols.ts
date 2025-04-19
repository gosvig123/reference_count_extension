import * as vscode from 'vscode';

export async function getSymbolsForFile(fileUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    fileUri,
  );

  return symbols || [];
}

export async function getSymbolsToProcessForFile(fileUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  const symbols = await getSymbolsForFile(fileUri);
  const symbolsToProcess: vscode.DocumentSymbol[] = [];

  for    (const symbol of symbols) {
    symbolsToProcess.push(symbol);

    if (symbol.kind === vscode.SymbolKind.Class) {
      for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
        symbolsToProcess.push(method);
      }
    }
  }

  return symbolsToProcess;
}