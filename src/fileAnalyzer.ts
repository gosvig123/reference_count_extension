import * as vscode from 'vscode';
import { UnusedSymbol } from './unusedSymbolsView';

/**
 * Analyze a single file for unused symbols
 * @param file URI of the file to analyze
 * @param excludePatterns Patterns to exclude from reference counting
 * @returns Promise resolving to an array of unused symbols
 */
export async function analyzeFileForUnusedSymbols(
  file: vscode.Uri,
  excludePatterns: string[]
): Promise<UnusedSymbol[]> {
  const unusedSymbols: UnusedSymbol[] = [];

  try {
    // Open the document to ensure the symbol provider works correctly
    const document = await vscode.workspace.openTextDocument(file);

    // Get document symbols
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      file
    );

    if (symbols && symbols.length > 0) {
      // Process symbols in the file
      const symbolsToProcess: Array<{ symbol: vscode.DocumentSymbol, parent?: vscode.DocumentSymbol }> = [];

      // Collect all functions, methods, and classes
      for (const symbol of symbols) {
        if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Class) {
          symbolsToProcess.push({ symbol });
        }

        // If it's a class, add its methods
        if (symbol.kind === vscode.SymbolKind.Class) {
          for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
            symbolsToProcess.push({ symbol: method, parent: symbol });
          }
        }
      }

      // Process each symbol
      for (const { symbol, parent } of symbolsToProcess) {
        try {
          // Get references to the symbol
          const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            file,
            symbol.selectionRange.start,
            { includeDeclaration: false }
          );

          // Filter out excluded references and the declaration itself
          const filteredReferences = references?.filter(reference => {
            // Skip the declaration (which is at the same position as the symbol)
            if (reference.uri.fsPath === file.fsPath &&
                reference.range.start.line === symbol.selectionRange.start.line &&
                reference.range.start.character === symbol.selectionRange.start.character) {
              return false;
            }

            const refPath = reference.uri.path;
            return !excludePatterns.some(pattern =>
              new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
            );
          });

          // If no references after filtering, add to unused symbols
          if (!filteredReferences || filteredReferences.length === 0) {
            let label = symbol.name;
            if (parent) {
              label = `${parent.name}.${symbol.name}`;
            }

            unusedSymbols.push(
              new UnusedSymbol(
                label,
                vscode.TreeItemCollapsibleState.None,
                file.fsPath,
                symbol.range,
                symbol.kind
              )
            );
          }
        } catch (err) {
          console.error(`Error processing symbol ${symbol.name}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`Error processing file ${file.fsPath}:`, err);
  }

  return unusedSymbols;
}

/**
 * Check if a file extension is supported
 * @param filePath Path to the file
 * @returns True if the file extension is supported
 */
export function isSupportedFileType(filePath: string): boolean {
  const acceptedExtensions = ['py', 'js', 'jsx', 'ts', 'tsx'];
  const fileExtension = filePath.split('.').pop() || '';
  return acceptedExtensions.includes(fileExtension);
}

/**
 * Check if a file should be excluded based on exclude patterns
 * @param filePath Path to the file
 * @param excludePatterns Patterns to exclude
 * @returns True if the file should be excluded
 */
export function shouldExcludeFile(filePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern =>
    new RegExp(pattern.replace(/\*/g, '.*')).test(filePath)
  );
}
