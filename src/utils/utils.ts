import * as vscode from 'vscode';

export function filterReferences(
  references: vscode.Location[],
  excludePatterns: string[]): vscode.Location[] {
  return references.filter(reference => {
    const refPath = reference.uri.path;
    return !excludePatterns.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
    );
  });
}

/**
 * Determines if a reference is likely an import statement or an actual usage
 * This helps distinguish between imports and real code references
 *
 * @param reference The location to check
 * @returns True if the reference appears to be an import statement
 */
export async function isImportReference(reference: vscode.Location): Promise<boolean> {
  try {
    // Get the document for this reference
    const document = await vscode.workspace.openTextDocument(reference.uri);

    // Get the line text at the reference location
    const lineText = document.lineAt(reference.range.start.line).text;

    // Check common import patterns
    const isImport = (
      lineText.trim().startsWith('import ') ||
      lineText.includes('from ') ||
      lineText.includes('require(') ||
      // For TypeScript/JavaScript
      !!lineText.match(/import\s+{[^}]*}\s+from/) ||
      // For Python
      lineText.trim().startsWith('from ') ||
      // For Java/C#
      lineText.trim().startsWith('using ') ||
      lineText.trim().startsWith('import ')
    );

    return isImport;
  } catch (error) {
    // Default to false if we can't determine
    return false;
  }
}

/**
 * Separates references into import references and usage references
 *
 * @param references Array of references to analyze
 * @returns Object containing arrays of import and usage references
 */
export async function categorizeReferences(references: vscode.Location[]): Promise<{
  importReferences: vscode.Location[];
  usageReferences: vscode.Location[];
}> {
  const importReferences: vscode.Location[] = [];
  const usageReferences: vscode.Location[] = [];

  for (const reference of references) {
    if (await isImportReference(reference)) {
      importReferences.push(reference);
    } else {
      usageReferences.push(reference);
    }
  }

  return { importReferences, usageReferences };
}
