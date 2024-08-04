import * as vscode from "vscode";
import { countDefinitions, countUsages } from "./countLogic";
let currentDecorationType: vscode.TextEditorDecorationType | undefined;

async function countDefinitionsAndUsages() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "python") {
    console.log("Not a Python file, skipping");
    return;
  }

  console.log("Processing Python file");
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

  const pythonFiles = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, "**/*.py"),
    `{${excludePatterns.join(",")}}`
  );
  console.log(`Found ${pythonFiles.length} Python files`);

  const functionDefinitions = await countDefinitions(pythonFiles);
  const functionUsages = await countUsages(pythonFiles, functionDefinitions);

  const decorations: vscode.DecorationOptions[] = [];
  const text = document.getText();
  const funcDefRegex = /def\s+(\w+)\s*\(/g;
  let match;

  while ((match = funcDefRegex.exec(text)) !== null) {
    const funcName = match[1];
    const startPos = document.positionAt(match.index + 4);
    const endPos = document.positionAt(match.index + 4 + funcName.length);
    const range = new vscode.Range(startPos, endPos);

    const definitionCount = functionDefinitions.get(funcName)?.length || 0;
    const usageCount = functionUsages.get(funcName) || 0;

    let decorationText: string;
    let hoverMessage: string;

    if (definitionCount > 1) {
      decorationText = " Duplicate definition ";
      hoverMessage = `Warning: ${definitionCount} definitions found`;
    } else {
      decorationText = `  (${usageCount})`;
      hoverMessage = `Used in: ${usageCount} place(s)`;
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

  console.log(`Created ${decorations.length} decorations`);

  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
  currentDecorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(currentDecorationType, decorations);
  console.log("Decorations applied");
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
      if (editor && editor.document.languageId === "python") {
        countDefinitionsAndUsages();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      console.log("Document changed");
      if (
        event.document === vscode.window.activeTextEditor?.document &&
        event.document.languageId === "python"
      ) {
        countDefinitionsAndUsages();
      }
    })
  );

  if (
    vscode.window.activeTextEditor &&
    vscode.window.activeTextEditor.document.languageId === "python"
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