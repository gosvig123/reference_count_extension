import * as vscode from 'vscode';
import * as path from 'path';
import { fileCache } from './fileCache';

export class UnusedSymbol extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath: string,
    public readonly range: vscode.Range,
    public readonly kind: vscode.SymbolKind
  ) {
    super(label, collapsibleState);
    this.tooltip = `${label} - ${filePath}`;
    this.description = path.basename(filePath);

    // Set icon based on symbol kind
    if (kind === vscode.SymbolKind.Function) {
      this.iconPath = new vscode.ThemeIcon('symbol-function');
    } else if (kind === vscode.SymbolKind.Method) {
      this.iconPath = new vscode.ThemeIcon('symbol-method');
    } else if (kind === vscode.SymbolKind.Class) {
      this.iconPath = new vscode.ThemeIcon('symbol-class');
    }

    this.command = {
      command: 'vscode.open',
      arguments: [vscode.Uri.file(filePath), { selection: range }],
      title: 'Go to Symbol'
    };
  }
}

export class UnusedSymbolsProvider implements vscode.TreeDataProvider<UnusedSymbol> {
  private _onDidChangeTreeData: vscode.EventEmitter<UnusedSymbol | undefined | null | void> = new vscode.EventEmitter<UnusedSymbol | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<UnusedSymbol | undefined | null | void> = this._onDidChangeTreeData.event;

  private unusedSymbols: UnusedSymbol[] = [];

  constructor() {}

  /**
   * Refresh the entire tree view with a new set of unused symbols
   * @param unusedSymbols Array of unused symbols
   */
  refresh(unusedSymbols: UnusedSymbol[]): void {
    this.unusedSymbols = unusedSymbols;
    this._onDidChangeTreeData.fire();
  }
  // Method updateFileSymbols removed as it's no longer used.

  /**
   * Remove a file's symbols from the view
   * @param filePath Path to the file
   */
  removeFileSymbols(filePath: string): void {
    // Only remove the file from the cache, do not trigger a view refresh.
    // The view should only be refreshed by a full workspace scan.
    console.log(`Provider removeFileSymbols called for ${filePath}. Removing from cache only.`); // Log for debugging
    fileCache.removeFile(filePath);
    // Removed this.refreshFromCache();
  }

  getTreeItem(element: UnusedSymbol): vscode.TreeItem {
    return element;
  }

  getChildren(element?: UnusedSymbol): Thenable<UnusedSymbol[]> {
    if (element) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this.unusedSymbols);
  }
}
