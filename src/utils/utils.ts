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
    console.log(`[Debug] Analyzing ${filePath}...`); // Added Debug Log
    const document = await vscode.workspace.openTextDocument(documentUri);
    const text = document.getText();
    const lines = text.split('\n');

    let inMultiLineComment = false;

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      let line = originalLine.trim();

      // Basic multi-line comment handling
      if (inMultiLineComment) {
        if (line.includes('*/')) {
          inMultiLineComment = false;
          line = line.substring(line.indexOf('*/') + 2).trim(); // Process rest of the line
        } else {
          continue; // Skip lines entirely within a multi-line comment
        }
      }
      if (line.includes('/*')) {
        if (line.includes('*/')) {
          // Single-line multi-line comment (e.g., /* comment */ import ...;) - remove comment part
           line = line.substring(0, line.indexOf('/*')) + line.substring(line.indexOf('*/') + 2);
           line = line.trim();
        } else {
          inMultiLineComment = true;
          line = line.substring(0, line.indexOf('/*')).trim(); // Process line before comment starts
        }
      }

      // Remove single-line comments
      if (line.includes('//')) {
        line = line.substring(0, line.indexOf('//')).trim();
      }

      // console.log(`[Debug] Line ${i}: Processed: "${line}"`); // Uncomment for detailed line processing // Added Debug Log (Commented)

      // Check for empty lines after comment removal
      if (line === '') {
        continue;
      }

      // Check common import/require patterns (Simplified Regex Check)
      const potentialImportKeyword = line.match(/^\s*(import|require|using)/);
      const isImport = !!potentialImportKeyword;


      if (isImport) {
        // console.log(`[Debug] Line ${i}: Matched import keyword. Updating lastImportLine to ${i}`); // Uncomment for match details // Added Debug Log (Commented)
        lastImportLine = i; // Update last known import line
      } else {
        // Heuristic: If we encounter a line that's clearly not an import,
        // and it's not empty or just a comment, assume the import block has ended.
        // This helps avoid classifying code lines that happen to be after a gap
        // following the last import as part of the import block.
        // More sophisticated parsing (AST) would be better here.
        if (lastImportLine !== -1) {
          // If we already found *some* import, and this line is *not* an import,
          // we can potentially stop searching earlier. But let's scan the whole file
          // for simplicity and to catch imports potentially separated by comments/blank lines.
          // For now, continue scanning the whole file.
        }
      }
    }
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}: ${error}`);
    lastImportLine = -1; // Reset on error
  }

  console.log(`[Debug] Finished analyzing ${filePath}. lastImportLine = ${lastImportLine}`); // Added Debug Log
  // Store in cache (even if it's -1)
  lastImportLineCache.set(filePath, lastImportLine);
  return lastImportLine;
}


// TODO: Add a mechanism to clear the lastImportLineCache when files change.
// This could involve listening to vscode.workspace.onDidChangeTextDocument


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

  // Process references - can potentially still batch if performance dictates,
  // but let's start simpler.
  for (const reference of references) {
    const fileUri = reference.uri;
    const filePath = fileUri.fsPath;
    let lastImportLine = -1;

    // Check call-scoped cache first
    if (callScopedLastImportLines.has(filePath)) {
      lastImportLine = callScopedLastImportLines.get(filePath)!;
    } else {
      // If not in call-scoped cache, find (potentially using the module cache)
      lastImportLine = await findLastImportLine(fileUri);
      callScopedLastImportLines.set(filePath, lastImportLine); // Store in call-scoped cache
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
