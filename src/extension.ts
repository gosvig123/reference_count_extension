import * as vscode from 'vscode';
import { decorateFile } from './decorateFile';
import { UnusedSymbol, UnusedSymbolsProvider } from './unusedSymbolsView';
import { fileCache } from './fileCache';
import { isSupportedFileType, shouldExcludeFile } from './fileAnalyzer'; // Removed analyzeFileForUnusedSymbols import
let decorationType: vscode.TextEditorDecorationType;

// Add debounce function to prevent too-frequent updates
let decorationUpdateTimeout: NodeJS.Timeout | undefined;
let unusedSymbolsUpdateTimeout: NodeJS.Timeout | undefined;
const DEBOUNCE_DELAY = 500; // ms
// Use config values for delays, provide defaults
// const UNUSED_SYMBOLS_DEBOUNCE_DELAY = 1000; // ms - Will get from config
// const FILE_ANALYSIS_COOLDOWN = 5000; // ms - Will get from config

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating extension');

  const config = vscode.workspace.getConfiguration('referenceCounter');
  const minimalisticDecorations = config.get<boolean>('minimalisticDecorations', false);
  const enableDynamicUpdates = config.get<boolean>('enableDynamicUnusedSymbolUpdates', false);
  const dynamicUpdateDelay = config.get<number>('dynamicUpdateDelay', 1000);
  const fileAnalysisCooldown = config.get<number>('fileAnalysisCooldown', 5000);

  // Initialize decorationType
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: minimalisticDecorations ? '0' : '0 0 0 0.5em',
      textDecoration: 'none',
    },
  });
  // Update decorations for the current active editor
  if (vscode.window.activeTextEditor) {
    await updateDecorations(vscode.window.activeTextEditor);
  }

  // Update when the active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      console.log('Active editor changed');
      if (editor) {
        await updateDecorations(editor);
      }
    }),
  );

  // Update when the document is edited
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      console.log('Document changed');
      if (event.document === vscode.window.activeTextEditor?.document) {
        await updateDecorations(vscode.window.activeTextEditor);
      }
    }),
  );

  // Register the unused symbols provider
  const unusedSymbolsProvider = new UnusedSymbolsProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('unusedSymbolsView', unusedSymbolsProvider)
  );

  // Register the command to find unused symbols in the entire workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('css-class-counter.findUnusedSymbols', async () => {
      await findUnusedSymbols(unusedSymbolsProvider);
    })
  );
  // Command registration for 'findUnusedSymbolsInCurrentFile' was removed.

  // Conditionally add listeners for dynamic updates
  if (enableDynamicUpdates) {
    console.log('Dynamic unused symbol updates enabled.');
    // Listen for document changes to update unused symbols dynamically
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(async (event) => {
        // Only update for supported file types
        // Trigger full workspace scan on change if dynamic updates are enabled
        if (isSupportedFileType(event.document.uri.fsPath)) {
          // Call the debounced scan function
          triggerDebouncedWorkspaceScan(unusedSymbolsProvider, dynamicUpdateDelay);
        }
      })
    );

    // Listen for document saves to update unused symbols
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        // Only update for supported file types
        // Trigger full workspace scan on save if dynamic updates are enabled
        if (isSupportedFileType(document.uri.fsPath)) {
          // Force update on save by triggering scan immediately (or use debounce)
          // Let's stick to debouncing for consistency, save often triggers change anyway
          // Call the debounced scan function
          triggerDebouncedWorkspaceScan(unusedSymbolsProvider, dynamicUpdateDelay);
        }
      })
    );

    // Listen for document close to clean up cache
    context.subscriptions.push(
      vscode.workspace.onDidCloseTextDocument(async (document) => {
        // Only update for supported file types
        if (isSupportedFileType(document.uri.fsPath)) {
          // Remove the file from the cache when it's closed
          unusedSymbolsProvider.removeFileSymbols(document.uri.fsPath);
        }
      })
    );
  } else {
    console.log('Dynamic unused symbol updates disabled.');
  }

}

async function updateDecorations(editor: vscode.TextEditor) {
  // Clear any pending update
  if (decorationUpdateTimeout) {
    clearTimeout(decorationUpdateTimeout);
  }

  // Schedule new update with debouncing
  decorationUpdateTimeout = setTimeout(async () => {
    await performDecorationsUpdate(editor);
  }, DEBOUNCE_DELAY);
}

