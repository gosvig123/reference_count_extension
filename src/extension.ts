import * as vscode from "vscode";
import { acceptedLanguages } from "./constants";

import { disposeDecorations, hasValidFiles } from "./utils";
export interface OutlineItem {
  name: string;
  kind: vscode.SymbolKind;
  range: vscode.Range;
  children: OutlineItem[];
}

let outlineDecorationType: vscode.TextEditorDecorationType;

async function showOutline() {
  const validFiles = hasValidFiles();
  if (!validFiles) return;

  const { document, editor } = validFiles;

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    document.uri
  );

  const outlineItems: OutlineItem[] = [];

  if (symbols) {
    for (const symbol of symbols) {
      outlineItems.push(createOutlineItem(symbol));
    }
  }

  // Limit the number of decorations to the visible range
  const visibleRange = editor.visibleRanges[0];
  const visibleLines = visibleRange.end.line - visibleRange.start.line + 1;
  const limitedItems = outlineItems.slice(0, visibleLines);

  const decorations = createOutlineDecorations(limitedItems, editor);
  editor.setDecorations(outlineDecorationType, decorations);

  console.log(`Applied ${decorations.length} outline decorations`);
}

function createOutlineItem(symbol: vscode.DocumentSymbol): OutlineItem {
  return {
    name: symbol.name,
    kind: symbol.kind,
    range: symbol.range,
    children: symbol.children ? symbol.children.map(createOutlineItem) : [],
  };
}

function createOutlineDecorations(
  items: OutlineItem[],
  editor: vscode.TextEditor
): vscode.DecorationOptions[] {
  const decorations: vscode.DecorationOptions[] = [];
  const visibleRange = editor.visibleRanges[0];

  items.forEach((item, index) => {
    const lineIndex = visibleRange.start.line + index;

    if (lineIndex <= visibleRange.end.line) {
      const decoration = {
        range: new vscode.Range(lineIndex, 0, lineIndex, 0),
        renderOptions: {
          after: {
            contentText: item.name,
            color: "rgba(100, 149, 237, 0.7)",
            fontStyle: "italic",
            backgroundColor: "transparent",
            textAlign: "right",
          },
        },
      };
      decorations.push(decoration);
    }
  });

  return decorations;
}
export function activate(context: vscode.ExtensionContext) {
  console.log("Extension activated");

  outlineDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  context.subscriptions.push(outlineDecorationType);

  const disposable = vscode.commands.registerCommand(
    "extension.showOutline",
    debounce(showOutline, 500)
  );

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(onActiveEditorChanged),
    vscode.workspace.onDidChangeTextDocument(onDocumentChanged),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        debounce(showOutline, 100)();
      }
    })
  );

  // Initial call for the current active editor
  onActiveEditorChanged(vscode.window.activeTextEditor);
}
function onActiveEditorChanged(editor: vscode.TextEditor | undefined) {
  if (editor && acceptedLanguages.includes(editor.document.languageId)) {
    debounce(showOutline, 500)();
  }
}

function onDocumentChanged(event: vscode.TextDocumentChangeEvent) {
  const activeEditor = vscode.window.activeTextEditor;
  if (
    activeEditor &&
    event.document === activeEditor.document &&
    acceptedLanguages.includes(event.document.languageId)
  ) {
    debounce(showOutline, 500)();
  }
}

function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: any[]) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function deactivate() {
  disposeDecorations();
}
