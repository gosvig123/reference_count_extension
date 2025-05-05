import * as vscode from 'vscode';

/**
 * Interface for language-specific handlers
 */
export interface LanguageHandler {
  /**
   * Determines if this handler can process the given file
   */
  canHandle(filePath: string): boolean;

  /**
   * Checks if a line is an import or export statement
   */
  isImportOrExportLine(line: string): boolean;

  /**
   * Checks if a reference is a component usage in JSX or similar
   */
  isComponentUsage(lineText: string): boolean;
}

/**
 * Base handler with common functionality
 */
export abstract class BaseLanguageHandler implements LanguageHandler {
  abstract canHandle(filePath: string): boolean;
  
  isImportOrExportLine(line: string): boolean {
    return false; // Override in subclasses
  }
  
  isComponentUsage(lineText: string): boolean {
    return false; // Override in subclasses
  }
}

/**
 * Handler for JavaScript and TypeScript files
 */
export class JavaScriptHandler extends BaseLanguageHandler {
  canHandle(filePath: string): boolean {
    return /\.(js|jsx|ts|tsx)$/i.test(filePath);
  }
  
  isImportOrExportLine(line: string): boolean {
    // Check for import statements
    const potentialImportKeyword = line.match(/^\s*(import|require)/);
    const isImport = !!potentialImportKeyword;
    
    // Check for export statements
    const isExport = line.startsWith('export');
    
    return isImport || isExport;
  }
  
  isComponentUsage(lineText: string): boolean {
    return (
      // Component in JSX expression
      (lineText.includes('&&') && lineText.includes('<')) ||
      // Component in ternary expression
      (lineText.includes('?') && lineText.includes(':') && lineText.includes('<')) ||
      // Direct component reference
      (lineText.match(/<[A-Z][A-Za-z0-9]*/) !== null) ||
      // Component reference in curly braces (e.g., {MainView})
      (lineText.match(/\{[A-Z][A-Za-z0-9]*\}/) !== null) ||
      // Component as a prop (e.g., component={MainView})
      (lineText.match(/component\s*=\s*\{[A-Za-z0-9_]+\}/) !== null) ||
      // Component in formatImageData function call
      (lineText.includes('formatImageData') && lineText.includes('{'))
    );
  }
}

/**
 * Handler for Python files
 */
export class PythonHandler extends BaseLanguageHandler {
  canHandle(filePath: string): boolean {
    return /\.py$/i.test(filePath);
  }
  
  isImportOrExportLine(line: string): boolean {
    // Check for import or from statements
    const potentialImportKeyword = line.match(/^\s*(import|from)/);
    return !!potentialImportKeyword;
  }
}

/**
 * Default handler for other file types
 */
export class DefaultLanguageHandler extends BaseLanguageHandler {
  canHandle(filePath: string): boolean {
    return true; // Fallback handler
  }
  
  isImportOrExportLine(line: string): boolean {
    // Generic import detection for other languages
    const potentialImportKeyword = line.match(/^\s*(import|require|using|include)/);
    return !!potentialImportKeyword;
  }
}

/**
 * Registry of language handlers
 */
export class LanguageHandlerRegistry {
  private handlers: LanguageHandler[] = [];
  
  constructor() {
    // Register handlers in order of specificity
    this.handlers.push(new JavaScriptHandler());
    this.handlers.push(new PythonHandler());
    this.handlers.push(new DefaultLanguageHandler()); // Fallback handler
  }
  
  /**
   * Get the appropriate handler for a file
   */
  getHandlerForFile(filePath: string): LanguageHandler {
    for (const handler of this.handlers) {
      if (handler.canHandle(filePath)) {
        return handler;
      }
    }
    
    // This should never happen as we have a fallback handler
    return new DefaultLanguageHandler();
  }
}

// Singleton instance
export const languageHandlerRegistry = new LanguageHandlerRegistry();
