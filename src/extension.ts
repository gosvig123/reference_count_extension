import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';
import { handleReferencesForPython } from './handleSymbolReferences';

let decorationType: vscode.TextEditorDecorationType;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating extension');

  // Initialize decorationType
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 0.5em',
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

//TODO split into decoration and ref count logic
async function updateDecorations(editor: vscode.TextEditor) {
  const acceptedExtensions = new Set(['py', 'js', 'jsx', 'ts', 'tsx']);
  const fileExtension = editor.document.uri.path.split('.').pop() || '';
  const isAcceptedFile = acceptedExtensions.has(fileExtension);

  if (!isAcceptedFile) {
    console.log('File type not supported');
    return;
  }

  const isPython = fileExtension === 'py';

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    editor.document.uri,
  );

  if (!symbols || symbols.length === 0) {
    console.log('No symbols found');
    return;
  }

  const decorationPromises = symbols.map(async (symbol) => {
    let symbolReferences: vscode.Location[] | undefined | vscode.SymbolInformation[];

    if (isPython) {
      // Use Python-specific reference handler
      symbolReferences = await handleReferencesForPython(symbol);
    } else {
      // Use the standard reference provider for other languages
      symbolReferences = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        editor.document.uri,
        symbol.range.start,
        { includeDeclaration: false },
      );
    }

    const referenceCount = symbolReferences ? symbolReferences.length : 0;
    return decorateFile(referenceCount, symbol.range.start);
  });

  const ondecorations = await Promise.all(decorationPromises);

  editor.setDecorations(decorationType, ondecorations);
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
