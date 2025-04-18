import * as vscode from 'vscode';

/**
 * Centralized configuration manager for the extension
 */
export class ConfigManager {
    private config: vscode.WorkspaceConfiguration;
    
    // Configuration properties
    public fileExtensions: string[];
    public excludePatterns: string[];
    public minimalisticDecorations: boolean;
    public includeImports: boolean;
    public enableUnusedSymbols: boolean;
    
    constructor() {
        this.config = vscode.workspace.getConfiguration('referenceCounter');
        this.loadConfig();
    }
    
    /**
     * Load all configuration values
     */
    public loadConfig(): void {
        this.fileExtensions = this.config.get<string[]>('fileExtensions', ['py', 'js', 'jsx', 'ts', 'tsx']);
        this.excludePatterns = this.config.get<string[]>('excludePatterns', []);
        this.minimalisticDecorations = this.config.get<boolean>('minimalisticDecorations', false);
        this.includeImports = this.config.get<boolean>('includeImports', false);
        this.enableUnusedSymbols = this.config.get<boolean>('enableUnusedSymbols', true);
    }
    
    /**
     * Refresh configuration from workspace settings
     */
    public refresh(): void {
        this.config = vscode.workspace.getConfiguration('referenceCounter');
        this.loadConfig();
    }
    
    /**
     * Check if a file is supported based on its extension
     */
    public isFileSupported(uri: vscode.Uri): boolean {
        const fileExtension = uri.path.split('.').pop()?.toLowerCase() || '';
        return this.fileExtensions.includes(fileExtension);
    }
    
    /**
     * Get file glob pattern for supported files
     */
    public getSupportedFilesPattern(): string {
        return `**/*.{${this.fileExtensions.join(',')}}`;
    }
    
    /**
     * Get exclude glob pattern based on exclude patterns
     */
    public getExcludePattern(): string | null {
        return this.excludePatterns.length > 0
            ? `{${this.excludePatterns.map(p => `**/${p}/**`).join(',')}}`
            : null;
    }
}

// Export a singleton instance
export const configManager = new ConfigManager();
