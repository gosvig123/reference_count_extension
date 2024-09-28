import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';

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
  await updateFunctionList();
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

async function updateFunctionList() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }

  const symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<
    vscode.DocumentSymbol[]
  >('vscode.executeDocumentSymbolProvider', activeEditor.document.uri);

  const functions: { name: string; line: number }[] = [];

  for (const symbol of symbols) {
    functions.push({
      name: symbol.name,
      line: symbol.range.start.line + 1,
    });
  }

  if (symbols) {
    await updateDecorations(activeEditor);
  }
}

//TODO split into decoration and ref count logic
async function updateDecorations(editor: vscode.TextEditor) {
  const symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<
    vscode.DocumentSymbol[]
  >('vscode.executeDocumentSymbolProvider', editor.document.uri);

  if (!symbols) {
    console.log('No symbols found');
    return;
  }

  const decorations: vscode.DecorationOptions[] = [];

  for (const symbol of symbols) {
    const symbolReferences: vscode.Location[] | undefined = await vscode.commands.executeCommand<
      vscode.Location[]
    >('vscode.executeReferenceProvider', editor.document.uri, symbol.range.start, {
      includeDeclaration: false,
    });

    let referenceCount = 0;

    if (symbolReferences) {
      referenceCount = symbolReferences.length;
    }

    const decoratedFile = decorateFile(referenceCount, symbol.range.start);

    decorations.push(decoratedFile);
  }

  editor.setDecorations(decorationType, decorations);
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
