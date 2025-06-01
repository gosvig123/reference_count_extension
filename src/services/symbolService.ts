import * as vscode from 'vscode';

export interface SymbolDescriptor {
  name: string;
  kind: vscode.SymbolKind;
  location: vscode.Location;
  fileUri: vscode.Uri;
  range: vscode.Range;
}

export interface ReferenceCountResult {
  count: number;
  filteredReferences: vscode.Location[];
}

export class SymbolService {
  private static instance: SymbolService;

  public static getInstance(): SymbolService {
    if (!SymbolService.instance) {
      SymbolService.instance = new SymbolService();
    }
    return SymbolService.instance;
  }

  /**
   * Get document symbols with filtering for relevant symbol types
   */
  async getDocumentSymbols(fileUri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
    try {
      const rawSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        fileUri
      ) || [];

      return this.filterSymbolsForProcessing(rawSymbols);
    } catch (error) {
      console.error(`Error getting symbols for ${vscode.workspace.asRelativePath(fileUri)}:`, error);
      return [];
    }
  }

  /**
   * Filter symbols to include top-level symbols and class methods
   * Based on the logic from getAndSetSymbolsForDocument.ts
   */
  private filterSymbolsForProcessing(rawSymbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
    const symbolsToProcess: vscode.DocumentSymbol[] = [];
    const processedSymbolStarts = new Set<string>();

    for (const symbol of rawSymbols) {
      // Skip private symbols (starting with _)
      if (symbol.name.startsWith('_')) continue;

      const symbolStartKey = `${symbol.selectionRange.start.line}:${symbol.selectionRange.start.character}`;
      if (!processedSymbolStarts.has(symbolStartKey)) {
        symbolsToProcess.push(symbol);
        processedSymbolStarts.add(symbolStartKey);

        // If it's a class, add its methods
        if (symbol.kind === vscode.SymbolKind.Class) {
          for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
            const methodStartKey = `${method.selectionRange.start.line}:${method.selectionRange.start.character}`;
            if (!processedSymbolStarts.has(methodStartKey) && !method.name.startsWith('_')) {
              symbolsToProcess.push(method);
              processedSymbolStarts.add(methodStartKey);
            }
          }
        }
      }
    }

    return symbolsToProcess;
  }

  /**
   * Get references for a symbol with exclusion filtering
   */
  async getSymbolReferences(
    fileUri: vscode.Uri,
    position: vscode.Position,
    includeDeclaration: boolean = false
  ): Promise<vscode.Location[]> {
    try {
      const references = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        fileUri,
        position,
        { includeDeclaration }
      ) || [];

      return this.filterExcludedReferences(references);
    } catch (error) {
      console.error(`Error getting references for symbol at ${fileUri}:${position.line}:${position.character}:`, error);
      return [];
    }
  }

  /**
   * Filter references based on exclude patterns from configuration
   */
  private filterExcludedReferences(references: vscode.Location[]): vscode.Location[] {
    const config = vscode.workspace.getConfiguration('referenceCounter');
    const excludePatterns = config.get<string[]>('excludePatterns') || [];

    if (excludePatterns.length === 0) return references;

    return references.filter(ref => {
      const refPath = ref.uri.path;
      return !excludePatterns.some(pattern => {
        const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
        return new RegExp(regexPattern).test(refPath);
      });
    });
  }

  /**
   * Count references for inline display (matches original getAndSetSymbolsForDocument logic)
   */
  async countReferencesForInlineDisplay(
    fileUri: vscode.Uri,
    position: vscode.Position
  ): Promise<ReferenceCountResult> {
    // Original logic: includeDeclaration: false for inline display
    const filteredReferences = await this.getSymbolReferences(fileUri, position, false);
    const config = vscode.workspace.getConfiguration('referenceCounter');
    const includeImports = config.get<boolean>('includeImports') || false;

    let refCount = 0;
    if (filteredReferences.length > 0) {
      if (includeImports) {
        refCount = filteredReferences.length;
      } else {
        // Subtract imports by deducting unique file paths (one import per file)
        const uniqueFilePaths = new Set(filteredReferences.map(ref => ref.uri.path));
        refCount = filteredReferences.length - (uniqueFilePaths.size - 1);
      }
    }

    // Apply the original inline display logic: subtract 1 if refCount > 0
    const finalRefCount = refCount > 0 ? refCount - 1 : refCount;

    return {
      count: finalRefCount,
      filteredReferences
    };
  }

  /**
   * Check if symbol is unused (matches original workspaceSymbolService logic)
   */
  async isSymbolUnused(
    fileUri: vscode.Uri,
    position: vscode.Position
  ): Promise<boolean> {
    // Original logic: includeDeclaration: true for unused detection
    const references = await this.getSymbolReferences(fileUri, position, true);
    // If only the declaration exists (no other references)
    return references.length <= 1;
  }

  /**
   * Check if file type is supported
   */
  isFileTypeSupported(fileUri: vscode.Uri): boolean {
    const config = vscode.workspace.getConfiguration('referenceCounter');
    const validFileExtensions = config.get<string[]>('validFileExtensions') || [];
    const fileExtension = fileUri.path.split('.').pop() || '';

    return validFileExtensions.includes(fileExtension);
  }

  /**
   * Get all files in workspace that match valid extensions, excluding configured patterns
   */
  async getWorkspaceFiles(): Promise<vscode.Uri[]> {
    const config = vscode.workspace.getConfiguration('referenceCounter');
    const validFileExtensions = config.get<string[]>('validFileExtensions') || [];
    const excludePatterns = config.get<string[]>('excludePatterns') || [];

    if (validFileExtensions.length === 0) {
      return [];
    }

    // Create include pattern for file extensions
    const includePattern = `**/*.{${validFileExtensions.join(',')}}`;

    // Convert exclude patterns to a format suitable for vscode.workspace.findFiles
    // This ensures we don't scan into virtual environments, node_modules, etc.
    const excludePattern = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : undefined;

    const files = await vscode.workspace.findFiles(includePattern, excludePattern);

    // Log the first few files for debugging (can be removed later)
    if (files.length > 0) {
      console.log(`Found ${files.length} workspace files. First few:`,
        files.slice(0, 5).map(f => vscode.workspace.asRelativePath(f)));
    }

    return files;
  }

  /**
   * Find unused symbols in workspace with progress reporting
   */
  async findUnusedSymbolsInWorkspace(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
  ): Promise<SymbolDescriptor[]> {
    const unusedSymbols: SymbolDescriptor[] = [];
    const files = await this.getWorkspaceFiles();

    if (files.length === 0) {
      vscode.window.showWarningMessage('No valid file extensions configured.');
      return [];
    }

    progress.report({ message: `Scanning ${files.length} files...` });

    for (let i = 0; i < files.length; i++) {
      if (token.isCancellationRequested) return unusedSymbols;

      const fileUri = files[i];
      progress.report({
        message: `Processing ${vscode.workspace.asRelativePath(fileUri)}`,
        increment: (1 / files.length) * 100
      });

      const symbols = await this.getDocumentSymbols(fileUri);

      for (const symbol of symbols) {
        if (token.isCancellationRequested) return unusedSymbols;

        const isUnused = await this.isSymbolUnused(fileUri, symbol.selectionRange.start);

        if (isUnused) {
          unusedSymbols.push({
            name: symbol.name,
            kind: symbol.kind,
            location: new vscode.Location(fileUri, symbol.selectionRange),
            fileUri,
            range: symbol.selectionRange
          });
        }
      }
    }

    return unusedSymbols;
  }
}
