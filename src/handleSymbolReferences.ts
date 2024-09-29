import * as vscode from 'vscode';

export async function handleReferencesForPython(
  symbol: vscode.DocumentSymbol,
): Promise<vscode.Location[]> {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== 'python') {
    return [];
  }

  try {
    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      document.uri,
      symbol.selectionRange.start,
      { includeDeclaration: false },
    );

    console.log('references', references);

    return references;
  } catch (error) {
    console.error('Error getting Python symbol references:', error);
    return [];
  }
}
