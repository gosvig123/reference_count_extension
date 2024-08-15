import { minimatch } from 'minimatch';
import * as vscode from "vscode";
import { excludePatterns } from "./constants";
import { getFunctionDefinitions, getFunctionUsages } from "./regEx";

export async function countUsages(
  files: vscode.Uri[],
  functionDefinitions: Map<string, string[]>
): Promise<Map<string, number>> {
  const totalFunctionUsages = new Map<string, number>();

  // Initialize all defined functions with 0 usages
  for (const funcName of functionDefinitions.keys()) {
    totalFunctionUsages.set(funcName, 0);
  }

  for (const file of files) {
    if (excludePatterns.some(pattern => minimatch(file.fsPath, pattern, { dot: true }))) {
      continue;
    }

    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const languageId = getLanguageIdFromUri(file);
    const funcUsages = getFunctionUsages(languageId, fileContent);

    for (const funcName of funcUsages) {
      if (functionDefinitions.has(funcName)) {
        totalFunctionUsages.set(funcName, (totalFunctionUsages.get(funcName) || 0) + 1);
      }
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
    const fileContent = Buffer.from(content).toString('utf8');
    const languageId = getLanguageIdFromUri(file);
    const funcDefs = getFunctionDefinitions(languageId, fileContent);
    for (const funcName of funcDefs) {
      if (!functionDefinitions.has(funcName)) {
        functionDefinitions.set(funcName, []);
      }
      if (!functionDefinitions.get(funcName)!.includes(file.fsPath)) {
        functionDefinitions.get(funcName)!.push(file.fsPath);
      }
    }
  }
  console.log("Function Definitions:", functionDefinitions);
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
