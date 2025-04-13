import * as vscode from 'vscode';

export function decorateFile(
  refCount: number,
  rangeStart: vscode.Position,
  minimalisticDecorations: boolean
) {
  const displayText = refCount > 0 || minimalisticDecorations ? `(${refCount})` : 'No references';
  const textColor = refCount > 0 ? 'gray' : 'red';

  // Create a position that's guaranteed to be within the document
  const decorationPosition = new vscode.Position(
    Math.max(0, rangeStart.line),
    rangeStart.character
  );

  // Create a zero-width range at the calculated position
  const range = new vscode.Range(decorationPosition, decorationPosition);

  return {
    range,
    renderOptions: {
      after: {
        contentText: displayText,
        color: textColor,
        margin: '0 0 0 1em' // Add some margin to prevent overlap
      },
    },
  };
}
