import * as vscode from 'vscode';

// Optimize the getReferencedFiles function
export function getUniqueFilesFromSymbolRefs(references: vscode.Location[] | undefined, editor: vscode.TextEditor): number {
  if (!references || references.length === 0) return 0;

  // Use a Set for efficient unique tracking
  const uniqueFiles = new Set<string>();
  const currentFile = editor.document.uri.path.split('/').pop() || '';

  for (const reference of references) {
    const filename = reference.uri.path.split('/').pop() || '';
    if (filename !== currentFile) {
      uniqueFiles.add(filename);
    }
  }

  return uniqueFiles.size;
}

export function filterReferences(
  references: vscode.Location[],
  excludePatterns: string[]): vscode.Location[] {
  return references.filter(reference => {
    const refPath = reference.uri.path;
    return !excludePatterns.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
    );
  });
}

