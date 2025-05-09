import * as vscode from 'vscode';

/**
 * Interface for a symbol with its location and usage information
 */
export interface SymbolDescriptor {
  name: string;
  kind: vscode.SymbolKind;
  location: vscode.Location;
  fileUri: vscode.Uri;
  range: vscode.Range;
}

/**
 * Gets symbols for a document using VSCode's symbol provider
 * 
 * @param documentUri URI of the document to get symbols for
 * @returns Array of document symbols or empty array if none found
 */
export async function getDocumentSymbols(documentUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    documentUri
  );
  return symbols || [];
}

/**
 * Filters symbols to only include top-level symbols and class methods,
 * matching the reference counting criteria
 * 
 * @param rawSymbols All symbols from a document
 * @returns Filtered symbols (top-level symbols and class methods only)
 */
export function filterSymbolsToProcess(rawSymbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  const symbolsToProcess: Array<vscode.DocumentSymbol> = [];
  const processedSymbolStarts = new Set<string>();

  for (const symbol of rawSymbols) {
    const symbolStartKey = `${symbol.selectionRange.start.line}:${symbol.selectionRange.start.character}`;
    if (!processedSymbolStarts.has(symbolStartKey)) {
      symbolsToProcess.push(symbol);
      processedSymbolStarts.add(symbolStartKey);

      // If it's a class, add its methods
      if (symbol.kind === vscode.SymbolKind.Class) {
        for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
          const methodStartKey = `${method.selectionRange.start.line}:${method.selectionRange.start.character}`;
          if (!processedSymbolStarts.has(methodStartKey)) {
            symbolsToProcess.push(method);
            processedSymbolStarts.add(methodStartKey);
          }
        }
      }
    }
  }
  return symbolsToProcess;
}

/**
 * Checks if a symbol should be excluded based on naming conventions
 * (e.g., underscore prefix indicating private member)
 * 
 * @param symbolName Name of the symbol to check
 * @returns true if the symbol should be excluded
 */
export function shouldExcludeSymbol(symbolName: string): boolean {
  // Exclude symbols starting with underscore (conventional private members)
  return symbolName.startsWith('_');
}

/**
 * Find references for a symbol at a specific location
 * 
 * @param documentUri Document containing the symbol
 * @param position Position of the symbol
 * @param includeDeclaration Whether to include the declaration in the results
 * @returns Array of locations where the symbol is referenced
 */
export async function findReferencesForSymbol(
  documentUri: vscode.Uri,
  position: vscode.Position,
  includeDeclaration: boolean = false
): Promise<vscode.Location[]> {
  const references = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    documentUri,
    position,
    { includeDeclaration }
  );
  return references || [];
}

/**
 * Filters references based on exclude patterns
 * 
 * @param references Array of reference locations
 * @param excludePatterns Array of glob patterns to exclude
 * @returns Filtered references
 */
export function filterReferencesByPatterns(
  references: vscode.Location[],
  excludePatterns: string[]
): vscode.Location[] {
  if (!excludePatterns || excludePatterns.length === 0) {
    return references;
  }

  return references.filter(reference => {
    const refPath = reference.uri.path;
    return !excludePatterns.some(pattern => {
      // Simple pattern matching - could be enhanced with proper glob-to-regex
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(refPath);
    });
  });
}

/**
 * Converts a document symbol to a symbol descriptor
 * 
 * @param symbol DocumentSymbol to convert
 * @param documentUri URI of the document containing the symbol
 * @returns Symbol descriptor with location information
 */
export function symbolToDescriptor(
  symbol: vscode.DocumentSymbol,
  documentUri: vscode.Uri
): SymbolDescriptor {
  return {
    name: symbol.name,
    kind: symbol.kind,
    location: new vscode.Location(documentUri, symbol.selectionRange),
    fileUri: documentUri,
    range: symbol.selectionRange
  };
}