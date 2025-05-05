/**
 * Mock implementation of the vscode module for testing
 */

export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
    constructor(
        public readonly start: Position,
        public readonly end: Position
    ) {}

    contains(range: Range): boolean {
        return this.start.line <= range.start.line && 
               this.end.line >= range.end.line;
    }
}

export class Location {
    constructor(
        public readonly uri: Uri,
        public readonly range: Range
    ) {}
}

export class Uri {
    public readonly scheme: string;
    public readonly path: string;
    public readonly fsPath: string;

    private constructor(fsPath: string) {
        this.scheme = 'file';
        this.path = fsPath;
        this.fsPath = fsPath;
    }

    static file(fsPath: string): Uri {
        return new Uri(fsPath);
    }
}

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}

export class DocumentSymbol {
    constructor(
        public readonly name: string,
        public readonly detail: string,
        public readonly kind: SymbolKind,
        public readonly range: Range,
        public readonly selectionRange: Range,
        public readonly children: DocumentSymbol[] = []
    ) {}
}

export class TextEditorDecorationType {
    constructor(public readonly key: string) {}
    dispose(): void {}
}

export class TextEditor {
    constructor(public readonly document: TextDocument) {}
    setDecorations(decorationType: TextEditorDecorationType, ranges: Range[]): void {}
}

export class TextDocument {
    constructor(public readonly uri: Uri, public readonly languageId: string, public readonly version: number, public readonly text: string) {}
    
    lineAt(line: number): { text: string } {
        const lines = this.text.split('\n');
        return { text: lines[line] || '' };
    }
    
    getText(): string {
        return this.text;
    }
}

export const workspace = {
    getConfiguration: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        update: jest.fn(),
        has: jest.fn()
    })),
    openTextDocument: jest.fn().mockImplementation(async (uri: Uri) => {
        return new TextDocument(uri, 'plaintext', 1, '');
    }),
    onDidChangeConfiguration: jest.fn().mockImplementation(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: jest.fn().mockImplementation(() => ({ dispose: jest.fn() })),
    onDidChangeTextDocument: jest.fn().mockImplementation(() => ({ dispose: jest.fn() }))
};

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createTextEditorDecorationType: jest.fn().mockImplementation((options) => new TextEditorDecorationType('mock-decoration')),
    onDidChangeActiveTextEditor: jest.fn().mockImplementation(() => ({ dispose: jest.fn() }))
};

export const commands = {
    executeCommand: jest.fn().mockImplementation(async () => []),
    registerCommand: jest.fn().mockImplementation(() => ({ dispose: jest.fn() }))
};

export const Disposable = {
    from: jest.fn().mockImplementation((...disposables: { dispose: () => any }[]) => ({
        dispose: jest.fn()
    }))
};

export class EventEmitter<T> {
    private listeners: ((e: T) => any)[] = [];
    
    event(listener: (e: T) => any): { dispose: () => void } {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index !== -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    }
    
    fire(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }
}

// Mock the rest of the vscode API as needed for your tests