async function performDecorationsUpdate(editor: vscode.TextEditor) {
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const excludePatterns = config.get<string[]>('excludePatterns') || [];
  const includeImports = config.get<boolean>('includeImports') || false;
  const minimalisticDecorations = config.get<boolean>('minimalisticDecorations') || false;

  const acceptedExtensions = new Set(['py', 'js', 'jsx', 'ts', 'tsx']);
  const fileExtension = editor.document.uri.path.split('.').pop() || '';

  if (!acceptedExtensions.has(fileExtension)) {
    console.log('File type not supported');
    return;
  }

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    editor.document.uri,
  );

  if (!symbols || symbols.length === 0) {
    console.log('No symbols found');
    return;
  }

  // Gather all symbols that need references in a flat array
  const symbolsToProcess: Array<vscode.DocumentSymbol> = [];

  for (const symbol of symbols) {
    symbolsToProcess.push(symbol);

    // If it's a class, add its methods
    if (symbol.kind === vscode.SymbolKind.Class) {
      for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
        symbolsToProcess.push(method);
      }
    }
  }

  // Process all symbols in a single batch to reduce overhead
  const decorations = await Promise.all(
    symbolsToProcess.map(async (symbol) => {
      const references = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeReferenceProvider',
        editor.document.uri,
        symbol.selectionRange.start,
        { includeDeclaration: false },
      );

      // Filter out excluded references
      const filteredReferences = references?.filter(reference => {
        const refPath = reference.uri.path;
        return !excludePatterns.some(pattern =>
          new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
        );
      });

      const referencedFilesCount = getReferencedFiles(filteredReferences, editor);
      const isMethod = symbol.kind === vscode.SymbolKind.Method;

      let referenceCount = filteredReferences
        ? includeImports
          ? filteredReferences.length
          : filteredReferences.length - referencedFilesCount
        : 0;

      if (isMethod) {
        referenceCount = filteredReferences.length
      }

      return decorateFile(referenceCount, symbol.range.start, minimalisticDecorations);
    })
  );

  editor.setDecorations(decorationType, decorations);
}

// Optimize the getReferencedFiles function
function getReferencedFiles(references: vscode.Location[] | undefined, editor: vscode.TextEditor): number {
  if (!references || references.length === 0) return 0;

  // Use a Set for efficient unique tracking
  const uniqueFiles = new Set<string>();
  const currentFile = editor.document.uri.path.split('/').pop() || '';

  for (const reference of references) {
    const filename = reference.uri.path.split('/').pop() || '';
    if (filename !== currentFile) {
      uniqueFiles.add(filename);
    }
  }

  return uniqueFiles.size;
}

