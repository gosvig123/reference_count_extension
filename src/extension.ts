import * as vscode from "vscode";
import { getWebviewContent } from "./webview";
let functionListPanel: vscode.WebviewPanel | undefined;
let decorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
  console.log("Activating extension");
  // Initialize decorationType
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: "0 0 0 0.5em",
      textDecoration: "none",
    },
  });

  let disposable = vscode.commands.registerCommand("extension.showFunctionList", () => {
    if (functionListPanel) {
      functionListPanel.reveal(vscode.ViewColumn.Active);
    } else {
      functionListPanel = vscode.window.createWebviewPanel(
        "functionList",
        "Function List",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );
      updateFunctionList();
      functionListPanel.onDidDispose(
        () => {
          functionListPanel = undefined;
        },
        null,
        context.subscriptions
      );
    }
  });
  context.subscriptions.push(disposable);
  // Update decorations for the current active editor
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log("Active editor changed");
      if (editor) {
        updateDecorations(editor);
      }
    })
  );

  // Update when the document is edited
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      console.log("Document changed");
      if (event.document === vscode.window.activeTextEditor?.document) {
        updateDecorations(vscode.window.activeTextEditor);
      }
    })
  );
}

async function updateFunctionList() {
  if (!functionListPanel) return;
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    functionListPanel.webview.html = "No active editor";
    return;
  }

  const symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand<
    vscode.DocumentSymbol[]
  >("vscode.executeDocumentSymbolProvider", activeEditor.document.uri);

  if (!symbols) {
    functionListPanel.webview.html = "No symbols found";
    return;
  }

  const functions: { name: string; line: number }[] = [];

  for (const symbol of symbols) {
    functions.push({
      name: symbol.name,
      line: symbol.range.start.line + 1,
    });
  }

  functionListPanel.webview.html = getWebviewContent(functions);

  if (symbols) {
    await updateDecorations(activeEditor);
  }
}

//TODO split into decoration and ref count logic
async function updateDecorations(editor: vscode.TextEditor) {
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    editor.document.uri
  );


  if (!symbols) {
    console.log("No symbols found");
    return;
  }

  const decorations: vscode.DecorationOptions[] = [];

  for (const symbol of symbols) {
    const symbolReferences = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeReferenceProvider",
      editor.document.uri,
      symbol.range.start
    );

    let exports = 0;
    let references = 0;

    if (symbolReferences) {
      for (const ref of symbolReferences) {
        const refLine = editor.document.lineAt(ref.range.start.line).text.trim();

        if (refLine.includes("export") || refLine.includes(`export ${symbol.name}`)) {
          exports++;
        } else {
          references++;
        }
      }
    }
    const finalRefCount = references > 0 ? references - 1 : references;
    const displayText = finalRefCount > 0 ? `(${finalRefCount})` : "No references";
    const textColor = finalRefCount > 0 ? "gray" : "red";
    const decoration: vscode.DecorationOptions = {
      range: new vscode.Range(symbol.range.start, symbol.range.start),
      renderOptions: {
        after: {
          contentText: displayText,
          color: textColor,
        },
      },
    };

    decorations.push(decoration);
  }

  editor.setDecorations(decorationType, decorations);
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }
}
