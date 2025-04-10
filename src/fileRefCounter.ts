import * as vscode from 'vscode';


class FileRefCounter {
    constructor() {
        this.symbolStore = new Map();
    }
    public symbolStore: Map<string, vscode.DocumentSymbol> = new Map();

    
    
}
