export function getWebviewContent(functions: { name: string; line: number }[]): string {
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
