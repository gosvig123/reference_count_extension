import * as vscode from 'vscode';
import { SymbolManagerClass } from './symbolManager';
import { decorateFile } from './decorateFile';
import { filterReferences, getUniqueFilesFromSymbolRefs } from './utils/utils';
class FileRefCounterClass extends SymbolManagerClass {
    public activeFileSymbolReferences: Map<string, vscode.Location[]> = new Map();
    public excludePatterns: string[] = [];
    public config: vscode.WorkspaceConfiguration;
    public minimalisticDecorations: boolean;
    public decorationType: vscode.TextEditorDecorationType;
    public includeImports: boolean;
    public fileExtensions: string[];
    public decorationUpdateTimeout: NodeJS.Timeout | undefined;
    private readonly DEBOUNCE_DELAY = 500; // ms
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
   // --- Decoration Logic ---
 
   public async updateDecorations(editor: vscode.TextEditor) {
     // Clear any pending update
     if (this.decorationUpdateTimeout) {
       clearTimeout(this.decorationUpdateTimeout);
     }
 
     // Schedule new update with debouncing
     this.decorationUpdateTimeout = setTimeout(async () => {
       await this.performDecorationsUpdate(editor);
     }, this.DEBOUNCE_DELAY);
   }
 
   private async performDecorationsUpdate(editor: vscode.TextEditor) {
     try {
       if (!this.isActiveFileSupported()) {
         return;
       }
       // Use inherited method
       await this.getAndSetSymbolsForActiveFile(editor.document.uri);
       // Use inherited property
       if (!this.activeFileSymbolStore) {
         return;
       }
 
       await this.processSymbols(editor);
 
     } catch (error) {
       console.error('Error in performDecorationsUpdate:', error);
       // Don't rethrow - we want to silently fail for binary files
     }
   }
 
   private async processSymbols(editor: vscode.TextEditor) {
     try {
       // Use inherited method & property
       await this.getAndSetSymbolsForActiveFile(editor.document.uri);
       const { activeFileSymbolStore } = this;
 
       const decorations = await Promise.all(
         Array.from(activeFileSymbolStore.values()).map(symbol =>
           this.processSymbol(editor, symbol)
         )
       );
 
       editor.setDecorations(this.decorationType, decorations.filter(Boolean));
     } catch (error) {
       console.error('Error processing symbols:', error);
     }
   }
 
   private async processSymbol(
     editor: vscode.TextEditor,
     symbol: vscode.DocumentSymbol,
   ): Promise<vscode.DecorationOptions | null> {
     try {
       // Use inherited method
       const references = await this.getSymbolReferences(symbol);
 
       if (!references) return null;
 
       // Use class property and external function
       const filteredReferences = filterReferences(references, this.excludePatterns);
       const referencedFilesCount = getUniqueFilesFromSymbolRefs(filteredReferences, editor);
       const referenceCount = this.calculateReferenceCount(
         filteredReferences,
         referencedFilesCount,
         symbol,
       );
 
       // Use class property
       return decorateFile(referenceCount, symbol.range.start, this.minimalisticDecorations);
     } catch (error) {
       console.error('Error processing single symbol:', error);
       return null;
     }
   }
 
   private calculateReferenceCount(
     filteredReferences: vscode.Location[],
     referencedFilesCount: number,
     symbol: vscode.DocumentSymbol,
   ): number {
     const isMethod = symbol.kind === vscode.SymbolKind.Method;
     
     if (isMethod) {
       return filteredReferences.length;
     }
 
     // Use class property
     return this.includeImports
       ? filteredReferences.length
       : filteredReferences.length - referencedFilesCount;
   }
 
 }


export const fileRefCounter = new FileRefCounterClass();
