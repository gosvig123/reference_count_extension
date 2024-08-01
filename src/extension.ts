import * as vscode from "vscode";

let currentDecorationType: vscode.TextEditorDecorationType | undefined;

async function countDefinitionsAndUsages() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'python') {
    console.log("Not a Python file, skipping");
    return;
  }

  console.log("Processing Python file");
  const document = editor.document;
  const text = document.getText();

  const functionDefinitions = new Map<string, string>(); // function name to file path
  const functionUsages = new Map<string, Set<string>>();
  const importedFunctions = new Map<string, Set<string>>();

  // Get the workspace folder
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    console.log("No workspace folder found");
    return;
  }

  // Define patterns to exclude package directories
  const excludePatterns = [
    "**/venv/**", "**/env/**", "**/.venv/**", "**/node_modules/**",
    "**/site-packages/**", "**/lib/**", "**/libs/**", "**/build/**", "**/dist/**"
  ];

  // Count function definitions and usages across all Python files in the workspace
  const pythonFiles = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, "**/*.py"),
    `{${excludePatterns.join(',')}}`
  );
  console.log(`Found ${pythonFiles.length} Python files`);

  for (const file of pythonFiles) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");

    // Function definition regex
    const funcDefRegex = /def\s+(\w+)\s*\(/g;
    let defMatch;
    while ((defMatch = funcDefRegex.exec(fileContent)) !== null) {
      const funcName = defMatch[1];
      functionDefinitions.set(funcName, file.fsPath);
    }

    // Import regex
    const importRegex = /from\s+(\S+)\s+import\s+(.+)/g;
    let importMatch;
    while ((importMatch = importRegex.exec(fileContent)) !== null) {
      const imports = importMatch[2].split(',').map(i => i.trim());
      for (const imp of imports) {
        if (!importedFunctions.has(imp)) {
          importedFunctions.set(imp, new Set());
        }
        importedFunctions.get(imp)!.add(file.fsPath);
      }
    }

    // Function usage regex
    const funcUsageRegex = /\b(\w+)\s*\(/g;
    let usageMatch;
    while ((usageMatch = funcUsageRegex.exec(fileContent)) !== null) {
      const funcName = usageMatch[1];
      if (functionDefinitions.has(funcName) || importedFunctions.has(funcName)) {
        if (!functionUsages.has(funcName)) {
          functionUsages.set(funcName, new Set());
        }
        functionUsages.get(funcName)!.add(file.fsPath);
      }
    }
  }

  // Merge imported function usages with regular function usages
  for (const [funcName, files] of importedFunctions.entries()) {
    if (functionDefinitions.has(funcName)) {
      const usages = functionUsages.get(funcName) || new Set();
      for (const file of files) {
        usages.add(file);
      }
      functionUsages.set(funcName, usages);
    }
  }

  const decorations: vscode.DecorationOptions[] = [];
  const funcDefRegex = /def\s+(\w+)\s*\(/g;
  let match;

  while ((match = funcDefRegex.exec(text)) !== null) {
    const funcName = match[1];
    const startPos = document.positionAt(match.index + 4); // 4 is the length of "def "
    const endPos = document.positionAt(match.index + 4 + funcName.length);
    const range = new vscode.Range(startPos, endPos);

    const usages = functionUsages.get(funcName) || new Set();
    const definitionFile = functionDefinitions.get(funcName);
    const usageCount = definitionFile ? usages.size - (usages.has(definitionFile) ? 1 : 0) : usages.size;

    console.log(`Decorating function: ${funcName} at line ${startPos.line + 1}, used in ${usageCount} files`);

    decorations.push({
      range,
      hoverMessage: `Used in: ${usageCount} file(s)`,
      renderOptions: {
        after: {
          contentText: `  (${usageCount})`,
          color: "rgba(65, 105, 225, 0.7)", // Blue color
          fontWeight: "normal",
        },
      },
    });
  }

  console.log(`Created ${decorations.length} decorations`);

  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
  currentDecorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(currentDecorationType, decorations);
  console.log("Decorations applied");
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Extension activated");

  let disposable = vscode.commands.registerCommand(
    "extension.countDefinitionsAndUsages",
    () => {
      console.log("Command triggered");
      countDefinitionsAndUsages();
    }
  );

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      console.log("Active editor changed");
      if (editor && editor.document.languageId === "python") {
        countDefinitionsAndUsages();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      console.log("Document changed");
      if (
        event.document === vscode.window.activeTextEditor?.document &&
        event.document.languageId === "python"
      ) {
        countDefinitionsAndUsages();
      }
    })
  );

  if (
    vscode.window.activeTextEditor &&
    vscode.window.activeTextEditor.document.languageId === "python"
  ) {
    console.log("Initial count triggered");
    countDefinitionsAndUsages();
  }
}

export function deactivate() {
  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
}