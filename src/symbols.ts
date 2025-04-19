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

export async function getWorkspaceSymbols(): Promise<vscode.DocumentSymbol[]> {
  let workspaceSymbols = [];
  const workspaceFiles = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py}', '**/node_modules/**', 1000);
  for (const file of workspaceFiles) {
    const symbolsInFile = await getSymbolsForFile(file);
    workspaceSymbols.push(...symbolsInFile);
  }
  return workspaceSymbols;
}
