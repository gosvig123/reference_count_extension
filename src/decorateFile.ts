import * as vscode from 'vscode';

export function decorateFile(refCount: number, rangeStart: vscode.Position) {
  const finalRefCount = refCount > 0 ? refCount - 1 : refCount;
  const displayText = finalRefCount > 0 ? `(${finalRefCount})` : 'No references';
  const textColor = finalRefCount > 0 ? 'gray' : 'red';

  return {
    range: new vscode.Range(rangeStart, rangeStart),
    renderOptions: {
      after: {
        contentText: displayText,
        color: textColor,
      },
    },
  };
}
