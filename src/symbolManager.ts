import * as vscode from 'vscode';


export class SymbolManagerClass {

    constructor() {
        this.activeFile = null;
        this.activeFileSymbolStore = new Map();
        this.activeFileSymbolReferences = new Map();
    }

    public activeFile: vscode.Uri | null = null;
    public activeFileSymbolStore: Map<string, vscode.DocumentSymbol> = new Map();
    public activeFileSymbolReferences: Map<string, vscode.Location[]> = new Map();
    public activeEditor: vscode.TextEditor | null = null;
    public async getAndSetSymbolsForActiveFile(documentUri: vscode.Uri) {
        this.activeFile = documentUri;
this.activeFileSymbolStore = new Map();
        this.activeFileSymbolReferences = new Map();

        const symbols = await vscode.commands.executeCommand(
            'vscode.executeDocumentSymbolProvider',
            documentUri
        );
        if (Array.isArray(symbols)) {
            symbols.map(async (symbol: vscode.DocumentSymbol) => {
                // map the symbol then add it to the symbol store
                this.addSymbol(symbol);
                this.activeFileSymbolReferences.set(symbol.name, await this.getSymbolReferences(symbol));

                // check if it's a class and add its methods to the symbol store
                if (symbol.kind === vscode.SymbolKind.Class) {
                    symbol.children.forEach(async (child) => {
                        this.addSymbol(child);
                        this.activeFileSymbolReferences.set(child.name, await this.getSymbolReferences(child));
                    });
                }
            });
        }


    }

    public async getSymbolReferences(symbol: vscode.DocumentSymbol) {
        const activeEditor = vscode.window.activeTextEditor;
        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            activeEditor?.document.uri,
            symbol.selectionRange.start,
            { includeDeclaration: false },
        );
        return references;
    }

    public addSymbol(symbol: vscode.DocumentSymbol) {
        if (this.activeFile) {
            this.activeFileSymbolStore.set(symbol.name, symbol);
        }
    }

    
}

export const symbolManager = new SymbolManagerClass();

