import * as vscode from 'vscode';

/**
 * Error severity levels for the application
 */
export enum ErrorSeverity {
    INFO,
    WARNING,
    ERROR,
    CRITICAL
}

/**
 * Interface for error options
 */
export interface ErrorOptions {
    message: string;
    severity?: ErrorSeverity;
    error?: Error | unknown;
    showToUser?: boolean;
    context?: string;
}

/**
 * Centralized error handling utility
 */
export class ErrorHandler {
    /**
     * Log an error with appropriate severity
     */
    public static handleError(options: ErrorOptions): void {
        const { 
            message, 
            severity = ErrorSeverity.ERROR, 
            error, 
            showToUser = false,
            context = ''
        } = options;

        // Format the error message
        const contextPrefix = context ? `[${context}] ` : '';
        const fullMessage = `${contextPrefix}${message}`;
        
        // Add error details if available
        const errorDetails = error instanceof Error 
            ? `: ${error.message}\n${error.stack || ''}`
            : error ? `: ${String(error)}` : '';

        // Log based on severity
        switch (severity) {
            case ErrorSeverity.INFO:
                console.log(`${fullMessage}${errorDetails}`);
                break;
            case ErrorSeverity.WARNING:
                console.warn(`${fullMessage}${errorDetails}`);
                break;
            case ErrorSeverity.ERROR:
                console.error(`${fullMessage}${errorDetails}`);
                break;
            case ErrorSeverity.CRITICAL:
                console.error(`CRITICAL: ${fullMessage}${errorDetails}`);
                break;
        }

        // Show notification to user if requested
        if (showToUser) {
            // Determine which VS Code notification to use based on severity
            switch (severity) {
                case ErrorSeverity.INFO:
                    vscode.window.showInformationMessage(fullMessage);
                    break;
                case ErrorSeverity.WARNING:
                    vscode.window.showWarningMessage(fullMessage);
                    break;
                case ErrorSeverity.ERROR:
                case ErrorSeverity.CRITICAL:
                    vscode.window.showErrorMessage(fullMessage);
                    break;
            }
        }
    }

    /**
     * Log information message
     */
    public static info(message: string, context?: string, showToUser = false): void {
        this.handleError({
            message,
            severity: ErrorSeverity.INFO,
            showToUser,
            context
        });
    }

    /**
     * Log warning message
     */
    public static warn(message: string, error?: Error | unknown, context?: string, showToUser = false): void {
        this.handleError({
            message,
            severity: ErrorSeverity.WARNING,
            error,
            showToUser,
            context
        });
    }

    /**
     * Log error message
     */
    public static error(message: string, error?: Error | unknown, context?: string, showToUser = false): void {
        this.handleError({
            message,
            severity: ErrorSeverity.ERROR,
            error,
            showToUser,
            context
        });
    }

    /**
     * Log critical error message
     */
    public static critical(message: string, error?: Error | unknown, context?: string, showToUser = true): void {
        this.handleError({
            message,
            severity: ErrorSeverity.CRITICAL,
            error,
            showToUser,
            context
        });
    }

    /**
     * Execute a function with error handling
     */
    public static async tryExecution<T>(
        func: () => Promise<T>,
        errorMessage: string,
        context?: string,
        showToUser = false,
        defaultValue?: T
    ): Promise<T | undefined> {
        try {
            return await func();
        } catch (error) {
            this.handleError({
                message: errorMessage,
                error,
                showToUser,
                context
            });
            return defaultValue;
        }
    }
}