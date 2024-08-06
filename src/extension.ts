import * as vscode from "vscode";
import { countDefinitions, countUsages } from "./countLogic";
let currentDecorationType: vscode.TextEditorDecorationType | undefined;

async function countDefinitionsAndUsages() {
  const editor = vscode.window.activeTextEditor;
  if (
    !editor ||
    ![
      "python",
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
    ].includes(editor.document.languageId)
  ) {
    console.log("Not a supported file type, skipping");
    return;
  }

  console.log(`Processing ${editor.document.languageId} file`);
  const document = editor.document;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    console.log("No workspace folder found");
    return;
  }

  const excludePatterns = [
    "**/venv/**",
    "**/env/**",
    "**/.venv/**",
    "**/node_modules/**",
    "**/site-packages/**",
    "**/lib/**",
    "**/libs/**",
    "**/build/**",
    "**/dist/**",
  ];

  const fileExtensions = ["py", "js", "ts", "jsx", "tsx"];
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(
      workspaceFolder,
      `**/*.{${fileExtensions.join(",")}}`
    ),
    `{${excludePatterns.join(",")}}`
  );
  console.log(`Found ${files.length} files`);

  const functionDefinitions = await countDefinitions(files);
  const functionUsages = await countUsages(files, functionDefinitions);

  const decorations: vscode.DecorationOptions[] = [];
  const text = document.getText();
  const funcDefRegex = getFunctionDefinitionRegex(editor.document.languageId);
  let match;

  while ((match = funcDefRegex.exec(text)) !== null) {
    const funcName = match[1] || match[2] || match[3];
    if (funcName) {
      const startPos = document.positionAt(
        match.index + match[0].indexOf(funcName)
      );
      const endPos = document.positionAt(startPos.character + funcName.length);
      const range = new vscode.Range(startPos, endPos);

      const definitionCount = functionDefinitions.get(funcName)?.length || 0;
      const usageCount = functionUsages.get(funcName) || 0;

      let decorationText: string;
      let hoverMessage: string;

      if (definitionCount > 1) {
        decorationText = " Duplicate definition ";
        hoverMessage = `Warning: ${definitionCount} definitions found`;
      } else {
        decorationText = usageCount > 0 ? `  (${usageCount})` : "No usages";
        hoverMessage =
          usageCount > 0 ? `Used in ${usageCount} place(s)` : "No usage found";
      }

      console.log(
        `Decorating function: ${funcName} at line ${
          startPos.line + 1
        }, ${hoverMessage}`
      );

      decorations.push({
        range,
        hoverMessage,
        renderOptions: {
          after: {
            contentText: decorationText,
            color:
              definitionCount > 1
                ? "rgba(255, 165, 0, 0.7)"
                : "rgba(65, 105, 225, 0.7)",
            fontWeight: "normal",
          },
        },
      });
    }
  }

  console.log(`Created ${decorations.length} decorations`);

  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
  currentDecorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(currentDecorationType, decorations);
  console.log("Decorations applied");
}

export function getFunctionDefinitionRegex(languageId: string): RegExp {
  switch (languageId) {
    case "python":
      return /def\s+(\w+)\s*\(/g;
    case "javascript":
    case "typescript":
    case "javascriptreact":
    case "typescriptreact":
      return /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>|async\s*(?:function|\([^)]*\)\s*=>))|(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>|\b(\w+)\s*:\s*(?:function|\([^)]*\)\s*=>)|(?:class\s+(\w+)|const\s+(\w+)\s*=\s*class))/g;
    default:
      return /(?:)/g; // Empty regex for unsupported file types
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Extension activated");

  let disposable = vscode.commands.registerCommand(
    "extension.countDefinitionsAndUsages",
    () => {
      console.log("Command triggered");
      countDefinitionsAndUsages();
    }
  );

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log("Active editor changed");
      if (
        editor &&
        [
          "python",
          "javascript",
          "typescript",
          "javascriptreact",
          "typescriptreact",
        ].includes(editor.document.languageId)
      ) {
        countDefinitionsAndUsages();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      console.log("Document changed");
      if (
        event.document === vscode.window.activeTextEditor?.document &&
        [
          "python",
          "javascript",
          "typescript",
          "javascriptreact",
          "typescriptreact",
        ].includes(event.document.languageId)
      ) {
        countDefinitionsAndUsages();
      }
    })
  );

  if (
    vscode.window.activeTextEditor &&
    [
      "python",
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
    ].includes(vscode.window.activeTextEditor.document.languageId)
  ) {
    console.log("Initial count triggered");
    countDefinitionsAndUsages();
  }
}

export function deactivate() {
  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
}