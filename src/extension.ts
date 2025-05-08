import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';
import { getSymbolsForActiveFile } from './getSymbolsForActiveFile';
import { getConfig } from './configChecks';
import { updateDecorations } from './updateDecorations';

let decorationType: vscode.TextEditorDecorationType;

// Add debounce function to prevent too-frequent updates
let decorationUpdateTimeout: NodeJS.Timeout | undefined;
const DEBOUNCE_DELAY = 500; // ms

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating extension');

  const config = vscode.workspace.getConfiguration('referenceCounter');
  const minimalisticDecorations = config.get<boolean>('minimalisticDecorations') || false;

  // Initialize decorationType
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: minimalisticDecorations ? '0' : '0 0 0 0.5em',
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

  // Update when the document is edited
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      console.log('Document changed');
      if (event.document === vscode.window.activeTextEditor?.document) {
        await updateDecorations(vscode.window.activeTextEditor);
      }
    }),
  );

}

export async function getAndSetSymbolsForDocument(editor: vscode.TextEditor) {
  const { includeImports, minimalisticDecorations, isValidFile } = getConfig(editor);

  if (!isValidFile) {
    console.log('File type not supported');
    return;
  }

  const symbols = await getSymbolsForActiveFile(editor);

  if (!symbols || symbols.length === 0) {
    console.log('No symbols found');
    return;
  }

  // Gather all symbols that need references in a flat array
  const symbolsToProcess: Array<vscode.DocumentSymbol> = [];

  for (const symbol of symbols) {
    symbolsToProcess.push(symbol);

    // If it's a class, add its methods
    if (symbol.kind === vscode.SymbolKind.Class) {
      for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
        symbolsToProcess.push(method);
      }
    }
  }

  // Process all symbols in a single batch to reduce overhead
  const decorations = await Promise.all(
    symbolsToProcess.map(async (symbol) => {
      const references = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        editor.document.uri,
        symbol.selectionRange.start,
        { includeDeclaration: false },
      );

      // Filter out excluded references
      const filteredReferences = references?.filter(reference => {
        const excludePatterns = config.get<string[]>('excludePatterns') || [];
        const refPath = reference.uri.path;
        return !excludePatterns.some(pattern =>
          new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
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
        referenceCount = filteredReferences.length
      }

      return decorateFile(referenceCount, symbol.range.start, minimalisticDecorations);
    })
  );

  editor.setDecorations(decorationType, decorations);
}

// Optimize the getReferencedFiles function
function getReferencedFiles(references: vscode.Location[] | undefined, editor: vscode.TextEditor): number {
  if (!references || references.length === 0) return 0;

  // Use a Set for efficient unique tracking
  const uniqueFiles = new Set<string>();
  const currentFile = editor.document.uri.path.split('/').pop() || '';
  for (const reference of references) {
    const filename = reference.uri.path.split('/').pop() || '';
    if (filename !== currentFile) {
      uniqueFiles.add(filename);
    }
  }

  return uniqueFiles.size;
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
