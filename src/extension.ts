import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';

let decorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating extension');

  // Initialize decorationType
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 0.5em',
      textDecoration: 'none',
    },
  });

  // Initial update
  updateFunctionList();

  // Update decorations for the current active editor
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log('Active editor changed');
      if (editor) {
        updateDecorations(editor);
      }
    }),
  );

  // Update when the document is edited
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      console.log('Document changed');
      if (event.document === vscode.window.activeTextEditor?.document) {
        updateDecorations(vscode.window.activeTextEditor);
      }
    }),
  );
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}

// Helper function to recursively collect function and method symbols
function collectFunctionSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  let functions: vscode.DocumentSymbol[] = [];

  for (const symbol of symbols) {
    if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method) {
      functions.push(symbol);
    }

    if (symbol.children && symbol.children.length > 0) {
      functions = functions.concat(collectFunctionSymbols(symbol.children));
    }
  }

  return functions;
}

async function updateFunctionList() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  try {
    const symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      activeEditor.document.uri,
    );

    if (!symbols) {
      console.log('No symbols found');
      return;
    }

    const functions = collectFunctionSymbols(symbols).map((symbol) => ({
      name: symbol.name,
      line: symbol.range.start.line + 1,
    }));

    console.log('Functions and Methods found:', functions);
    await updateDecorations(activeEditor);
  } catch (error) {
    console.error('Error fetching document symbols:', error);
  }
}

async function updateDecorations(editor: vscode.TextEditor) {
  try {
    const symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      editor.document.uri,
    );

    if (!symbols) {
      console.log('No symbols found');
      return;
    }

    const functionSymbols = collectFunctionSymbols(symbols);
    const decorations: vscode.DecorationOptions[] = [];

    for (const symbol of functionSymbols) {
      // Use selectionRange to target the symbol's name
      const position = symbol.selectionRange.start;

      const symbolReferences: vscode.Location[] | undefined = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        editor.document.uri,
        position,
        {
          includeDeclaration: false,
        },
      );

      let referenceCount = symbolReferences ? symbolReferences.length : 0;

      const decoratedFile = decorateFile(referenceCount, position);

      decorations.push(decoratedFile);
    }

    editor.setDecorations(decorationType, decorations);
    console.log('Decorations updated successfully');
  } catch (error) {
    console.error('Error updating decorations:', error);
  }
}
