import { UnusedSymbol } from './unusedSymbolsView';

interface FileCacheEntry {
  unusedSymbols: UnusedSymbol[];
  lastAnalyzed: number;
  isProcessing: boolean;
}

class FileCache {
  private cache: Map<string, FileCacheEntry> = new Map();

  /**
   * Update unused symbols for a specific file in the cache
   * @param filePath Path to the file
   * @param symbols Array of unused symbols
   */
  updateUnusedSymbolsForFile(filePath: string, symbols: UnusedSymbol[]): void {
    const entry = this.cache.get(filePath) || { unusedSymbols: [], lastAnalyzed: 0, isProcessing: false };
    entry.unusedSymbols = symbols;
    entry.lastAnalyzed = Date.now(); // Update last analyzed time
    this.cache.set(filePath, entry);
  }

  /**
   * Get all unused symbols from the cache, aggregated from all files
   * @returns Array of all unused symbols
   */
  getAllUnusedSymbols(): UnusedSymbol[] {
    let allSymbols: UnusedSymbol[] = [];
    this.cache.forEach(entry => {
      allSymbols = allSymbols.concat(entry.unusedSymbols);
    });
    return allSymbols;
  }

  /**
   * Remove a file from the cache
   * @param filePath Path to the file
   */
  removeFile(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if a file is currently being processed
   * @param filePath Path to the file
   * @returns True if the file is being processed
   */
  isProcessingFile(filePath: string): boolean {
    return this.cache.get(filePath)?.isProcessing || false;
  }

  /**
   * Mark a file as currently being processed
   * @param filePath Path to the file
   */
  markFileAsProcessing(filePath: string): void {
    const entry = this.cache.get(filePath) || { unusedSymbols: [], lastAnalyzed: 0, isProcessing: false };
    entry.isProcessing = true;
    this.cache.set(filePath, entry);
  }

  /**
   * Mark a file as done processing
   * @param filePath Path to the file
   */
  markFileAsDoneProcessing(filePath: string): void {
    const entry = this.cache.get(filePath);
    if (entry) {
      entry.isProcessing = false;
      // Optionally update lastAnalyzed time here as well if needed
      // entry.lastAnalyzed = Date.now();
      this.cache.set(filePath, entry);
    }
  }

  /**
   * Check if a file should be re-analyzed based on cooldown period
   * @param filePath Path to the file
   * @param cooldown Milliseconds for the cooldown period
   * @returns True if the file should be re-analyzed
   */
  shouldReanalyzeFile(filePath: string, cooldown: number): boolean {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return true; // Never analyzed
    }
    return Date.now() - entry.lastAnalyzed > cooldown;
  }
}

// Export a singleton instance
export const fileCache = new FileCache();