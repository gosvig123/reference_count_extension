import * as vscode from 'vscode';
import { 
  SymbolDescriptor, 
  getDocumentSymbols, 
  filterSymbolsToProcess, 
  shouldExcludeSymbol,
  findReferencesForSymbol,
  filterReferencesByPatterns,
  symbolToDescriptor
} from './utils/symbolUtils';

// Export SymbolDescriptor with a more specific name for this feature
export type UnusedSymbolDescriptor = SymbolDescriptor;

// Helper to convert glob to regex
// This is a simplified version. For full spec compliance, a library like minimatch is better.
function globToRegex(glob: string): RegExp {
    const specialChars = "\\^$.|?*+()[]{}";
    let regexString = "^";
    for (let i = 0; i < glob.length; ++i) {
        const char = glob[i];
        if (char === '*') {
            if (glob[i + 1] === '*') {
                // '**' matches any sequence of characters, including directory separators
                regexString += ".*";
                i++; // Skip the second '*'
            } else {
                // '*' matches any sequence of characters except directory separators
                regexString += "[^/]*";
            }
        } else if (char === '?') {
            // '?' matches any single character except directory separators
            regexString += "[^/]";
        } else if (specialChars.includes(char)) {
            // Escape special regex characters
            regexString += "\\" + char;
        } else {
            regexString += char;
        }
    }
    regexString += "$";
    return new RegExp(regexString);
}


export async function findUnusedSymbolsInWorkspace(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<UnusedSymbolDescriptor[]> {
  const unusedSymbols: UnusedSymbolDescriptor[] = [];
  const config = vscode.workspace.getConfiguration('referenceCounter');
  const validFileExtensions = config.get<string[]>('validFileExtensions') || [];
  const excludePatternsConfig = config.get<string[]>('excludePatterns') || [];

  if (validFileExtensions.length === 0) {
    vscode.window.showWarningMessage('No valid file extensions configured. Please set "referenceCounter.validFileExtensions".');
    return [];
  }

  // For vscode.workspace.findFiles, the exclude patterns should be robust.
  // Default exclude patterns like "**/node_modules/**" are handled well by findFiles.
  const findFilesExcludeGlob = excludePatternsConfig.length > 0 
    ? `{${excludePatternsConfig.join(',')}}` 
    : null;

  const includeGlob = `**/*.{${validFileExtensions.join(',')}}`;
  
  const files = await vscode.workspace.findFiles(includeGlob, findFilesExcludeGlob, undefined, token);
  const totalFiles = files.length;
  progress.report({ message: `Scanning ${totalFiles} files...`, increment: 0 });

  const workspaceFolders = vscode.workspace.workspaceFolders;
  // Fallback to empty string if no workspace folder is open (though less likely for this kind of operation)
  const workspaceRootPath = (workspaceFolders && workspaceFolders.length > 0) ? workspaceFolders[0].uri.path : '';


  for (let i = 0; i < totalFiles; i++) {
    if (token.isCancellationRequested) {
      return unusedSymbols;
    }
    const fileUri = files[i];
    const relativePath = vscode.workspace.asRelativePath(fileUri);
    progress.report({ message: `Processing ${relativePath} (${i + 1}/${totalFiles})`, increment: (1 / totalFiles) * 100 });

    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      if (!validFileExtensions.some(ext => document.fileName.endsWith(`.${ext}`))) {
        continue;
      }

      // Get document symbols using shared utility
      const topLevelSymbols = await getDocumentSymbols(fileUri);
      // Filter with shared logic
      const filteredSymbols = filterSymbolsToProcess(topLevelSymbols);

      for (const symbol of filteredSymbols) {
        if (token.isCancellationRequested) {
          return unusedSymbols;
        }

        // Use shared utility to check if symbol should be excluded
        if (shouldExcludeSymbol(symbol.name)) {
          continue;
        }

        // Find references using shared utility
        const references = await findReferencesForSymbol(
          document.uri, 
          symbol.selectionRange.start,
          true // Include declaration
        );
        
        // Filter out the declaration itself
        let actualReferences = references.filter(ref => 
            !(ref.uri.toString() === document.uri.toString() && ref.range.isEqual(symbol.selectionRange))
        );

        // Use path-specific filtering logic for references
        const filteredReferences = actualReferences.filter(ref => {
          const absoluteRefPath = ref.uri.path; 
        
          return !excludePatternsConfig.some(pattern => {
            let pathToCheck = absoluteRefPath;
            let isPatternRelative = !(pattern.startsWith('/') || /^[a-zA-Z]:\\/.test(pattern)); // Basic check for absolute pattern
            
            if (workspaceRootPath && isPatternRelative && absoluteRefPath.startsWith(workspaceRootPath)) {
              pathToCheck = absoluteRefPath.substring(workspaceRootPath.length);
              if (pathToCheck.startsWith('/')) {
                pathToCheck = pathToCheck.substring(1);
              }
            } 
            // If pattern is absolute or path isn't in workspace, pathToCheck remains absolute.

            try {
              const regex = globToRegex(pattern);
              if (regex.test(pathToCheck)) {
                return true; // Path matches an exclude pattern
              }
            } catch (e) {
              console.warn(`Invalid regex from glob pattern for reference filtering: ${pattern}`, e);
              // Fallback for simple non-glob string containment if regex fails or pattern isn't a glob.
              // This is less reliable for file paths than glob matching.
              if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('**')) {
                if (pathToCheck.includes(pattern)) {
                     return true; 
                }
              }
            }
            return false; 
          });
        });
        
        if (filteredReferences.length === 0) {
          // Use shared utility to convert symbol to descriptor
          unusedSymbols.push(symbolToDescriptor(symbol, document.uri));
        }
      }
    } catch (error) {
      console.error(`Error processing file ${relativePath}:`, error);
    }
  }

  progress.report({ message: 'Scan complete.', increment: 100 });
  return unusedSymbols;
}