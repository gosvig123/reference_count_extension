import * as vscode from "vscode";
import { getFunctionDefinitionRegex } from "./regEx";

function countFunctionUsagesInFile(
  fileContent: string,
  languageId: string,
  functionDefinitions: Map<string, string[]>
): Map<string, number> {
  const functionUsages = new Map<string, number>();
  const funcUsageRegex = getFunctionUsageRegex(languageId);
  let usageMatch;

  while ((usageMatch = funcUsageRegex.exec(fileContent)) !== null) {
    const funcName = usageMatch[1] || usageMatch[2]; // Check both capture groups
    if (functionDefinitions.has(funcName)) {
      functionUsages.set(funcName, (functionUsages.get(funcName) || 0) + 1);
    }
  }

  return functionUsages;
}

function adjustUsageCountForDefinitions(
  functionUsages: Map<string, number>,
  functionDefinitions: Map<string, string[]>,
  filePath: string
): Map<string, number> {
  for (const [funcName, definitionFiles] of functionDefinitions.entries()) {
    if (definitionFiles.includes(filePath)) {
      const currentUsages = functionUsages.get(funcName) || 0;
      // Only set usage to 1 if it's not already used
      if (currentUsages === 0) {
        functionUsages.set(funcName, 0);
      }
    }
  }
  return functionUsages;
}

export async function countUsages(
  files: vscode.Uri[],
  functionDefinitions: Map<string, string[]>
): Promise<Map<string, number>> {
  const totalFunctionUsages = new Map<string, number>();

  for (const file of files) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const languageId = getLanguageIdFromUri(file);

    const fileUsages = countFunctionUsagesInFile(
      fileContent,
      languageId,
      functionDefinitions
    );
    const adjustedUsages = adjustUsageCountForDefinitions(
      fileUsages,
      functionDefinitions,
      file.fsPath
    );

    for (const [funcName, usageCount] of adjustedUsages.entries()) {
      totalFunctionUsages.set(
        funcName,
        (totalFunctionUsages.get(funcName) || 0) + usageCount
      );
    }
  }
  console.log("totalFunctionUsages", totalFunctionUsages);
  return totalFunctionUsages;
}

export async function countDefinitions(
  files: vscode.Uri[]
): Promise<Map<string, string[]>> {
  const functionDefinitions = new Map<string, string[]>();
  for (const file of files) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const languageId = getLanguageIdFromUri(file);
    const funcDefRegex = getFunctionDefinitionRegex(languageId);
    let defMatch;
    while ((defMatch = funcDefRegex.exec(fileContent)) !== null) {
      const funcName =
        defMatch[1] ||
        defMatch[2] ||
        defMatch[3] ||
        defMatch[4] ||
        defMatch[5] ||
        defMatch[6];
      if (funcName) {
        if (!functionDefinitions.has(funcName)) {
          functionDefinitions.set(funcName, []);
        }
        if (!functionDefinitions.get(funcName)!.includes(file.fsPath)) {
          functionDefinitions.get(funcName)!.push(file.fsPath);
        }
      }
    }
  }
  return functionDefinitions;
}

function getLanguageIdFromUri(uri: vscode.Uri): string {
  const extension = uri.fsPath.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascriptreact";
    case "tsx":
      return "typescriptreact";
    default:
      return "";
  }
}

function getFunctionUsageRegex(languageId: string): RegExp {
  switch (languageId) {
    case "python":
      return /(?<!\bdef\s+)(\w+)\s*\(/g;
    case "javascript":
    case "typescript":
    case "javascriptreact":
    case "typescriptreact":
      return /(?<!(?:function|class|const|let|var)\s+)(\w+)\s*\(|<(\w+)(?:\s|\/?>|\/>)/g;
    default:
      return /(?:)/g; // Empty regex for unsupported file types
  }
}