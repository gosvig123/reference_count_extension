import * as vscode from 'vscode';
import { UnusedSymbol } from './unusedSymbolsView';

/**
 * Cache system for storing unused symbols per file
 */
export class FileCache {
  // Map of file paths to their unused symbols
  private fileUnusedSymbolsMap: Map<string, UnusedSymbol[]> = new Map();
  
  // Map to track when files were last analyzed
  private fileLastAnalyzedMap: Map<string, number> = new Map();
  
  // Set of files that are currently being processed
  private processingFiles: Set<string> = new Set();

  constructor() {}

  /**
   * Get unused symbols for a specific file
   * @param filePath Path to the file
   * @returns Array of unused symbols or undefined if not cached
   */
  getUnusedSymbolsForFile(filePath: string): UnusedSymbol[] | undefined {
    return this.fileUnusedSymbolsMap.get(filePath);
  }

  /**
   * Get all unused symbols across all files
   * @returns Array of all unused symbols
   */
  getAllUnusedSymbols(): UnusedSymbol[] {
    const allSymbols: UnusedSymbol[] = [];
    for (const symbols of this.fileUnusedSymbolsMap.values()) {
      allSymbols.push(...symbols);
    }
    return allSymbols;
  }

  /**
   * Update unused symbols for a specific file
   * @param filePath Path to the file
   * @param symbols Array of unused symbols
   */
  updateUnusedSymbolsForFile(filePath: string, symbols: UnusedSymbol[]): void {
    this.fileUnusedSymbolsMap.set(filePath, symbols);
    this.fileLastAnalyzedMap.set(filePath, Date.now());
  }

  /**
   * Remove a file from the cache
   * @param filePath Path to the file
   */
  removeFile(filePath: string): void {
    this.fileUnusedSymbolsMap.delete(filePath);
    this.fileLastAnalyzedMap.delete(filePath);
  }

  /**
   * Check if a file is in the cache
   * @param filePath Path to the file
   * @returns True if the file is in the cache
   */
  hasFile(filePath: string): boolean {
    return this.fileUnusedSymbolsMap.has(filePath);
  }

  /**
   * Check if a file is currently being processed
   * @param filePath Path to the file
   * @returns True if the file is being processed
   */
  isProcessingFile(filePath: string): boolean {
    return this.processingFiles.has(filePath);
  }

  /**
   * Mark a file as being processed
   * @param filePath Path to the file
   */
  markFileAsProcessing(filePath: string): void {
    this.processingFiles.add(filePath);
  }

  /**
   * Mark a file as done processing
   * @param filePath Path to the file
   */
  markFileAsDoneProcessing(filePath: string): void {
    this.processingFiles.delete(filePath);
  }

  /**
   * Get the time when a file was last analyzed
   * @param filePath Path to the file
   * @returns Timestamp or undefined if not analyzed
   */
  getFileLastAnalyzedTime(filePath: string): number | undefined {
    return this.fileLastAnalyzedMap.get(filePath);
  }

  /**
   * Check if a file needs to be reanalyzed based on a cooldown period
   * @param filePath Path to the file
   * @param cooldownMs Cooldown period in milliseconds
   * @returns True if the file needs to be reanalyzed
   */
  shouldReanalyzeFile(filePath: string, cooldownMs: number): boolean {
    const lastAnalyzed = this.fileLastAnalyzedMap.get(filePath);
    if (lastAnalyzed === undefined) {
      return true;
    }
    return Date.now() - lastAnalyzed > cooldownMs;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.fileUnusedSymbolsMap.clear();
    this.fileLastAnalyzedMap.clear();
    this.processingFiles.clear();
  }
}

// Singleton instance
export const fileCache = new FileCache();
