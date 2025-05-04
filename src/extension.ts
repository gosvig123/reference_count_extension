import * as vscode from 'vscode';
import { symbolManager } from './services/symbolManager';
import { ErrorHandler } from './utils/errorHandling';
import { DecorationService } from './services/decorationService';
import { FileWatchService } from './services/fileWatchService';
import { ConfigWatchService } from './services/configWatchService';
import { UnusedSymbolsService } from './services/unusedSymbolsService';

/**
 * This method is called when the extension is activated.
 * It initializes all services based on dependency injection principles.
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        ErrorHandler.info('Activating Reference Counter extension', 'Extension');
        
        // Create services with appropriate dependencies
        // Each service is responsible for a specific area of functionality
        
        // Services for editor interactions
        const decorationService = new DecorationService(symbolManager);
        decorationService.initialize(context);
        
        // Services for file and workspace operations
        const fileWatchService = new FileWatchService(symbolManager, symbolManager);
        fileWatchService.initialize(context);
        
        // Services for configuration 
        const configWatchService = new ConfigWatchService(symbolManager, symbolManager);
        configWatchService.initialize(context);
        
        // Service for the unused symbols view and command
        const unusedSymbolsService = new UnusedSymbolsService(symbolManager);
        const unusedSymbolsDisposables = unusedSymbolsService.initialize();
        context.subscriptions.push(...unusedSymbolsDisposables);
        
        ErrorHandler.info('Reference Counter extension activated successfully', 'Extension');
    } catch (error) {
        ErrorHandler.critical('Failed to activate extension', error, 'Extension', true);
    }
}

/**
 * This method is called when the extension is deactivated.
 * It cleans up resources used by the extension.
 */
export function deactivate() {
    try {
        // Dispose of the symbol manager
        symbolManager.dispose();
        
        ErrorHandler.info('Reference Counter extension deactivated', 'Extension');
    } catch (error) {
        ErrorHandler.error('Error during extension deactivation', error, 'Extension');
    }
}