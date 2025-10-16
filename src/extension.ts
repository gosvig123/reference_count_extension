import * as vscode from 'vscode';

const SUPPORTED_LANGUAGES = new Set(['python', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact']);
const DEBOUNCE_DELAY = 300;

let decorationType: vscode.TextEditorDecorationType;
let updateTimeout: NodeJS.Timeout | undefined;
let excludePatterns: RegExp[] = [];
let decorationPosition: 'above' | 'inline' = 'inline';

function updateDecorationType(): void {
  decorationType?.dispose();

  const config = vscode.workspace.getConfiguration('referenceCounter');
  decorationPosition = config.get<'inline' | 'above'>('decorationPosition') || 'inline';

  if (decorationPosition === 'above') {
    decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      before: {
        contentText: '',
        textDecoration: 'none; position: absolute; transform: translateY(-100%);',
      },
    });
  } else {
    decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 0.8em',
        textDecoration: 'none',
      },
    });
  }
}

export async function activate(context: vscode.ExtensionContext) {

  updateDecorationType();

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

  // Update decoration type when configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('referenceCounter.decorationPosition')) {
        console.log('Reference Counter: Decoration position configuration changed');
        updateDecorationType();
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await updateDecorations(editor);
        }
      }
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
  decorations.push(createDecoration(count, symbol.range.start));

  // Process methods if it's a class
  if (symbol.kind === vscode.SymbolKind.Class) {
    const methods = symbol.children.filter(child => child.kind === vscode.SymbolKind.Method);

    for (const method of methods) {
      const methodCount = await getReferenceCount(uri, method.selectionRange.start);
      decorations.push(createDecoration(methodCount, method.range.start));
    }
  }

  return decorations;
}

function createDecoration(count: number, position: vscode.Position): vscode.DecorationOptions {
  const color = count > 0 ? 'gray' : 'red';
  const contentText = `(${count})`;

  if (decorationPosition === 'above') {
    return {
      range: new vscode.Range(position, position),
      renderOptions: {
        before: {
          contentText,
          color,
          textDecoration: `none; position: absolute; transform: translateY(-1.2em);`,
        },
      },
    };
  } else {
    return {
      range: new vscode.Range(position, position),
      renderOptions: {
        after: {
          contentText,
          color,
        },
      },
    };
  }
}

async function updateDecorations(editor: vscode.TextEditor): Promise<void> {
  try {
    if (!SUPPORTED_LANGUAGES.has(editor.document.languageId)) {
      return;
    }

    loadExcludePatterns();

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      editor.document.uri
    );


    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return;
    }

    const decorations = await Promise.all(
      symbols.map(symbol => processSymbol(editor.document.uri, symbol))
    );

    const flatDecorations = decorations.flat();

    editor.setDecorations(decorationType, flatDecorations);
  } catch (error) {
    console.error('Reference Counter: Error updating decorations:', error);
  }
}

export function deactivate() {
  decorationType?.dispose();
}
