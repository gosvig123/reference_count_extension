import * as vscode from "vscode";
import { UnusedSymbolDescriptor } from "./workspaceSymbolService";

export class UnusedSymbolItem extends vscode.TreeItem {
  constructor(
    public readonly label: string, // This will be the symbol name
    public readonly descriptor: UnusedSymbolDescriptor,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
    const relativePath = vscode.workspace.asRelativePath(descriptor.fileUri);
    this.tooltip = `${relativePath}\nLine: ${descriptor.range.start.line + 1}, Char: ${descriptor.range.start.character + 1}\nKind: ${vscode.SymbolKind[descriptor.kind]}`;
    // Show file name and kind in the description
    this.description = `${relativePath} - ${vscode.SymbolKind[descriptor.kind]}`;

    // Command to execute when the item is clicked: open the file and select the symbol
    this.command = {
      command: "vscode.open",
      title: "Open Symbol Location",
      arguments: [descriptor.fileUri, { selection: descriptor.range }],
    };
    
    // Set the context value for view item context menu contributions
    this.contextValue = 'unusedSymbol';
    
    // Set icon based on symbol kind
    this.iconPath = this.getIconForSymbolKind(descriptor.kind);

  }
  
  private getIconForSymbolKind(kind: vscode.SymbolKind): vscode.ThemeIcon {
    switch (kind) {
      case vscode.SymbolKind.Function:
      case vscode.SymbolKind.Method:
        return new vscode.ThemeIcon('symbol-method');
      case vscode.SymbolKind.Class:
        return new vscode.ThemeIcon('symbol-class');
      case vscode.SymbolKind.Interface:
        return new vscode.ThemeIcon('symbol-interface');
      case vscode.SymbolKind.Variable:
      case vscode.SymbolKind.Constant:
        return new vscode.ThemeIcon('symbol-variable');
      case vscode.SymbolKind.Property:
      case vscode.SymbolKind.Field:
        return new vscode.ThemeIcon('symbol-field');
      case vscode.SymbolKind.Enum:
        return new vscode.ThemeIcon('symbol-enum');
      case vscode.SymbolKind.Struct:
        return new vscode.ThemeIcon('symbol-structure');
      default:
        return new vscode.ThemeIcon('symbol-misc');
    }
  }
}

export class UnusedSymbolsViewProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    UnusedSymbolItem | undefined | null | void
  > = new vscode.EventEmitter<UnusedSymbolItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    UnusedSymbolItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private unusedSymbols: UnusedSymbolDescriptor[] = [];
  private statusMessage: string | undefined =
    "Run 'Find Unused Symbols in Workspace' command to populate.";

  constructor(private context: vscode.ExtensionContext) {}

  refresh(symbols?: UnusedSymbolDescriptor[], message?: string): void {
    if (symbols) {
      this.unusedSymbols = symbols;
      if (symbols.length === 0) {
        this.statusMessage = "No unused symbols found in the workspace.";
      } else {
        this.statusMessage = `Found ${symbols.length} unused symbol${symbols.length === 1 ? '' : 's'}.`;
        
        // Group by file for better context
        const fileCount = new Set(symbols.map(s => s.fileUri.toString())).size;
        if (fileCount > 1) {
          this.statusMessage += ` (in ${fileCount} files)`;
        }
      }
    } else if (message) {
      this.unusedSymbols = []; // Clear symbols if only a message is provided
      this.statusMessage = message;
    } else {
      // Default state or explicit clear
      this.unusedSymbols = [];
      this.statusMessage =
        "Run 'Find Unused Symbols in Workspace' command to populate.";
    }
    
    // Fire event to refresh the entire tree
    this._onDidChangeTreeData.fire();
    
    // Reveal the view when refreshed with meaningful content
    if (symbols && symbols.length > 0) {
      vscode.commands.executeCommand('unusedSymbolsView.focus');
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (element) {
      // If we want to group symbols by file, this is where it would happen.
      // For now, all symbols are direct children of the root.
      return Promise.resolve([]);
    }

    try {
      if (this.unusedSymbols.length > 0) {
        // Sort symbols by file path and then by line number for better organization
        const sortedSymbols = [...this.unusedSymbols].sort((a, b) => {
          const filePathA = a.fileUri.fsPath;
          const filePathB = b.fileUri.fsPath;
          
          if (filePathA !== filePathB) {
            return filePathA.localeCompare(filePathB);
          }
          
          // Same file, sort by line number
          return a.range.start.line - b.range.start.line;
        });
        
        return Promise.resolve(
          sortedSymbols.map(
            (symbol) => new UnusedSymbolItem(symbol.name, symbol),
          ),
        );
      } else if (this.statusMessage) {
        // Display a single message item if there are no symbols or a status needs to be shown
        const messageItem = new vscode.TreeItem(
          this.statusMessage,
          vscode.TreeItemCollapsibleState.None,
        );
        // Make it unclickable or give it a different context value if needed
        messageItem.command = undefined;
        messageItem.contextValue = 'message';
        messageItem.iconPath = this.statusMessage.includes('scanning') || 
                               this.statusMessage.includes('Scanning') ? 
                               new vscode.ThemeIcon('loading~spin') : undefined;
        return Promise.resolve([messageItem]);
      }
    } catch (error) {
      console.error('Error getting children for tree view:', error);
      const errorItem = new vscode.TreeItem(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        vscode.TreeItemCollapsibleState.None
      );
      errorItem.iconPath = new vscode.ThemeIcon('error');
      return Promise.resolve([errorItem]);
    }

    // If no symbols and no status message (e.g., after a clear with no subsequent message)
    return Promise.resolve([]);
  }

  clear(): void {
    this.unusedSymbols = [];
    this.statusMessage =
      "Run 'Find Unused Symbols in Workspace' command to populate.";
    this._onDidChangeTreeData.fire();
  }
  
  // Update status without clearing existing symbols
  updateStatus(message: string): void {
    this.statusMessage = message;
    this._onDidChangeTreeData.fire();
  }
  
  // Helper method to check if we have content
  hasContent(): boolean {
    return this.unusedSymbols.length > 0;
  }
}
