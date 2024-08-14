import * as vscode from "vscode";
import { countDefinitions, countUsages } from "./countLogic";
import { excludePatterns, acceptedLanguages, fileExtensions } from "./constants";
import { hasValidFiles, createDecorationOptions, applyDecorations, DecorationData, disposeDecorations } from "./utils";

async function countDefinitionsAndUsages() {
  const validFiles = hasValidFiles();
  if (!validFiles) {
    return;
  }

  const { workspaceFolder, document, editor } = validFiles;

  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, `**/*.{${fileExtensions.join(",")}}`),
    `{${excludePatterns.join(",")}}`
  );

  const functionDefinitions = await countDefinitions(files);
  const functionUsages = await countUsages(files, functionDefinitions);

  const decorationData = createDecorationData(document, editor.document.languageId, functionDefinitions, functionUsages);
  const decorations = decorationData.map(createDecorationOptions);

  applyDecorations(editor, decorations);
}

function createDecorationData(
  document: vscode.TextDocument,
  languageId: string,
  functionDefinitions: Map<string, string[]>,
  functionUsages: Map<string, number>
): DecorationData[] {
  const decorationData: DecorationData[] = [];
  const text = document.getText();
  const funcDefRegex = getFunctionDefinitionRegex(languageId);
  let match;

  while ((match = funcDefRegex.exec(text)) !== null) {
    const funcName = match[1] || match[2] || match[3];
    if (funcName) {
      const startPos = document.positionAt(match.index + match[0].indexOf(funcName));
      const endPos = document.positionAt(startPos.character + funcName.length);
      const range = new vscode.Range(startPos, endPos);

      const definitionCount = functionDefinitions.get(funcName)?.length || 0;
      const usageCount = functionUsages.get(funcName) || 0;

      const text = definitionCount > 1 ? " Duplicate definition " : usageCount > 0 ? `  (${usageCount})` : "No usages";
      const color = definitionCount > 1 ? "rgba(255, 165, 0, 0.9)" : "rgba(65, 105, 225, 0.9)";

      decorationData.push({ range, text, color });
    }
  }

  return decorationData;
}

export function getFunctionDefinitionRegex(languageId: string): RegExp {
  switch (languageId) {
    case "python":
      return /def\s+(\w+)\s*\(/g;
    case "javascript":
    case "typescript":
    case "javascriptreact":
    case "typescriptreact":
      return /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>|async\s*(?:function|\([^)]*\)\s*=>))|(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>|\b(\w+)\s*:\s*(?:function|\([^)]*\)\s*=>)|(?:class\s+(\w+)|const\s+(\w+)\s*=\s*class)|(?:const|let|var)\s+(\w+)\s*=\s*React\.(?:memo|forwardRef)\()/g;
    default:
      return /(?:)/g; // Empty regex for unsupported file types
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Extension activated");

  let disposable = vscode.commands.registerCommand(
    "extension.countDefinitionsAndUsages",
    countDefinitionsAndUsages
  );

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && acceptedLanguages.includes(editor.document.languageId)) {
        countDefinitionsAndUsages();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        event.document === vscode.window.activeTextEditor?.document &&
        acceptedLanguages.includes(event.document.languageId)
      ) {
        countDefinitionsAndUsages();
      }
    })
  );

  if (
    vscode.window.activeTextEditor &&
    acceptedLanguages.includes(vscode.window.activeTextEditor.document.languageId)
  ) {
    countDefinitionsAndUsages();
  }
}

export function deactivate() {
  disposeDecorations();
}