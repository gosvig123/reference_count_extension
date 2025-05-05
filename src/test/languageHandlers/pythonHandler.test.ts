import { PythonHandler } from '../../utils/languageHandlers';
import { testHandlerCanHandle, testIsImportOrExportLine } from '../testUtils';

describe('PythonHandler', () => {
    let handler: PythonHandler;

    beforeEach(() => {
        handler = new PythonHandler();
    });

    describe('canHandle', () => {
        it('should handle .py files', () => {
            testHandlerCanHandle(handler, 'py', true);
        });

        it('should not handle non-Python files', () => {
            testHandlerCanHandle(handler, 'js', false);
            testHandlerCanHandle(handler, 'ts', false);
            testHandlerCanHandle(handler, 'jsx', false);
            testHandlerCanHandle(handler, 'tsx', false);
            testHandlerCanHandle(handler, 'html', false);
        });
    });

    describe('isImportOrExportLine', () => {
        it('should identify standard import statements', () => {
            testIsImportOrExportLine(handler, 'import os', true);
            testIsImportOrExportLine(handler, 'import sys, os', true);
            testIsImportOrExportLine(handler, 'import numpy as np', true);
        });

        it('should identify from-import statements', () => {
            testIsImportOrExportLine(handler, 'from os import path', true);
            testIsImportOrExportLine(handler, 'from datetime import datetime, timedelta', true);
            testIsImportOrExportLine(handler, 'from .utils import helper', true);
        });

        it('should handle whitespace correctly', () => {
            testIsImportOrExportLine(handler, '  import os', true);
            testIsImportOrExportLine(handler, '\timport sys', true);
            testIsImportOrExportLine(handler, '    from os import path', true);
        });

        it('should not identify non-import statements', () => {
            testIsImportOrExportLine(handler, 'def import_data():', false);
            testIsImportOrExportLine(handler, 'x = "import this"', false);
            testIsImportOrExportLine(handler, '# import os', false);
        });

        it('should handle multiline imports', () => {
            testIsImportOrExportLine(handler, 'from os import (', true);
            testIsImportOrExportLine(handler, 'import (', true);
        });
    });

    describe('isComponentUsage', () => {
        it('should always return false for Python files', () => {
            // Python doesn't have component usage like React
            expect(handler.isComponentUsage('SomeComponent()')).toBe(false);
            expect(handler.isComponentUsage('<Component>')).toBe(false);
        });
    });
});
