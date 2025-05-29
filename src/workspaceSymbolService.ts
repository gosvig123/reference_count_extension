import * as vscode from 'vscode';

export interface UnusedSymbolDescriptor {
  name: string;
  kind: vscode.SymbolKind;
  location: vscode.Location;
  fileUri: vscode.Uri;
  range: vscode.Range;
}

export async function findUnusedSymbolsInWorkspace(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<UnusedSymbolDescriptor[]> {
  const unusedSymbols: UnusedSymbolDescriptor[] = [];
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const validFileExtensions = config.get<string[]>('validFileExtensions') || [];

  if (validFileExtensions.length === 0) {
    vscode.window.showWarningMessage('No valid file extensions configured.');
    return [];
  }

  const files = await vscode.workspace.findFiles(`**/*.{${validFileExtensions.join(',')}}`);
  progress.report({ message: `Scanning ${files.length} files...` });

  for (let i = 0; i < files.length; i++) {
    if (token.isCancellationRequested) return unusedSymbols;

    const fileUri = files[i];
    progress.report({ message: `Processing ${vscode.workspace.asRelativePath(fileUri)}`, increment: (1 / files.length) * 100 });

    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', fileUri) || [];

      for (const symbol of symbols) {
        if (symbol.name.startsWith('_')) continue;

        const references = await vscode.commands.executeCommand<vscode.Location[]>(
          'vscode.executeReferenceProvider', fileUri, symbol.selectionRange.start, { includeDeclaration: true }
        ) || [];

        // If only the declaration exists (no other references)
        if (references.length <= 1) {
          unusedSymbols.push({
            name: symbol.name,
            kind: symbol.kind,
            location: new vscode.Location(fileUri, symbol.selectionRange),
            fileUri,
            range: symbol.selectionRange
          });
        }
      }
    } catch (error) {
      console.error(`Error processing ${vscode.workspace.asRelativePath(fileUri)}:`, error);
    }
  }

  return unusedSymbols;
}