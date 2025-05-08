import * as vscode from 'vscode';


export async function getSymbolsForActiveFile(editor: vscode.TextEditor) {

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        editor.document.uri
    );
    return symbols;
}
