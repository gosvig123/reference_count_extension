import * as vscode from "vscode";
import {  acceptedLanguages } from "./constants";
import { hasValidFiles, createDecorationOptions, applyDecorations, DecorationData, disposeDecorations } from "./utils";
import { getFunctionDefinitions } from "./regEx";

async function countDefinitionsAndUsages() {
  const validFiles = hasValidFiles();
  if (!validFiles) {
    return;
  }

  const { document, editor } = validFiles;

  const text = document.getText();
  const languageId = editor.document.languageId;
  const funcDefs = getFunctionDefinitions(languageId, text);

  const definitions = new Map<string, string[]>();
  const usages = new Map<string, number>();

  funcDefs.forEach(funcName => {
    definitions.set(funcName, [document.uri.fsPath]);
    usages.set(funcName, 0);
  });

  const decorationData = createDecorationData(document, languageId, definitions, usages);
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
  const funcDefs = getFunctionDefinitions(languageId, text);

  for (const funcName of funcDefs) {
    const regex = new RegExp(`\\b${funcName}\\b`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + funcName.length);
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