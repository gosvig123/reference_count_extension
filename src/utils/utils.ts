import * as vscode from 'vscode';
import { CommentHandler } from './commentUtils';
import { languageHandlerRegistry } from './languageHandlers';

/**
 * Filter references based on exclude patterns
 */
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
      // Convert glob-like pattern to regex (basic support for *)
      // Escapes regex characters and replaces * with [^/]*
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex characters
      const regexPattern = escapedPattern.replace(/\*/g, '[^/]*'); // Replace \* with [^/]*
      return new RegExp(`(^|/)${regexPattern}(/|$)`).test(refPath);
    });
  });
}

// Cache for the last import line number per file URI
const lastImportLineCache = new Map<string, number>();

/**
 * Clears the import line cache
 */
export function clearImportLineCache(): void {
  lastImportLineCache.clear();
  console.log('[ReferenceCounter Debug] Import line cache cleared.');
}

/**
 * Finds the line number of the last import/require statement in a document.
 * Caches the result per file URI.
 *
 * @param documentUri The URI of the document to analyze.
 * @returns The 0-based line number of the last import, or -1 if none found or error.
 */
export async function findLastImportLine(documentUri: vscode.Uri): Promise<number> {
  const filePath = documentUri.fsPath;

  // Check cache first
  if (lastImportLineCache.has(filePath)) {
    return lastImportLineCache.get(filePath)!;
  }

  let lastImportLine = -1;
  try {
    const document = await vscode.workspace.openTextDocument(documentUri);
    const text = document.getText();
    const lines = text.split('\n');

    // Get the appropriate language handler for this file
    const languageHandler = languageHandlerRegistry.getHandlerForFile(filePath);

    // Create a comment handler
    const commentHandler = new CommentHandler();

    for (let i = 0; i < lines.length; i++) {
      // Process the line to remove comments
      const line = commentHandler.processLine(lines[i]);

      // Skip empty lines
      if (line === '') {
        continue;
      }

      // Check if this is an import or export line using the language handler
      if (languageHandler.isImportOrExportLine(line)) {
        lastImportLine = i; // Update last known import line
      }
    }
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}: ${error}`);
    lastImportLine = -1; // Reset on error
  }

  // Store in cache (even if it's -1)
  lastImportLineCache.set(filePath, lastImportLine);
  return lastImportLine;
}

/**
 * Checks if a reference is a component usage in JSX or similar
 */
async function isComponentUsage(reference: vscode.Location): Promise<boolean> {
  try {
    const fileUri = reference.uri;
    const filePath = fileUri.fsPath;
    const referenceLine = reference.range.start.line;

    // Get the appropriate language handler
    const languageHandler = languageHandlerRegistry.getHandlerForFile(filePath);

    // Only proceed with component detection for handlers that support it
    if (languageHandler.isComponentUsage) {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const lineText = document.lineAt(referenceLine).text;

      return languageHandler.isComponentUsage(lineText);
    }
  } catch (error) {
    console.error(`Error checking for component usage: ${error}`);
  }

  return false;
}

/**
 * Separates references into import references and usage references based on line number.
 * Uses caching for the last import line determination.
 *
 * @param references Array of references to analyze.
 * @returns Object containing arrays of import and usage references.
 */
export async function categorizeReferences(references: vscode.Location[]): Promise<{
  importReferences: vscode.Location[];
  usageReferences: vscode.Location[];
}> {
  const importReferences: vscode.Location[] = [];
  const usageReferences: vscode.Location[] = [];

  // Map to store last import line per file *within this specific call*
  // to avoid redundant lookups for the same file in a single batch.
  const callScopedLastImportLines = new Map<string, number>();

  // Process references
  for (const reference of references) {
    const fileUri = reference.uri;
    const filePath = fileUri.fsPath;

    // Check if this is a component usage (for React/JSX)
    if (await isComponentUsage(reference)) {
      usageReferences.push(reference);
      continue;
    }

    // Get the last import line for this file
    let lastImportLine = -1;
    if (callScopedLastImportLines.has(filePath)) {
      lastImportLine = callScopedLastImportLines.get(filePath)!;
    } else {
      lastImportLine = await findLastImportLine(fileUri);
      callScopedLastImportLines.set(filePath, lastImportLine);
    }

    const referenceLine = reference.range.start.line; // 0-based

    // Categorize based on line number
    if (lastImportLine !== -1 && referenceLine <= lastImportLine) {
      importReferences.push(reference);
    } else {
      usageReferences.push(reference);
    }
  }

  return { importReferences, usageReferences };
}