import * as vscode from 'vscode';
import { ErrorHandler } from './utils/errorHandling';

/**
 * Configuration defaults
 */
export const CONFIG_DEFAULTS = {
    fileExtensions: ['py', 'js', 'jsx', 'ts', 'tsx'],
    excludePatterns: ['node_modules', '.next', 'dist', 'build', 'out', '.git', 'coverage'],
    minimalisticDecorations: true,
    includeImports: false,
    enableUnusedSymbols: true
};

/**
 * Configuration keys
 */
export enum ConfigKey {
    FILE_EXTENSIONS = 'fileExtensions',
    EXCLUDE_PATTERNS = 'excludePatterns',
    MINIMALISTIC_DECORATIONS = 'minimalisticDecorations',
    INCLUDE_IMPORTS = 'includeImports',
    ENABLE_UNUSED_SYMBOLS = 'enableUnusedSymbols'
}

/**
 * Configuration interface
 */
export interface IExtensionConfig {
    fileExtensions: string[];
    excludePatterns: string[];
    minimalisticDecorations: boolean;
    includeImports: boolean;
    enableUnusedSymbols: boolean;
}

/**
 * Centralized configuration manager for the extension
 */
export class ConfigManager implements IExtensionConfig {
    private readonly CONFIG_PREFIX = 'referenceCounter';
    private config: vscode.WorkspaceConfiguration;
    private _changeListeners: Array<(config: IExtensionConfig) => void> = [];
    
    // Configuration property backing fields
    private _fileExtensions: string[] = CONFIG_DEFAULTS.fileExtensions;
    private _excludePatterns: string[] = CONFIG_DEFAULTS.excludePatterns;
    private _minimalisticDecorations: boolean = CONFIG_DEFAULTS.minimalisticDecorations;
    private _includeImports: boolean = CONFIG_DEFAULTS.includeImports;
    private _enableUnusedSymbols: boolean = CONFIG_DEFAULTS.enableUnusedSymbols;
    
