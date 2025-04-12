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
    public async getAndSetSymbolsForActiveFile(documentUri: vscode.Uri) {
        console.log(`Getting symbols for file: ${documentUri.fsPath}`);
        this.activeFile = documentUri;
        this.activeFileSymbolStore = new Map();
        this.activeFileSymbolReferences = new Map();

        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                documentUri
            );

            if (!Array.isArray(symbols)) {
                console.log('No symbols found or invalid symbols returned');
                return;
            }

            // Process all symbols including nested ones
            const processSymbols = async (symbolList: vscode.DocumentSymbol[]) => {
                for (const symbol of symbolList) {
                    // Add the symbol to the store
                    this.addSymbol(symbol);

                    // Get references for this symbol
                    const references = await this.getSymbolReferences(symbol);
                    this.activeFileSymbolReferences.set(symbol.name, references);

                    // Process children recursively only if this is a class
                    if (symbol.kind === vscode.SymbolKind.Class && symbol.children && symbol.children.length > 0) {
                        await processSymbols(symbol.children);
                    }
                }
            };

            await processSymbols(symbols);

        } catch (error) {
            console.error(`Error getting symbols for ${documentUri.fsPath}:`, error);
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

