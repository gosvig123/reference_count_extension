import * as vscode from 'vscode';

const SUPPORTED_LANGUAGES = new Set(['python', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact']);
const DEBOUNCE_DELAY = 300;

let decorationType: vscode.TextEditorDecorationType;
let updateTimeout: NodeJS.Timeout | undefined;
let excludePatterns: RegExp[] = [];

export async function activate(context: vscode.ExtensionContext) {
  console.log('Reference Counter: Activating extension');

  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 0.8em',
      textDecoration: 'none',
    },
  });

  // Initial decoration
  if (vscode.window.activeTextEditor) {
    console.log('Reference Counter: Initial editor found, updating decorations');
    await updateDecorations(vscode.window.activeTextEditor);
  }

  // Update on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log('Reference Counter: Active editor changed');
      if (editor) {
        await updateDecorations(editor);
      }
    })
  );

  // Debounced update on document change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }

      updateTimeout = setTimeout(async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
          console.log('Reference Counter: Document changed, updating decorations');
          await updateDecorations(editor);
        }
      }, DEBOUNCE_DELAY);
    })
  );
}

function loadExcludePatterns(): void {
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const patterns = config.get<string[]>('excludePatterns') || [];
  excludePatterns = patterns.map(pattern => new RegExp(pattern.replace(/\*/g, '.*')));
}

async function getReferenceCount(
  uri: vscode.Uri,
  position: vscode.Position
): Promise<number> {
  try {
    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position
    );

    if (!references || !Array.isArray(references)) {
      return 0;
    }

    const filtered = references.filter(ref =>
      !excludePatterns.some(regex => regex.test(ref.uri.path))
    );

    return filtered.length;
  } catch (error) {
    console.error('Reference Counter: Error getting reference count:', error);
    return 0;
  }
}

async function processSymbol(
  uri: vscode.Uri,
  symbol: vscode.DocumentSymbol
): Promise<vscode.DecorationOptions[]> {
  const decorations: vscode.DecorationOptions[] = [];

  console.log(`Reference Counter: Processing symbol ${symbol.name} (kind: ${symbol.kind})`);

  // Process the symbol itself
  const count = await getReferenceCount(uri, symbol.selectionRange.start);
  console.log(`Reference Counter: Symbol ${symbol.name} has ${count} references`);
  decorations.push(createDecoration(count, symbol.range.start));

  // Process methods if it's a class
  if (symbol.kind === vscode.SymbolKind.Class) {
    const methods = symbol.children.filter(child => child.kind === vscode.SymbolKind.Method);
    console.log(`Reference Counter: Class ${symbol.name} has ${methods.length} methods`);

    for (const method of methods) {
      const methodCount = await getReferenceCount(uri, method.selectionRange.start);
      console.log(`Reference Counter: Method ${method.name} has ${methodCount} references`);
      decorations.push(createDecoration(methodCount, method.range.start));
    }
  }

  return decorations;
}

function createDecoration(count: number, position: vscode.Position): vscode.DecorationOptions {
  const color = count > 0 ? 'gray' : 'red';

  return {
    range: new vscode.Range(position, position),
    renderOptions: {
      after: {
        contentText: `(${count})`,
        color,
      },
    },
  };
}

async function updateDecorations(editor: vscode.TextEditor): Promise<void> {
  try {
    console.log(`Reference Counter: updateDecorations called for ${editor.document.uri.path}`);
    console.log(`Reference Counter: Language ID: ${editor.document.languageId}`);

    if (!SUPPORTED_LANGUAGES.has(editor.document.languageId)) {
      console.log(`Reference Counter: Language ${editor.document.languageId} not supported`);
      return;
    }

    loadExcludePatterns();

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      editor.document.uri
    );

    console.log(`Reference Counter: Found ${symbols?.length || 0} symbols`);

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      console.log('Reference Counter: No symbols found');
      return;
    }

    const decorations = await Promise.all(
      symbols.map(symbol => processSymbol(editor.document.uri, symbol))
    );

    const flatDecorations = decorations.flat();
    console.log(`Reference Counter: Applying ${flatDecorations.length} decorations`);

    editor.setDecorations(decorationType, flatDecorations);
  } catch (error) {
    console.error('Reference Counter: Error updating decorations:', error);
  }
}

export function deactivate() {
  decorationType?.dispose();
}
