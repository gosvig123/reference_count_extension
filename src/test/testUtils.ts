import * as vscode from 'vscode';
import { LanguageHandler } from '../utils/languageHandlers';

/**
 * Test utilities for language handler tests
 */

/**
 * Tests if a handler can handle a file with the given extension
 */
export function testHandlerCanHandle(handler: LanguageHandler, extension: string, expected: boolean): void {
    const filePath = `/path/to/file.${extension}`;
    expect(handler.canHandle(filePath)).toBe(expected);
}

/**
 * Tests if a line is recognized as an import or export statement
 */
export function testIsImportOrExportLine(handler: LanguageHandler, line: string, expected: boolean): void {
    expect(handler.isImportOrExportLine(line)).toBe(expected);
}

/**
 * Tests if a line is recognized as a component usage (for React/JSX)
 */
export function testIsComponentUsage(handler: LanguageHandler, line: string, expected: boolean): void {
    expect(handler.isComponentUsage(line)).toBe(expected);
}
