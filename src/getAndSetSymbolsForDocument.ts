import * as vscode from 'vscode';

// Global decoration type - reused across the extension
let decorationType: vscode.TextEditorDecorationType | undefined;

function getDecorationType(): vscode.TextEditorDecorationType {
  const minimalisticDecorations = vscode.workspace.getConfiguration('referenceCounter').get<boolean>('minimalisticDecorations') || false;

  if (!decorationType) {
    decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: minimalisticDecorations ? '0' : '0 0 0 0.5em',
        textDecoration: 'none',
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }
  return decorationType;
}

export function disposeDecorationType(): void {
  if (decorationType) {
    decorationType.dispose();
    decorationType = undefined;
  }
}

async function generateDecorationForSymbol(
  symbol: vscode.DocumentSymbol,
  editor: vscode.TextEditor
): Promise<vscode.DecorationOptions> {
  // Get references for the symbol
  const references = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    editor.document.uri,
    symbol.selectionRange.start,
    { includeDeclaration: false }
  ) || [];

  // Filter excluded files
  const excludePatterns = vscode.workspace.getConfiguration('referenceCounter').get<string[]>('excludePatterns') || [];
  const filteredReferences = references.filter(ref => {
    if (excludePatterns.length === 0) return true;
    const refPath = ref.uri.path;
    return !excludePatterns.some(pattern => {
      const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
      return new RegExp(regexPattern).test(refPath);
    });
  });

  // Calculate reference count
  const includeImports = vscode.workspace.getConfiguration('referenceCounter').get<boolean>('includeImports') || false;
  let refCount = 0;
  if (filteredReferences.length > 0) {
    if (includeImports) {
      refCount = filteredReferences.length;
    } else {
      const uniqueFilePaths = new Set(filteredReferences.map(ref => ref.uri.path));
      refCount = filteredReferences.length - (uniqueFilePaths.size - 1);
    }
  }

  // Create decoration
  const minimalisticDecorations = vscode.workspace.getConfiguration('referenceCounter').get<boolean>('minimalisticDecorations') || false;
  const finalRefCount = refCount > 0 ? refCount - 1 : refCount;
  const displayText = finalRefCount > 0 || minimalisticDecorations ? `(${finalRefCount})` : 'No references';
  const textColor = finalRefCount > 0 ? 'gray' : 'red';

  return {
    range: new vscode.Range(symbol.selectionRange.start, symbol.selectionRange.start),
    renderOptions: {
      after: {
        contentText: displayText,
        color: textColor,
      },
    },
  };
}

export async function getAndSetSymbolsForDocument(editor: vscode.TextEditor) {
  // Check if file type is supported
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const validFileExtensions = config.get<string[]>('validFileExtensions') || [];
  const fileExtension = editor.document.uri.path.split('.').pop() || '';

  if (!validFileExtensions.includes(fileExtension)) {
    console.log('File type not supported');
    editor.setDecorations(getDecorationType(), []);
    return;
  }

  // Get document symbols
  const rawSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    editor.document.uri
  ) || [];

  if (rawSymbols.length === 0) {
    console.log('No symbols found');
    editor.setDecorations(getDecorationType(), []);
    return;
  }

  // Filter symbols to include top-level symbols and class methods
  const symbolsToProcess: vscode.DocumentSymbol[] = [];
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

  if (symbolsToProcess.length === 0) {
    console.log('No symbols to process after filtering.');
    editor.setDecorations(getDecorationType(), []);
    return;
  }

  // Generate decorations for all symbols (excluding private symbols starting with _)
  const decorations = await Promise.all(
    symbolsToProcess
      .filter(symbol => !symbol.name.startsWith('_'))
      .map(symbol => generateDecorationForSymbol(symbol, editor))
  );

  editor.setDecorations(getDecorationType(), decorations);
}
