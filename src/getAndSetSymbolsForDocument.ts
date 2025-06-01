import * as vscode from 'vscode';
import { SymbolService } from './services/symbolService';

// Global decoration type - reused across the extension
let decorationType: vscode.TextEditorDecorationType | undefined;

function getDecorationType(): vscode.TextEditorDecorationType {
  const minimalisticDecorations = vscode.workspace.getConfiguration('referenceCounter').get<boolean>('minimalisticDecorations') || false;

  if (!decorationType) {
    decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: minimalisticDecorations ? '0' : '0 0 0 0.5em',
        textDecoration: 'none',
      },
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }
  return decorationType;
}

export function disposeDecorationType(): void {
  if (decorationType) {
    decorationType.dispose();
    decorationType = undefined;
  }
}

async function generateDecorationForSymbol(
  symbol: vscode.DocumentSymbol,
  editor: vscode.TextEditor
): Promise<vscode.DecorationOptions> {
  const symbolService = SymbolService.getInstance();

  // Use the inline display method that matches original logic
  const refResult = await symbolService.countReferencesForInlineDisplay(
    editor.document.uri,
    symbol.selectionRange.start
  );

  // Create decoration
  const minimalisticDecorations = vscode.workspace.getConfiguration('referenceCounter').get<boolean>('minimalisticDecorations') || false;
  const displayText = refResult.count > 0 || minimalisticDecorations ? `(${refResult.count})` : 'No references';
  const textColor = refResult.count > 0 ? 'gray' : 'red';

  return {
    range: new vscode.Range(symbol.selectionRange.start, symbol.selectionRange.start),
    renderOptions: {
      after: {
        contentText: displayText,
        color: textColor,
      },
    },
  };
}

export async function getAndSetSymbolsForDocument(editor: vscode.TextEditor) {
  const symbolService = SymbolService.getInstance();

  // Check if file type is supported
  if (!symbolService.isFileTypeSupported(editor.document.uri)) {
    editor.setDecorations(getDecorationType(), []);
    return;
  }

  // Get document symbols using unified service
  const symbolsToProcess = await symbolService.getDocumentSymbols(editor.document.uri);

  if (symbolsToProcess.length === 0) {
    editor.setDecorations(getDecorationType(), []);
    return;
  }

  // Generate decorations for all symbols
  const decorations = await Promise.all(
    symbolsToProcess.map(symbol => generateDecorationForSymbol(symbol, editor))
  );

  editor.setDecorations(getDecorationType(), decorations);
}
