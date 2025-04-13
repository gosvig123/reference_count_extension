import * as vscode from 'vscode';
import { SymbolManagerClass } from './symbolManager';
import { decorateFile } from './decorateFile';
import { filterReferences, categorizeReferences } from './utils/utils';
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
     _editor: vscode.TextEditor,
     symbol: vscode.DocumentSymbol,
   ): Promise<vscode.DecorationOptions | null> {
     try {
       const references = await this.getSymbolReferences(symbol);

       if (references.length === 0) return null;

       const filteredReferences = filterReferences(references, this.excludePatterns);
       const { usageReferences } = await categorizeReferences(filteredReferences);

       // Calculate reference count based on our settings
       let referenceCount: number;

       if (this.includeImports) {
         referenceCount = filteredReferences.length;
       } else {
         referenceCount = usageReferences.length;
       }

       // Check if any reference is in the same range as the symbol
       const symbolRange = symbol.range;
       const selfReferenceCount = references.filter(ref => 
         ref.range.start.line === symbolRange.start.line 
       ).length;

       // Deduct self-references from the count
       if (selfReferenceCount > 0) {
        const adjustedReferenceCount = referenceCount - selfReferenceCount;
        referenceCount = Math.max(0, adjustedReferenceCount);
       }

       return decorateFile(referenceCount, symbol.range.start, this.minimalisticDecorations);
     } catch (error) {
       console.error('Error processing single symbol:', error);
       return null;
     }
   }

 }


export const fileRefCounter = new FileRefCounterClass();
