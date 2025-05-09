import * as vscode from 'vscode';


export function shouldProcessDocument(editor: vscode.TextEditor) {
    const config = vscode.workspace.getConfiguration('referenceCounter');
    const validFileExtensions = config.get<string[]>('validFileExtensions') || [];
    const fileExtension = editor.document.uri.path.split('.').pop() || '';
    return validFileExtensions.includes(fileExtension);
}

export function getConfig(editor: vscode.TextEditor) {
    const config = vscode.workspace.getConfiguration('referenceCounter');
    const validFileExtensions = config.get<string[]>('validFileExtensions') || [];
    const includeImports = config.get<boolean>('includeImports') || false;
    const minimalisticDecorations = config.get<boolean>('minimalisticDecorations') || false;
    const excludePatterns = config.get<string[]>('excludePatterns') || [];
    const isValidFile = shouldProcessDocument(editor);
    return { validFileExtensions, includeImports, minimalisticDecorations, excludePatterns, isValidFile };
}