import * as vscode from 'vscode';
import { getConfig } from './configChecks';
import { decorateFile } from './decorateFile';
import { getDecorationType } from './views/decorateFile';
import { filterMethodsAndTopLevelFunctions, findReferencesForSymbol, filterExcludedFiles, getDocumentSymbols } from './utils/symbolUtils';

// Using the shared utility function for filtering symbols

async function generateDecorationForSymbol(
  symbol: vscode.DocumentSymbol,
  editor: vscode.TextEditor,
  config: {
    includeImports: boolean;
    excludePatterns: string[];
  }
): Promise<vscode.DecorationOptions> {
  let symbolReferences = await findReferencesForSymbol(
    editor.document.uri,
    symbol.selectionRange.start,
    false // Don't include the declaration
  );

  symbolReferences = filterExcludedFiles(symbolReferences, config.excludePatterns);
  
  const isMethod = symbol.kind === vscode.SymbolKind.Method;


  // Faithfully reproduce the original reference count logic, including its characteristics
  let finalReferenceCount = symbolReferences
    ? config.includeImports
      ? symbolReferences.length
      : symbolReferences.length - (new Set(symbolReferences.map(reference => reference.uri.path)).size - 1)
    : 0;

  if (isMethod) {
    finalReferenceCount = symbolReferences ? symbolReferences.length : 0;
  }

  return decorateFile(finalReferenceCount, symbol.selectionRange.start);
}

export async function getAndSetSymbolsForDocument(editor: vscode.TextEditor) {
  const config = getConfig(editor);

  if (!config.isValidFile) {
    console.log('File type not supported');
    editor.setDecorations(getDecorationType(), []); // Clear decorations
    return;
  }

  const rawSymbols = await getDocumentSymbols(editor.document.uri);

  if (!rawSymbols || rawSymbols.length === 0) {
    console.log('No symbols found');
    editor.setDecorations(getDecorationType(), []); // Clear decorations
    return;
  }

  const symbolsToProcess = filterMethodsAndTopLevelFunctions(rawSymbols);

  if (symbolsToProcess.length === 0) {
    console.log('No symbols to process after deduplication.');
    editor.setDecorations(getDecorationType(), []); // Clear decorations
    return;
  }
  
  const decorationConfig = {
      includeImports: config.includeImports,
      excludePatterns: config.excludePatterns
  };

  const decorations = await Promise.all(
    symbolsToProcess.map(symbol => generateDecorationForSymbol(symbol, editor, decorationConfig))
  );

  editor.setDecorations(getDecorationType(), decorations);
}
