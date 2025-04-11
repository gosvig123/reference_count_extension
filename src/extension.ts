import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';
import { symbolManager } from './symbolManager';
import { getReferencedFiles } from './utils/utils';
import { fileRefCounter } from './fileRefCounter';
let decorationType: vscode.TextEditorDecorationType;

// Add debounce function to prevent too-frequent updates
let decorationUpdateTimeout: NodeJS.Timeout | undefined;
const DEBOUNCE_DELAY = 500; // ms

export async function activate(context: vscode.ExtensionContext) {
 
  // Initialize decorationType
  decorationType = fileRefCounter.decorationType;
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

async function updateDecorations(editor: vscode.TextEditor) {
  // Clear any pending update
  if (decorationUpdateTimeout) {
    clearTimeout(decorationUpdateTimeout);
  }

  // Schedule new update with debouncing
  decorationUpdateTimeout = setTimeout(async () => {
    await performDecorationsUpdate(editor);
  }, DEBOUNCE_DELAY);
}

async function performDecorationsUpdate(editor: vscode.TextEditor) {
  try {


    if (!fileRefCounter.isActiveFileSupported()) {
      return;
    }
    await symbolManager.getAndSetSymbolsForActiveFile(editor.document.uri);
    const { activeFileSymbolStore } = symbolManager;
    if (!activeFileSymbolStore) {
      return;
    }

    await processSymbols(editor);

  } catch (error) {
    console.error('Error in performDecorationsUpdate:', error);
    // Don't rethrow - we want to silently fail for binary files
  }
}

// Extract symbol processing logic to separate function
async function processSymbols(
  editor: vscode.TextEditor, 
 
) {
  try {
    await symbolManager.getAndSetSymbolsForActiveFile(editor.document.uri);
    const { activeFileSymbolStore } = symbolManager;

    const decorations = await Promise.all(
      Array.from(activeFileSymbolStore.values()).map(symbol => 
        processSymbol(editor, symbol)
      )
    );

    editor.setDecorations(decorationType, decorations.filter(Boolean));
  } catch (error) {
    console.error('Error processing symbols:', error);
  }
}

// Extract single symbol processing logic
async function processSymbol(
  editor: vscode.TextEditor,
  symbol: vscode.DocumentSymbol,
): Promise<vscode.DecorationOptions | null> {
  try {
    const references = await symbolManager.getSymbolReferences(symbol);

    if (!references) return null;

    const filteredReferences = filterReferences(references, fileRefCounter.excludePatterns);
    const referencedFilesCount = getReferencedFiles(filteredReferences, editor);
    const referenceCount = calculateReferenceCount(
      filteredReferences,
      referencedFilesCount,
      symbol,
    );

    return decorateFile(referenceCount, symbol.range.start, fileRefCounter.minimalisticDecorations);
  } catch (error) {
    console.error('Error processing single symbol:', error);
    return null;
  }
}

function filterReferences(
  references: vscode.Location[],
  excludePatterns: string[]
): vscode.Location[] {
  return references.filter(reference => {
    const refPath = reference.uri.path;
    return !excludePatterns.some(pattern =>
      new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
    );
  });
}

function calculateReferenceCount(
  filteredReferences: vscode.Location[],
  referencedFilesCount: number,
  symbol: vscode.DocumentSymbol,
): number {
  const isMethod = symbol.kind === vscode.SymbolKind.Method;
  
  if (isMethod) {
    return filteredReferences.length;
  }

  return  fileRefCounter.includeImports
    ? filteredReferences.length
    : filteredReferences.length - referencedFilesCount;
}
export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
