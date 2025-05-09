import * as vscode from 'vscode';
import { getConfig } from './configChecks';
import { decorateFile } from './decorateFile';
import { getSymbolsForActiveFile } from './getSymbolsForActiveFile';
import { getDecorationType } from './views/decorateFile';

function getSymbolsToProcess(rawSymbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
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

async function generateDecorationForSymbol(
  symbol: vscode.DocumentSymbol,
  editor: vscode.TextEditor,
  config: {
    includeImports: boolean;
    minimalisticDecorations: boolean;
    excludePatterns: string[];
  }
): Promise<vscode.DecorationOptions> {
  const references = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    editor.document.uri,
    symbol.selectionRange.start,
    { includeDeclaration: false }
  );

  const filteredReferences = references?.filter(reference => {
    const refPath = reference.uri.path;
    return !config.excludePatterns.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(refPath));
  });

  const isMethod = symbol.kind === vscode.SymbolKind.Method;

  // Faithfully reproduce the original reference count logic, including its characteristics
  let finalReferenceCount = filteredReferences
    ? config.includeImports
      ? filteredReferences.length
      : filteredReferences.length - (new Set(filteredReferences.map(reference => reference.uri.path)).size - 1)
    : 0;

  if (isMethod) {
    finalReferenceCount = filteredReferences ? filteredReferences.length : 0;
  }

  return decorateFile(finalReferenceCount, symbol.selectionRange.start, config.minimalisticDecorations);
}

export async function getAndSetSymbolsForDocument(editor: vscode.TextEditor) {
  const config = getConfig(editor);

  if (!config.isValidFile) {
    console.log('File type not supported');
    editor.setDecorations(getDecorationType(), []); // Clear decorations
    return;
  }

  const rawSymbols = await getSymbolsForActiveFile(editor);

  if (!rawSymbols || rawSymbols.length === 0) {
    console.log('No symbols found');
    editor.setDecorations(getDecorationType(), []); // Clear decorations
    return;
  }

  const symbolsToProcess = getSymbolsToProcess(rawSymbols);

  if (symbolsToProcess.length === 0) {
    console.log('No symbols to process after deduplication.');
    editor.setDecorations(getDecorationType(), []); // Clear decorations
    return;
  }
  
  const decorationConfig = {
      includeImports: config.includeImports,
      minimalisticDecorations: config.minimalisticDecorations,
      excludePatterns: config.excludePatterns
  };

  const decorations = await Promise.all(
    symbolsToProcess.map(symbol => generateDecorationForSymbol(symbol, editor, decorationConfig))
  );

  editor.setDecorations(getDecorationType(), decorations);
}
