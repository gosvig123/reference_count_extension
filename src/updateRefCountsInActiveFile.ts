import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';
import { decorationType } from './extension';
import { getReferencesForSymbol } from './references';
import { getSymbolsToProcessForFile } from './symbols';
import { getReferencedFiles } from './utils';

export async function updateRefCountsInActiveFile(editor: vscode.TextEditor) {
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const excludePatterns = config.get<string[]>('excludePatterns');
  const includeImports = config.get<boolean>('includeImports');
  const minimalisticDecorations = config.get<boolean>('minimalisticDecorations');

  const acceptedExtensions = new Set(['py', 'js', 'jsx', 'ts', 'tsx']);
  const fileExtension = editor.document.uri.path.split('.').pop() || '';

  if (!acceptedExtensions.has(fileExtension)) {
    console.log('File type not supported');
    return;
  }

  const symbolsToProcess = await getSymbolsToProcessForFile(editor.document.uri);
  // Process all symbols in a single batch to reduce overhead
  const decorations = await Promise.all(
    symbolsToProcess.map(async (symbol) => {
      const references = await getReferencesForSymbol(symbol);

      // Filter out excluded references
      const filteredReferences = references?.filter(reference => {
        const refPath = reference.uri.path;
        return !excludePatterns.some(pattern => new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
        );
      });

      const referencedFilesCount = getReferencedFiles(filteredReferences, editor);
      const isMethod = symbol.kind === vscode.SymbolKind.Method;

      let referenceCount = filteredReferences
        ? includeImports
          ? filteredReferences.length
          : filteredReferences.length - referencedFilesCount
        : 0;

      if (isMethod) {
        referenceCount = filteredReferences.length;
      }

      return decorateFile(referenceCount, symbol.range.start, minimalisticDecorations);
    })
  );

  editor.setDecorations(decorationType, decorations);
}
