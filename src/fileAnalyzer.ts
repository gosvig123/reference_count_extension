import * as vscode from 'vscode';
import { UnusedSymbol } from './unusedSymbolsView';

// Removed analyzeFileForUnusedSymbols function as it's no longer directly called
// The workspace scan function handles analysis internally.

/**
 * Check if a file extension is supported
 * @param filePath Path to the file
 * @returns True if the file extension is supported
 */
export function isSupportedFileType(filePath: string): boolean {
  const acceptedExtensions = ['py', 'js', 'jsx', 'ts', 'tsx'];
  const fileExtension = filePath.split('.').pop() || '';
  return acceptedExtensions.includes(fileExtension);
}

/**
 * Check if a file should be excluded based on exclude patterns
 * @param filePath Path to the file
 * @param excludePatterns Patterns to exclude
 * @returns True if the file should be excluded
 */
export function shouldExcludeFile(filePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern =>
    new RegExp(pattern.replace(/\*/g, '.*')).test(filePath)
  );
}
