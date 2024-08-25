import { minimatch } from "minimatch";
import * as vscode from "vscode";
import { acceptedLanguages, excludePatterns } from "./constants";

export function hasValidFiles() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !acceptedLanguages.includes(editor.document.languageId)) {
    return false;
  }

  const document = editor.document;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    return false;
  }

  // Check if the current file is in an excluded directory
  const relativePath = vscode.workspace.asRelativePath(document.uri);
  if (excludePatterns.some((pattern) => minimatch(relativePath, pattern, { dot: true }))) {
    return false;
  }

  return { workspaceFolder, document, editor };
}

export interface DecorationData {
  range: vscode.Range;
  text: string;
  color: string;
}

export function createDecorationOptions(data: DecorationData): vscode.DecorationOptions {
  return {
    range: data.range,
renderOptions: {
      after: {
        contentText: data.text,
        color: data.color,
        fontWeight: "normal",
      },
    },
  };
}

let currentDecorationType: vscode.TextEditorDecorationType;

export function applyDecorations(
  editor: vscode.TextEditor,
  decorations: vscode.DecorationOptions[]
) {
  if (!currentDecorationType) {
    currentDecorationType = vscode.window.createTextEditorDecorationType({});
  }
  editor.setDecorations(currentDecorationType, decorations);
}

export function disposeDecorations() {
  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
}
