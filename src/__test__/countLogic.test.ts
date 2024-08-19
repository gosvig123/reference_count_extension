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

  test('countUsages should handle functions with no usages', async () => {
    const mockDefinitions = new Map([
      ['unusedFunc', ['mockFile.js']],
      ['usedFunc', ['mockFile.js']],
    ]);

    const mockContent = `
      function unusedFunc() {}
      function usedFunc() {}
      usedFunc();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockContent));

    const result = await countUsages([vscode.Uri.file('mockFile.js')], mockDefinitions);

    expect(result.get('unusedFunc')).toBe(0);
    expect(result.get('usedFunc')).toBe(1);
  });

  test('countUsages should handle multiple files', async () => {
    const mockDefinitions = new Map([
      ['funcA', ['file1.js', 'file2.js']],
      ['funcB', ['file1.js']],
      ['funcC', ['file2.js']],
    ]);

    const mockContent1 = `
      function funcA() {}
      function funcB() {}
      funcA();
      funcB();
    `;

    const mockContent2 = `
      function funcA() {}
      function funcC() {}
      funcA();
      funcC();
      funcC();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri: vscode.Uri) => {
      if (uri.fsPath.endsWith('file1.js')) {
        return Promise.resolve(Buffer.from(mockContent1));
      } else if (uri.fsPath.endsWith('file2.js')) {
        return Promise.resolve(Buffer.from(mockContent2));
      }
      return Promise.reject(new Error('Unsupported file'));
    });

    const result = await countUsages(
      [vscode.Uri.file('file1.js'), vscode.Uri.file('file2.js')],
      mockDefinitions
    );

    expect(result.get('funcA')).toBe(2);
    expect(result.get('funcB')).toBe(1);
    expect(result.get('funcC')).toBe(2);
  });

  test('countUsages should handle functions with the same name in different files', async () => {
    const mockDefinitions = new Map([
      ['func', ['file1.js', 'file2.js']],
    ]);

    const mockContent1 = `
      function func() {}
      func();
    `;

    const mockContent2 = `
      function func() {}
      func();
      func();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri: vscode.Uri) => {
      if (uri.fsPath.endsWith('file1.js')) {
        return Promise.resolve(Buffer.from(mockContent1));
      } else if (uri.fsPath.endsWith('file2.js')) {
        return Promise.resolve(Buffer.from(mockContent2));
      }
      return Promise.reject(new Error('Unsupported file'));
    });

    const result = await countUsages(
      [vscode.Uri.file('file1.js'), vscode.Uri.file('file2.js')],
      mockDefinitions
    );

    expect(result.get('func')).toBe(3);
  });

  test('countUsages should not count function definitions as usages', async () => {
    const mockDefinitions = new Map([
      ['funcA', ['mockFile.js']],
      ['funcB', ['mockFile.js']],
    ]);

    const mockContent = `
      function funcA() {
        funcB();
      }
      function funcB() {
        funcA();
      }
      funcA();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockContent));

    const result = await countUsages([vscode.Uri.file('mockFile.js')], mockDefinitions);

    expect(result.get('funcA')).toBe(2);
    expect(result.get('funcB')).toBe(1);
  });

  test('countUsages should handle arrow functions and class methods', async () => {
    const mockDefinitions = new Map([
      ['arrowFunc', ['mockFile.js']],
      ['classMethod', ['mockFile.js']],
    ]);

    const mockContent = `
      const arrowFunc = () => {};
      class MyClass {
        classMethod() {}
      }
      arrowFunc();
      const instance = new MyClass();
      instance.classMethod();
      instance.classMethod();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockContent));

    const result = await countUsages([vscode.Uri.file('mockFile.js')], mockDefinitions);

    expect(result.get('arrowFunc')).toBe(1);
    expect(result.get('classMethod')).toBe(2);
  });

  test('countUsages should handle nested function calls', async () => {
    const mockDefinitions = new Map([
      ['outer', ['mockFile.js']],
      ['inner', ['mockFile.js']],
    ]);

    const mockContent = `
      function outer() {
        inner();
      }
      function inner() {}
      outer();
      outer();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockContent));

    const result = await countUsages([vscode.Uri.file('mockFile.js')], mockDefinitions);

    expect(result.get('outer')).toBe(2);
    expect(result.get('inner')).toBe(1);
  });

  test('countUsages should handle Python-specific syntax', async () => {
    const mockDefinitions = new Map([
      ['python_func', ['mockFile.py']],
      ['PythonClass', ['mockFile.py']],
      ['class_method', ['mockFile.py']],
    ]);

    const mockContent = `
def python_func():
    pass

class PythonClass:
    def class_method(self):
        pass

python_func()
obj = PythonClass()
obj.class_method()
obj.class_method()
  `;

    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockContent));

    const result = await countUsages([vscode.Uri.file('mockFile.py')], mockDefinitions);

    expect(result.get('python_func')).toBe(1);
    expect(result.get('PythonClass')).toBe(1);
    expect(result.get('class_method')).toBe(2);
  });

  test('countUsages should handle empty files and files with no function usages', async () => {
    const mockDefinitions = new Map([
      ['unusedFunc', ['emptyFile.js', 'noUsageFile.js']],
    ]);

    const emptyContent = '';
    const noUsageContent = 'const x = 5; console.log(x);';

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri: vscode.Uri) => {
      if (uri.fsPath.endsWith('emptyFile.js')) {
        return Promise.resolve(Buffer.from(emptyContent));
      } else if (uri.fsPath.endsWith('noUsageFile.js')) {
        return Promise.resolve(Buffer.from(noUsageContent));
      }
      return Promise.reject(new Error('Unsupported file'));
    });

    const result = await countUsages(
      [vscode.Uri.file('emptyFile.js'), vscode.Uri.file('noUsageFile.js')],
      mockDefinitions
    );

    expect(result.get('unusedFunc')).toBe(0);
  });
});
