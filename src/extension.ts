import * as vscode from "vscode";

let functionListPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("Congratulations, your extension is now active!");

  let disposable = vscode.commands.registerCommand("extension.showFunctionList", () => {
    if (functionListPanel) {
      functionListPanel.reveal(vscode.ViewColumn.Beside);
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

  // Update the function list when the active editor changes
  vscode.window.onDidChangeActiveTextEditor(updateFunctionList);

  // Update the function list when the document is edited
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === vscode.window.activeTextEditor?.document) {
      updateFunctionList();
    }
  });
}

async function updateFunctionList() {
  if (!functionListPanel) return;

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    functionListPanel.webview.html = "No active editor";
    return;
  }

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    activeEditor.document.uri
  );

  if (!symbols) {
    functionListPanel.webview.html = "No symbols found";
    return;
  }

  const functions: { name: string; line: number }[] = symbols.map((symbol) => ({
    name: symbol.name,
    line: symbol.range.start.line + 1,
  }));

  functionListPanel.webview.html = getWebviewContent(functions);
}

function getWebviewContent(functions: { name: string; line: number }[]): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Function List</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 10px; }
      .function-item { cursor: pointer; padding: 5px; }
      .function-item:hover { background-color: #e0e0e0; }
    </style>
  </head>
  <body class="vscode-body apc-custom-webview">
    <h2>Functions in current file:</h2>
    <div id="function-list">
      ${functions
        .map(
          (f) => `<div class="function-item" data-line="${f.line}">${f.name} (Line ${f.line})</div>`
        )
        .join("")}
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('function-list').addEventListener('click', (event) => {
        const line = event.target.getAttribute('data-line');
        if (line) {
          vscode.postMessage({ command: 'jumpToLine', line: parseInt(line) });
        }
      });
    </script>
  </body>
  </html>`;
}

export function deactivate() {}
