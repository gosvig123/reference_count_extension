import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';

let decorationType: vscode.TextEditorDecorationType;
let updateTimeout: NodeJS.Timeout | undefined;
const referenceCache = new Map<string, number>();
let excludeRegexes: RegExp[] = [];

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating extension');

  // Initialize decorationType
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 0.8em',
      textDecoration: 'none',
    },
  });
  // Update decorations for the current active editor
  if (vscode.window.activeTextEditor) {
    await updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log('Active editor changed');
      if (editor) {
        await updateDecorations(editor);
      }
    }),
  );

  // Update when the document is edited (with debouncing)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      console.log('Document changed');
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      
      updateTimeout = setTimeout(async () => {
        if (event.document === vscode.window.activeTextEditor?.document) {
          await updateDecorations(vscode.window.activeTextEditor);
        }
      }, 300); // 300ms debounce
    }),
  );

  // Clear cache when files are saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      referenceCache.clear();
    }),
  );

}

function updateExcludePatterns() {
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const excludePatterns = config.get<string[]>('excludePatterns') || [];
  excludeRegexes = excludePatterns.map(pattern => 
    new RegExp(pattern.replace(/\*/g, '.*'))
  );
}

async function getReferenceCount(editor: vscode.TextEditor, symbol: vscode.DocumentSymbol): Promise<number> {
  const symbolKey = `${editor.document.uri.toString()}:${symbol.name}:${symbol.range.start.line}`;
  
  if (referenceCache.has(symbolKey)) {
    return referenceCache.get(symbolKey)!;
  }

  const symbolReferences = await vscode.commands.executeCommand<vscode.Location[]>(
    'vscode.executeReferenceProvider',
    editor.document.uri,
    symbol.selectionRange.start,
    { includeDeclaration: false }
  );

  const filteredReferences = symbolReferences?.filter(reference => {
    const refPath = reference.uri.path;
    return !excludeRegexes.some(regex => regex.test(refPath));
  });

  const count = filteredReferences ? filteredReferences.length : 0;
  referenceCache.set(symbolKey, count);
  return count;
}

async function processSymbolDecorations(editor: vscode.TextEditor, symbols: vscode.DocumentSymbol[]): Promise<vscode.DecorationOptions[]> {
  const decorations = await Promise.all(
    symbols.flatMap(async (symbol) => {
      const decorationsForSymbol: vscode.DecorationOptions[] = [];

      // Get references for the top-level symbol
      const referenceCount = await getReferenceCount(editor, symbol);
      decorationsForSymbol.push(decorateFile(referenceCount, symbol.range.start));

      // If it's a class, process its methods
      if (symbol.kind === vscode.SymbolKind.Class) {
        const methods = symbol.children.filter(
          child => child.kind === vscode.SymbolKind.Method
        );

        // Get references for each method
        const methodDecorations = await Promise.all(
          methods.map(async (method) => {
            const methodReferenceCount = await getReferenceCount(editor, method);
            return decorateFile(methodReferenceCount, method.range.start);
          })
        );

        decorationsForSymbol.push(...methodDecorations);
      }

      return decorationsForSymbol;
    })
  );

  return decorations.flat();
}

async function updateDecorations(editor: vscode.TextEditor) {
  updateExcludePatterns();

  const acceptedExtensions = new Set(['py', 'js', 'jsx', 'ts', 'tsx']);
  const fileExtension = editor.document.uri.path.split('.').pop() || '';
  const isAcceptedFile = acceptedExtensions.has(fileExtension);

  if (!isAcceptedFile) {
    console.log('File type not supported');
    return;
  }

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    editor.document.uri,
  );

  if (!symbols || symbols.length === 0) {
    console.log('No symbols found');
    return;
  }

  const decorations = await processSymbolDecorations(editor, symbols);
  editor.setDecorations(decorationType, decorations);
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
