import { beforeEach, describe, it } from 'node:test';
import { JavaScriptHandler } from '../../utils/languageHandlers';
import { testHandlerCanHandle, testIsImportOrExportLine, testIsComponentUsage } from '../testUtils';

describe('JavaScriptHandler', () => {
    let handler: JavaScriptHandler;

    beforeEach(() => {
        handler = new JavaScriptHandler();
    });

    describe('canHandle', () => {
        it('should handle JavaScript files', () => {
            testHandlerCanHandle(handler, 'js', true);
            testHandlerCanHandle(handler, 'jsx', true);
        });

        it('should handle TypeScript files', () => {
            testHandlerCanHandle(handler, 'ts', true);
            testHandlerCanHandle(handler, 'tsx', true);
        });

        it('should not handle non-JS/TS files', () => {
            testHandlerCanHandle(handler, 'py', false);
            testHandlerCanHandle(handler, 'html', false);
            testHandlerCanHandle(handler, 'css', false);
        });
    });

    describe('isImportOrExportLine', () => {
        it('should identify ES6 import statements', () => {
            testIsImportOrExportLine(handler, 'import React from "react";', true);
            testIsImportOrExportLine(handler, 'import { useState, useEffect } from "react";', true);
            testIsImportOrExportLine(handler, 'import * as vscode from "vscode";', true);
        });

        it('should identify CommonJS require statements', () => {
            testIsImportOrExportLine(handler, 'const fs = require("fs");', true);
            testIsImportOrExportLine(handler, 'var path = require("path");', true);
            testIsImportOrExportLine(handler, 'let { exec } = require("child_process");', true);
        });

        it('should identify export statements', () => {
            testIsImportOrExportLine(handler, 'export const foo = "bar";', true);
            testIsImportOrExportLine(handler, 'export default class MyComponent {};', true);
            testIsImportOrExportLine(handler, 'export { foo, bar };', true);
        });

        it('should handle whitespace correctly', () => {
            testIsImportOrExportLine(handler, '  import React from "react";', true);
            testIsImportOrExportLine(handler, '\texport const foo = "bar";', true);
        });

        it('should not identify non-import/export statements', () => {
            testIsImportOrExportLine(handler, 'function importData() {}', false);
            testIsImportOrExportLine(handler, 'const x = "import this";', false);
            testIsImportOrExportLine(handler, '// import React from "react";', false);
        });
    });

    describe('isComponentUsage', () => {
        it('should identify direct component references in JSX', () => {
            testIsComponentUsage(handler, '<MyComponent />', true);
            testIsComponentUsage(handler, '<Button onClick={handleClick} />', true);
            testIsComponentUsage(handler, '<div><Header /></div>', true);
        });

        it('should identify component references in conditional expressions', () => {
            testIsComponentUsage(handler, 'isVisible && <MyComponent />', true);
            testIsComponentUsage(handler, 'showHeader ? <Header /> : null', true);
        });

        it('should identify component references in curly braces', () => {
            testIsComponentUsage(handler, 'return {MainView}', true);
            testIsComponentUsage(handler, 'const element = {Button}', true);
        });

        it('should identify component as props', () => {
            testIsComponentUsage(handler, 'component={MainView}', true);
            testIsComponentUsage(handler, 'leftIcon={Icon}', true);
        });

        it('should identify formatImageData function calls', () => {
            testIsComponentUsage(handler, 'formatImageData({width: 100})', true);
            testIsComponentUsage(handler, 'const img = formatImageData({src: "image.png"})', true);
        });

        it('should not identify regular function calls or HTML elements', () => {
            testIsComponentUsage(handler, 'getData()', false);
            testIsComponentUsage(handler, '<div>Content</div>', false);
            testIsComponentUsage(handler, '<span>Text</span>', false);
        });
    });
});
