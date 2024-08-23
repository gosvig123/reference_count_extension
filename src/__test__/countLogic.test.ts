import * as vscode from "vscode";
import { countDefinitions, countUsages } from "../countLogic";

jest.setTimeout(10000); // Increase timeout to 10 seconds

const mockContents = {
  js: `
    export function greet(name) { return \`Hello, \${name}!\`; }
    export const square = (x) => x * x;
    export function process(data) { return data.toLowerCase(); }
    greet('John'); square(5); square(10); process('TEST');
  `,
  python: `
    def greet_python(name): return f"Hello, {name}!"
    def square_python(x): return x * x
    def process_python(data): return data.lower()
    greet_python('John'); square_python(5); square_python(10); process_python('TEST')
    def unused_function(): return "This function is not used"
  `,
  nodeModule: `
    function greet(name) { console.log(\`Hello, \${name}!\`); }
    greet('Module'); greet('Another');
  `,
};

describe("countLogic", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri: vscode.Uri) => {
      const content = uri.fsPath.includes("node_modules")
        ? mockContents.nodeModule
        : uri.fsPath.endsWith(".py")
        ? mockContents.python
        : mockContents.js;
      return Promise.resolve(Buffer.from(content));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test("countDefinitions should identify function definitions", async () => {
    const jsResult = await countDefinitions([vscode.Uri.file("mockFile.js")]);
    const pyResult = await countDefinitions([vscode.Uri.file("mockFile.py")]);

    ["greet", "square", "process"].forEach((func) =>
      expect(jsResult.get(func)).toEqual(["mockFile.js"])
    );
    ["greet_python", "square_python", "process_python", "unused_function"].forEach((func) =>
      expect(pyResult.get(func)).toEqual(["mockFile.py"])
    );
  });
  test("countUsages should count function usages correctly", async () => {
    const mockDefinitions = new Map<string, string[]>([
      ...["greet", "square", "process"].map(
        (func) => [func, ["mockFile.js"]] as [string, string[]]
      ),
      ...["greet_python", "square_python", "process_python", "unused_function"].map(
        (func) => [func, ["mockFile.py"]] as [string, string[]]
      ),
    ]);

    const jsResult = await countUsages([vscode.Uri.file("mockFile.js")], mockDefinitions);
    const pyResult = await countUsages([vscode.Uri.file("mockFile.py")], mockDefinitions);

    expect(jsResult.get("greet")).toBe(1);
    expect(jsResult.get("square")).toBe(2);
    expect(jsResult.get("process")).toBe(1);

    expect(pyResult.get("greet_python")).toBe(1);
    expect(pyResult.get("square_python")).toBe(2);
    expect(pyResult.get("process_python")).toBe(1);
    expect(pyResult.get("unused_function")).toBe(0);
  });

  test("countUsages should handle various scenarios", async () => {
    const mockDefinitions = new Map<string, string[]>([
      ["func", ["file1.js", "file2.js"]],
      ["unusedFunc", ["mockFile.js"]],
      ["nestedFunc", ["mockFile.js"]],
      ["arrowFunc", ["mockFile.js"]],
      ["classMethod", ["mockFile.js"]],
    ]);

    const mockContent = `
      function func() {}
      function unusedFunc() {}
      function nestedFunc() { func(); }
      const arrowFunc = () => {};
      class MyClass { classMethod() {} }
      func(); func(); nestedFunc(); arrowFunc();
      const instance = new MyClass(); instance.classMethod(); instance.classMethod();
    `;

    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockContent));

    const result = await countUsages([vscode.Uri.file("mockFile.js")], mockDefinitions);

    expect(result.get("func")).toBe(3);
    expect(result.get("unusedFunc")).toBe(0);
    expect(result.get("nestedFunc")).toBe(1);
    expect(result.get("arrowFunc")).toBe(1);
    expect(result.get("classMethod")).toBe(3);
  });

  test("countUsages should handle excluded directories and empty files", async () => {
    const mockExcludePatterns = ["**/node_modules/**"];
    jest.mock("../constants", () => ({ excludePatterns: mockExcludePatterns }));

    const mockDefinitions = new Map<string, string[]>([["greet", ["mockFile.js"]]]);
    const emptyContent = "";

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation((uri: vscode.Uri) => {
      return Promise.resolve(
        Buffer.from(uri.fsPath.includes("empty") ? emptyContent : mockContents.js)
      );
    });

    const result = await countUsages(
      [
        vscode.Uri.file("mockFile.js"),
        vscode.Uri.file("node_modules/some-module/index.js"),
        vscode.Uri.file("emptyFile.js"),
      ],
      mockDefinitions
    );

    expect(result.get("greet")).toBe(1);
  });
});