    constructor() {
        this.config = vscode.workspace.getConfiguration(this.CONFIG_PREFIX);
        this.loadConfig();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(this.CONFIG_PREFIX)) {
                this.refresh();
            }
        });
    }
    
    /**
     * Add a configuration change listener
     */
    public onConfigChanged(listener: (config: IExtensionConfig) => void): vscode.Disposable {
        this._changeListeners.push(listener);
        
        // Return a disposable to remove the listener
        return {
            dispose: () => {
                const index = this._changeListeners.indexOf(listener);
                if (index >= 0) {
                    this._changeListeners.splice(index, 1);
                }
            }
        };
    }
    
    /**
     * Load all configuration values
     */
    public loadConfig(): void {
        try {
            this._fileExtensions = this.getConfigValue<string[]>(
                ConfigKey.FILE_EXTENSIONS, 
                CONFIG_DEFAULTS.fileExtensions
            );
            
            this._excludePatterns = this.getConfigValue<string[]>(
                ConfigKey.EXCLUDE_PATTERNS, 
                CONFIG_DEFAULTS.excludePatterns
            );
            
            this._minimalisticDecorations = this.getConfigValue<boolean>(
                ConfigKey.MINIMALISTIC_DECORATIONS, 
                CONFIG_DEFAULTS.minimalisticDecorations
            );
            
            this._includeImports = this.getConfigValue<boolean>(
                ConfigKey.INCLUDE_IMPORTS, 
                CONFIG_DEFAULTS.includeImports
            );
            
            this._enableUnusedSymbols = this.getConfigValue<boolean>(
                ConfigKey.ENABLE_UNUSED_SYMBOLS, 
                CONFIG_DEFAULTS.enableUnusedSymbols
            );
            
            ErrorHandler.info('Configuration loaded successfully', 'ConfigManager');
        } catch (error) {
            ErrorHandler.error('Error loading configuration', error, 'ConfigManager');
            this.resetToDefaults();
        }
    }
    
    /**
     * Reset configuration to defaults
     */
    private resetToDefaults(): void {
        this._fileExtensions = CONFIG_DEFAULTS.fileExtensions;
        this._excludePatterns = CONFIG_DEFAULTS.excludePatterns;
        this._minimalisticDecorations = CONFIG_DEFAULTS.minimalisticDecorations;
        this._includeImports = CONFIG_DEFAULTS.includeImports;
        this._enableUnusedSymbols = CONFIG_DEFAULTS.enableUnusedSymbols;
        
        ErrorHandler.warn('Configuration reset to defaults due to error', null, 'ConfigManager', true);
    }
    
    /**
     * Refresh configuration from workspace settings
     */
    public refresh(): void {
        try {
            this.config = vscode.workspace.getConfiguration(this.CONFIG_PREFIX);
            
            // Store the old values
            const oldConfig = this.toObject();
            
            // Load the new values
            this.loadConfig();
            
            // Check if includeImports setting has changed
            const importSettingChanged = oldConfig.includeImports !== this._includeImports;
            
            // Notify listeners (with flag indicating if includeImports changed)
            this.notifyListeners(importSettingChanged);
            
            ErrorHandler.info('Configuration refreshed', 'ConfigManager');
        } catch (error) {
            ErrorHandler.error('Error refreshing configuration', error, 'ConfigManager');
        }
    }
    
    /**
     * Get a configuration value with type safety
     */
    private getConfigValue<T>(key: string, defaultValue: T): T {
        try {
            const value = this.config.get<T>(key);
            return value !== undefined ? value : defaultValue;
        } catch (error) {
            ErrorHandler.error(`Error getting config value for key: ${key}`, error, 'ConfigManager');
            return defaultValue;
        }
    }
    
    /**
     * Notify configuration change listeners
     * @param importSettingChanged Flag indicating if the includeImports setting has changed
     */
    private notifyListeners(importSettingChanged: boolean = false): void {
        const configObject = this.toObject();
        
        // Add metadata about the import setting change
        (configObject as any)['_importSettingChanged'] = importSettingChanged;
        
        // Clear related caches if import setting changed
        if (importSettingChanged) {
            try {
                const { clearImportLineCache } = require('./utils/utils');
                clearImportLineCache();
                ErrorHandler.info('Cleared import line cache due to setting change', 'ConfigManager');
            } catch (error) {
                ErrorHandler.error('Error clearing import line cache', error, 'ConfigManager');
            }
        }
        
        for (const listener of this._changeListeners) {
            try {
                listener(configObject);
            } catch (error) {
                ErrorHandler.error('Error in configuration change listener', error, 'ConfigManager');
            }
        }
    }
    
    /**
     * Convert configuration to a simple object
     */
    private toObject(): IExtensionConfig {
        return {
            fileExtensions: this._fileExtensions,
            excludePatterns: this._excludePatterns,
            minimalisticDecorations: this._minimalisticDecorations,
            includeImports: this._includeImports,
            enableUnusedSymbols: this._enableUnusedSymbols
        };
    }
    
    /**
     * Check if a file is supported based on its extension
     */
    public isFileSupported(uri: vscode.Uri): boolean {
        try {
            const fileExtension = uri.path.split('.').pop()?.toLowerCase() || '';
            return this._fileExtensions.includes(fileExtension);
        } catch (error) {
            ErrorHandler.error(`Error checking if file is supported: ${uri.fsPath}`, error, 'ConfigManager');
            return false;
        }
    }
    
    /**
     * Get file glob pattern for supported files
     */
    public getSupportedFilesPattern(): string {
        try {
            return `**/*.{${this._fileExtensions.join(',')}}`;
        } catch (error) {
            ErrorHandler.error('Error creating supported files pattern', error, 'ConfigManager');
            return `**/*.{${CONFIG_DEFAULTS.fileExtensions.join(',')}}`;
        }
    }
    
    /**
     * Get exclude glob pattern based on exclude patterns
     */
    public getExcludePattern(): string | null {
        try {
            return this._excludePatterns.length > 0
                ? `{${this._excludePatterns.map(p => `**/${p}/**`).join(',')}}`
                : null;
        } catch (error) {
            ErrorHandler.error('Error creating exclude pattern', error, 'ConfigManager');
            return null;
        }
    }
    
    // Property getters
    get fileExtensions(): string[] {
        return this._fileExtensions;
    }
    
    get excludePatterns(): string[] {
        return this._excludePatterns;
    }
    
    get minimalisticDecorations(): boolean {
        return this._minimalisticDecorations;
    }
    
    get includeImports(): boolean {
        return this._includeImports;
    }
    
    get enableUnusedSymbols(): boolean {
        return this._enableUnusedSymbols;
    }
}

// Export a singleton instance
export const configManager = new ConfigManager();