import * as vscode from 'vscode';
import { SymbolManagerClass } from './symbolManager';

class FileRefCounterClass extends SymbolManagerClass {
    public activeFileSymbolReferences: Map<string, vscode.Location[]> = new Map();
    public excludePatterns: string[] = [];
    public config: vscode.WorkspaceConfiguration;
    public minimalisticDecorations: boolean;
    public decorationType: vscode.TextEditorDecorationType;
    public includeImports: boolean;
    constructor() {
        super();
        this.activeFileSymbolReferences = new Map();
        this.config = vscode.workspace.getConfiguration('referenceCounter');
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

    public filterReferences(references: vscode.Location[], excludePatterns: string[]): vscode.Location[] {
        return references.filter(reference => {
            const refPath = reference.uri.path;
            return !excludePatterns.some(pattern =>
              new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
            );
        });
    }
    
}

export const fileRefCounter = new FileRefCounterClass();
