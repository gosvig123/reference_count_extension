import { countDefinitions, countUsages } from '../countLogic';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  beforeAll(() => {
    // Setup code if needed
  });

  test('Sample test', () => {
    expect([1, 2, 3].indexOf(5)).toBe(-1);
    expect([1, 2, 3].indexOf(0)).toBe(-1);
  });

  // Add more tests for your extension functions
  test('countDefinitions', async () => {
    // Mock implementation
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('function testFunc() {}'));

    const result = await countDefinitions([vscode.Uri.file('test.js')]);
    expect(result.get('testFunc')).toEqual(['test.js']);
  });

  test('countUsages', async () => {
    // Mock implementation
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('function testFunc() {} testFunc();'));

    const mockDefinitions = new Map([['testFunc', ['test.js']]]);
    const result = await countUsages([vscode.Uri.file('test.js')], mockDefinitions);
    expect(result.get('testFunc')).toBe(1);
  });
});