async function findUnusedSymbols(unusedSymbolsProvider: UnusedSymbolsProvider) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Finding unused workspace symbols...', // Slightly more generic title
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ increment: 0 });

      // Clear the cache before a full workspace scan
      fileCache.clear();

      // Get all files in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
      }

      const config = vscode.workspace.getConfiguration('referenceCounter');
      const excludePatterns = config.get<string[]>('excludePatterns') || [];

      // Get all files with supported extensions
      const acceptedExtensions = ['py', 'js', 'jsx', 'ts', 'tsx'];
      const filePattern = `**/*.{${acceptedExtensions.join(',')}}`;
      const files = await vscode.workspace.findFiles(filePattern, '{**/node_modules/**,**/venv/**,**/.git/**}');

      console.log(`Found ${files.length} files with supported extensions`);

      // Filter out files that match exclude patterns
      const filteredFiles = files.filter(file => {
        // Use the dedicated function for exclusion check
        return !shouldExcludeFile(file.fsPath, excludePatterns);
      });

      console.log(`After filtering, processing ${filteredFiles.length} files`);

      const totalFiles = filteredFiles.length;
      let processedFiles = 0;
      const allUnusedSymbols: UnusedSymbol[] = [];
      const unusedSymbolsByFile: Map<string, UnusedSymbol[]> = new Map();
      let totalSymbolsFound = 0;

      // Process each file
      for (const file of filteredFiles) {
        if (token.isCancellationRequested) {
          break;
        }

        try {
          // Open the document to ensure the symbol provider works correctly
          await vscode.workspace.openTextDocument(file);

          // Get document symbols
          const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            file
          );

          if (symbols && symbols.length > 0) {
            // Process symbols in the file
            const symbolsToProcess: Array<{ symbol: vscode.DocumentSymbol, parent?: vscode.DocumentSymbol }> = [];

            // Collect all functions, methods, and classes
            for (const symbol of symbols) {
              if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Class) {
                symbolsToProcess.push({ symbol });
              }

              // If it's a class, add its methods
              if (symbol.kind === vscode.SymbolKind.Class) {
                for (const method of symbol.children.filter(child => child.kind === vscode.SymbolKind.Method)) {
                  symbolsToProcess.push({ symbol: method, parent: symbol });
                }
              }
            }

            totalSymbolsFound += symbolsToProcess.length;
            console.log(`Found ${symbolsToProcess.length} symbols in ${file.fsPath}`);

            // Check references for each symbol
            for (const { symbol, parent } of symbolsToProcess) {
              try {
                // Get references with includeDeclaration set to true to get all references
                // We'll manually filter out the declaration later
                const references = await vscode.commands.executeCommand<vscode.Location[]>(
                  'vscode.executeReferenceProvider',
                  file,
                  symbol.selectionRange.start,
                  { includeDeclaration: true }
                );

                // Filter out excluded references and the declaration itself
                const filteredReferences = references?.filter(reference => {
                  // Skip the declaration (which is at the same position as the symbol)
                  if (reference.uri.fsPath === file.fsPath &&
                      reference.range.start.line === symbol.selectionRange.start.line &&
                      reference.range.start.character === symbol.selectionRange.start.character) {
                    return false;
                  }

                  const refPath = reference.uri.path;
                  return !excludePatterns.some(pattern =>
                    new RegExp(pattern.replace(/\*/g, '.*')).test(refPath)
                  );
                });

                console.log(`Symbol ${symbol.name}: Found ${references?.length || 0} references, ${filteredReferences?.length || 0} after filtering`);

                // If no references after filtering, add to unused symbols
                if (!filteredReferences || filteredReferences.length === 0) {
                  let label = symbol.name;
                  if (parent) {
                    label = `${parent.name}.${symbol.name}`;
                  }

                  const unusedSymbol = new UnusedSymbol(
                    label,
                    vscode.TreeItemCollapsibleState.None,
                    file.fsPath,
                    symbol.range,
                    symbol.kind
                  );
                  allUnusedSymbols.push(unusedSymbol);

                  // Add to the map for caching later
                  if (!unusedSymbolsByFile.has(file.fsPath)) {
                    unusedSymbolsByFile.set(file.fsPath, []);
                  }
                  unusedSymbolsByFile.get(file.fsPath)?.push(unusedSymbol);
                }
              } catch (err) {
                console.error(`Error processing symbol ${symbol.name}:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`Error processing file ${file.fsPath}:`, err);
        }

        processedFiles++;
        progress.report({ increment: (100 / totalFiles), message: `Processed ${processedFiles} of ${totalFiles} files` });
      }

      console.log(`Total symbols found: ${totalSymbolsFound}, Unused symbols: ${allUnusedSymbols.length}`);

      // Update the file cache with the results from the scan
      unusedSymbolsByFile.forEach((symbols, filePath) => {
        fileCache.updateUnusedSymbolsForFile(filePath, symbols);
      });

      // Update the tree view with all unused symbols found
      unusedSymbolsProvider.refresh(allUnusedSymbols);

      if (allUnusedSymbols.length > 0) {
        vscode.window.showInformationMessage(`Found ${allUnusedSymbols.length} unused symbols in the workspace.`);
      } else {
        vscode.window.showInformationMessage('No unused symbols found in the workspace.');
      }

      // After a full scan, refresh the view from the cache
    }
  );
}

/**
 * Triggers a debounced full workspace scan for unused symbols.
 * @param unusedSymbolsProvider The provider instance.
 * @param delay Debounce delay in ms.
 */
function triggerDebouncedWorkspaceScan(unusedSymbolsProvider: UnusedSymbolsProvider, delay: number) {
  // Clear any pending scan
  if (unusedSymbolsUpdateTimeout) {
    clearTimeout(unusedSymbolsUpdateTimeout);
  }

  // Schedule new scan
  console.log(`Scheduling workspace scan in ${delay}ms due to file change/save.`);
  unusedSymbolsUpdateTimeout = setTimeout(async () => {
    console.log('Debounce triggered: Starting workspace scan for unused symbols.');
    // It's important findUnusedSymbols handles its own progress and errors
    await findUnusedSymbols(unusedSymbolsProvider);
  }, delay);
}


// Function findUnusedSymbolsInCurrentFile removed

export function deactivate() {
  if (decorationType) {
    decorationType.dispose();
  }

  // Clear any pending timeouts
  if (decorationUpdateTimeout) {
    clearTimeout(decorationUpdateTimeout);
  }
  if (unusedSymbolsUpdateTimeout) {
    clearTimeout(unusedSymbolsUpdateTimeout);
  }

}
