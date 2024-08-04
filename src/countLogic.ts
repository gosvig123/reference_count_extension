import * as vscode from "vscode";

export async function countDefinitions(
  pythonFiles: vscode.Uri[]
): Promise<Map<string, string[]>> {
  const functionDefinitions = new Map<string, string[]>();
  for (const file of pythonFiles) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const funcDefRegex = /def\s+(\w+)\s*\(/g;
    let defMatch;
    while ((defMatch = funcDefRegex.exec(fileContent)) !== null) {
      const funcName = defMatch[1];
      if (!functionDefinitions.has(funcName)) {
        functionDefinitions.set(funcName, []);
      }
      functionDefinitions.get(funcName)!.push(file.fsPath);
    }
  }
  return functionDefinitions;
}

export async function countUsages(
  pythonFiles: vscode.Uri[],
  functionDefinitions: Map<string, string[]>
): Promise<Map<string, number>> {
  const functionUsages = new Map<string, number>();
  for (const file of pythonFiles) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const funcUsageRegex = /\b(\w+)\s*\(/g;
    let usageMatch;
    while ((usageMatch = funcUsageRegex.exec(fileContent)) !== null) {
      const funcName = usageMatch[1];
      if (functionDefinitions.has(funcName)) {
        functionUsages.set(funcName, (functionUsages.get(funcName) || 0) + 1);
      }
    }
  }
  // Subtract the number of definitions from each usage count
  for (const [funcName, definitions] of functionDefinitions.entries()) {
    const usages = functionUsages.get(funcName) || 0;
    functionUsages.set(funcName, Math.max(0, usages - definitions.length));
  }
  return functionUsages;
}
