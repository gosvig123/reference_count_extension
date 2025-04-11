import * as vscode from 'vscode';
import { SymbolManagerClass } from './symbolManager';


class FileRefCounterClass extends SymbolManagerClass {
    public activeFileSymbolReferences: Map<string, vscode.Location[]> = new Map();
    public excludePatterns: string[] = [];
    public config: vscode.WorkspaceConfiguration;
    public minimalisticDecorations: boolean;
    public decorationType: vscode.TextEditorDecorationType;
    public includeImports: boolean;
    public fileExtensions: string[];
    constructor() {
        super();
        this.activeFileSymbolReferences = new Map();
        this.config = vscode.workspace.getConfiguration('referenceCounter');
        this.fileExtensions = this.config.get<string[]>('fileExtensions') || [];
        this.excludePatterns = this.config.get<string[]>('excludePatterns') || [];
        this.minimalisticDecorations = this.config.get<boolean>('minimalisticDecorations') || false;
        this.includeImports = this.config.get<boolean>('includeImports') || false;
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: this.minimalisticDecorations ? '0' : '0 0 0 0.5em',
                textDecoration: 'none',
            },
        });
    }
   public isActiveFileSupported() {
    const fileExtension = vscode.window.activeTextEditor?.document.uri.path.split('.').pop()?.toLowerCase() || '';
    return this.fileExtensions.includes(fileExtension);
   }
 
}

export const fileRefCounter = new FileRefCounterClass();
