import * as vscode from 'vscode';

export function filterReferences(
  references: vscode.Location[],
  excludePatterns: string[]
): vscode.Location[] {
  // If no exclude patterns, return all references
  if (!excludePatterns.length) {
    return references;
  }

  return references.filter(reference => {
    const refPath = reference.uri.fsPath; // Use fsPath instead of path for consistent formatting

    // Only exclude if the path matches one of the exclude patterns exactly
    return !excludePatterns.some(pattern => {
      const regexPattern = pattern.replace(/\*/g, '[^/]*');  // More precise wildcard handling
      return new RegExp(`(^|/)${regexPattern}(/|$)`).test(refPath);
    });
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

// Cache for import references to avoid repeated document loading
const importReferenceCache = new Map<string, boolean>();

/**
 * Separates references into import references and usage references
 * Uses caching to improve performance
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

  // Process references in batches to improve performance
  const batchSize = 10;
  for (let i = 0; i < references.length; i += batchSize) {
    const batch = references.slice(i, i + batchSize);

    // Process batch in parallel
    const results = await Promise.all(
      batch.map(async (reference) => {
        const cacheKey = `${reference.uri.fsPath}:${reference.range.start.line}:${reference.range.start.character}`;

        // Check cache first
        if (!importReferenceCache.has(cacheKey)) {
          const isImport = await isImportReference(reference);
          importReferenceCache.set(cacheKey, isImport);
        }

        return { reference, isImport: importReferenceCache.get(cacheKey) };
      })
    );

    // Sort results into appropriate arrays
    for (const { reference, isImport } of results) {
      if (isImport) {
        importReferences.push(reference);
      } else {
        usageReferences.push(reference);
      }
    }
  }

  return { importReferences, usageReferences };
}
