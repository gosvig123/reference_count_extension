import * as vscode from 'vscode';
import { getAndSetSymbolsForDocument } from './getAndSetSymbolsForDocument';

const DEBOUNCE_DELAY = 500; // ms
let decorationUpdateTimeout: NodeJS.Timeout | undefined;

export async function updateDecorations(editor: vscode.TextEditor) {
    // Clear any pending update
    if (decorationUpdateTimeout) {
      clearTimeout(decorationUpdateTimeout);
    }
  
    // Schedule new update with debouncing
    decorationUpdateTimeout = setTimeout(async () => {
      await getAndSetSymbolsForDocument(editor);
    }, DEBOUNCE_DELAY);
  }
