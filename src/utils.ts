import * as vscode from "vscode";
import { acceptedLanguages } from "./constants";

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

  return { workspaceFolder, document, editor };
}



export interface DecorationData {
  range: vscode.Range;
  text: string;
  color: string;
}

export function createDecorationOptions(
  data: DecorationData
): vscode.DecorationOptions {
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

export function applyDecorations(
  editor: vscode.TextEditor,
  decorations: vscode.DecorationOptions[]
) {
  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
  currentDecorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(currentDecorationType, decorations);
}

let currentDecorationType: vscode.TextEditorDecorationType | undefined;

export function disposeDecorations() {
  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
}