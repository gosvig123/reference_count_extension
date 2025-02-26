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
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const excludePatterns = config.get<string[]>('excludePatterns') || [];
  const includeImports = config.get<boolean>('includeImports') || false;

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

  const decorations = await Promise.all(
    symbols.flatMap(async (symbol) => {
      const decorationsForSymbol: vscode.DecorationOptions[] = [];

      // Get references for the top-level symbol
      const symbolReferences = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        editor.document.uri,
        symbol.selectionRange.start,
        { includeDeclaration: false },
      );

      // Filter out excluded references
      const filteredReferences = symbolReferences?.filter((reference) => {
        const refPath = reference.uri.path;
        return !excludePatterns.some((pattern) =>
          new RegExp(pattern.replace(/\*/g, '.*')).test(refPath),
        );
      });

      // count the number of files that are referenced that is different from the current file
      const referencedFilesCount = getReferencedFiles(filteredReferences, editor);

      // Add decoration for the top-level symbol
      const referenceCount = filteredReferences
        ? includeImports
          ? filteredReferences.length
          : filteredReferences.length - referencedFilesCount
        : 0;
      decorationsForSymbol.push(decorateFile(referenceCount, symbol.range.start));

      // If it's a class, process its methods
      if (symbol.kind === vscode.SymbolKind.Class) {
        const methods = symbol.children.filter(
          (child) => child.kind === vscode.SymbolKind.Method,
        );

        // Get references for each method
        const methodDecorations = await Promise.all(
          methods.map(async (method) => {
            const methodReferences =
              await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                editor.document.uri,
                method.selectionRange.start,
                { includeDeclaration: false },
              );

            // Filter out excluded references for methods
            const filteredMethodRefs = methodReferences?.filter((reference) => {
              const refPath = reference.uri.path;
              return !excludePatterns.some((pattern) =>
                new RegExp(pattern.replace(/\*/g, '.*')).test(refPath),
              );
            });
            const methodReferencedFilesCount = getReferencedFiles(
              filteredMethodRefs,
              editor,
            );

            const methodReferenceCount = filteredMethodRefs
              ? includeImports
                ? filteredMethodRefs.length
                : filteredMethodRefs.length - methodReferencedFilesCount
              : 0;
            return decorateFile(methodReferenceCount, method.range.start);
          }),
        );

        decorationsForSymbol.push(...methodDecorations);
      }

      return decorationsForSymbol;
    }),
  );

  editor.setDecorations(decorationType, decorations.flat());
}

function getReferencedFiles(references: vscode.Location[], editor: vscode.TextEditor) {
  const referencedFiles = references?.map(reference => reference.uri.path.split('/').pop());
  const uniqueReferencedFiles = [...new Set(referencedFiles)];
  // check if the current file is in the uniqueReferencedFiles
  const currentFile = editor.document.uri.path.split('/').pop();
  const isCurrentFileReferenced = uniqueReferencedFiles.includes(currentFile);
  const referencedFilesCount = uniqueReferencedFiles.length - (isCurrentFileReferenced ? 1 : 0);
  return referencedFilesCount;
}
export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
