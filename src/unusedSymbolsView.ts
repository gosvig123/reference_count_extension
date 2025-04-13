import * as vscode from 'vscode';
import { workspaceSymbolManager } from './workspaceSymbolManager';

// Tree item to represent an unused symbol
export class UnusedSymbolItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly symbol: vscode.DocumentSymbol,
    public readonly uri: vscode.Uri
  ) {
    super(label, collapsibleState);

    // Set the command that is executed when the item is clicked
    this.command = {
      command: 'vscode.open',
      arguments: [uri, { selection: symbol.selectionRange }],
      title: 'Open File'
    };

    // Set the tooltip to show the file path
    this.tooltip = `${uri.fsPath}`;

    // Set the description to show the symbol kind
    this.description = vscode.SymbolKind[symbol.kind];

    // Set the icon based on the symbol kind
    switch (symbol.kind) {
      case vscode.SymbolKind.Function:
        this.iconPath = new vscode.ThemeIcon('symbol-function');
        break;
      case vscode.SymbolKind.Method:
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        break;
      case vscode.SymbolKind.Class:
        this.iconPath = new vscode.ThemeIcon('symbol-class');
        break;
      default:
        this.iconPath = new vscode.ThemeIcon('symbol-misc');
    }
  }

  // Context value for the tree item (used for context menu filtering)
  contextValue = 'unusedSymbol';
}

// Tree data provider for unused symbols
export class UnusedSymbolsProvider implements vscode.TreeDataProvider<UnusedSymbolItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<UnusedSymbolItem | undefined | null | void> = new vscode.EventEmitter<UnusedSymbolItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<UnusedSymbolItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private cachedItems: UnusedSymbolItem[] = [];
  private isLoading: boolean = false;

  constructor() {
    console.log('UnusedSymbolsProvider initialized');
  }

  refresh(): void {
    console.log('Refreshing tree view');
    this.cachedItems = []; // Clear cache
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: UnusedSymbolItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: UnusedSymbolItem): Promise<UnusedSymbolItem[]> {
    if (element) {
      return []; // No child items for now
    } else {
      // Show loading indicator
      if (this.isLoading) {
        return [this.createLoadingItem()];
      }

      // Use cached items if available
      if (this.cachedItems.length > 0) {
        console.log(`Returning ${this.cachedItems.length} cached items`);
        return this.cachedItems;
      }

      try {
        this.isLoading = true;
        console.log('Fetching unused symbols...');

        // Get unused symbols from the workspace symbol manager
        const unusedSymbols = await workspaceSymbolManager.getUnusedSymbols();
        console.log(`Found ${unusedSymbols.length} unused symbols`);

        if (!unusedSymbols || unusedSymbols.length === 0) {
          this.cachedItems = [this.createNoUnusedSymbolsItem()];
          return this.cachedItems;
        }

        // Create tree items for each unused symbol
        this.cachedItems = unusedSymbols.map(item => {
          return new UnusedSymbolItem(
            item.symbol.name,
            vscode.TreeItemCollapsibleState.None,
            item.symbol,
            item.uri
          );
        });

        return this.cachedItems;
      } catch (error) {
        console.error('Error getting unused symbols:', error);
        return [this.createErrorItem()];
      } finally {
        this.isLoading = false;
      }
    }
  }

  private createLoadingItem(): UnusedSymbolItem {
    const item = new vscode.TreeItem('Loading...');
    item.iconPath = new vscode.ThemeIcon('loading~spin');
    return item as UnusedSymbolItem;
  }

  private createNoUnusedSymbolsItem(): UnusedSymbolItem {
    const item = new vscode.TreeItem('No unused symbols found');
    item.iconPath = new vscode.ThemeIcon('check');
    return item as UnusedSymbolItem;
  }

  private createErrorItem(): UnusedSymbolItem {
    const item = new vscode.TreeItem('Error loading unused symbols');
    item.iconPath = new vscode.ThemeIcon('error');
    return item as UnusedSymbolItem;
  }
}
