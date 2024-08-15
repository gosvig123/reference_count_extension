import * as vscode from 'vscode';
import { countDefinitions, countUsages } from '../countLogic';

const mockFileContent = `
  export function greet(name) {
    return \`Hello, \${name}!\`;
  }

  export const square = (x) => x * x;

  export function process(data) {
    return data.toLowerCase();
  }


  export async function countUsages
  greet('John');
  square(5);
  square(10);
  process('TEST');
`;

const mockPythonFileContent = `
  def greet_python(name):
    return f"Hello, {name}!"

  def square_python(x):
    return x * x

  def process_python(data):
    return data.lower()

  greet_python('John')
  square_python(5)
  square_python(10)
  process_python('TEST')

  def unused_function():
    return "This function is not used"
`;

const mockNodeModuleContent = `
  function greet(name) {
    console.log(\`Hello, \${name}!\`);
  }

  greet('Module');
  greet('Another');
`;

describe('countLogic', () => {
  beforeEach(() => {
    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri: vscode.Uri) => {
      if (uri.fsPath.endsWith('mockFile.js')) {
        return Promise.resolve(Buffer.from(mockFileContent));
      } else if (uri.fsPath.endsWith('mockPythonFile.py')) {
        return Promise.resolve(Buffer.from(mockPythonFileContent));
      } else if (uri.fsPath.includes('node_modules')) {
        return Promise.resolve(Buffer.from(mockNodeModuleContent));
      }
      return Promise.reject(new Error('Unsupported file type'));
    });
  });

  test('countDefinitions should identify function definitions', async () => {
    const result = await countDefinitions([vscode.Uri.file('mockFile.js')]);
    const pythonResult = await countDefinitions([vscode.Uri.file('mockPythonFile.py')]);
    expect(result.get('greet')).toEqual(['mockFile.js']);
    expect(result.get('square')).toEqual(['mockFile.js']);
    expect(result.get('process')).toEqual(['mockFile.js']);
    expect(result.get('countUsages')).toEqual(['mockFile.js']);
    expect(pythonResult.get('greet_python')).toEqual(['mockPythonFile.py']);
    expect(pythonResult.get('square_python')).toEqual(['mockPythonFile.py']);
    expect(pythonResult.get('process_python')).toEqual(['mockPythonFile.py']);
  });

  test('countUsages should count function usages correctly', async () => {
    const mockJsDefinitions = new Map([
      ['greet', ['mockFile.js']],
      ['square', ['mockFile.js']],
      ['process', ['mockFile.js']],
    ]);
    const mockPythonDefinitions = new Map([
      ['greet_python', ['mockPythonFile.py']],
      ['square_python', ['mockPythonFile.py']],
      ['process_python', ['mockPythonFile.py']],
      ['unused_function', ['mockPythonFile.py']],
    ]);

    const jsResult = await countUsages([vscode.Uri.file('mockFile.js')], mockJsDefinitions);

    const pythonResult = await countUsages([vscode.Uri.file('mockPythonFile.py')], mockPythonDefinitions);

    expect(jsResult.get('greet')).toBe(1);
    expect(jsResult.get('square')).toBe(2);
    expect(jsResult.get('process')).toBe(1);

    expect(pythonResult.get('greet_python')).toBe(1);
    expect(pythonResult.get('square_python')).toBe(2);
    expect(pythonResult.get('process_python')).toBe(1);
    expect(pythonResult.get('unused_function')).toBe(0);
  });

  test('countUsages should not count usages in excluded directories', async () => {
    const mockJsDefinitions = new Map([['greet', ['mockFile.js']]]);

    // Mock the excludePatterns
    jest.mock('../constants', () => ({
      excludePatterns: ['**/node_modules/**'],
    }));

    const jsResult = await countUsages(
      [vscode.Uri.file('mockFile.js'), vscode.Uri.file('node_modules/some-module/index.js')],
      mockJsDefinitions
    );

    expect(jsResult.get('greet')).toBe(1);
  });
});
