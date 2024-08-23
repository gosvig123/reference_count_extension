import * as vscode from "vscode";
import { excludePatterns, fileExtensions } from "./constants";
import { countDefinitions, countUsages } from "./countLogic";

export class Indexer {
  private definitions: Map<string, string[]> = new Map();
  private usages: Map<string, number> = new Map();
  private lastFileUsages: Map<string, number> = new Map();
  private indexingPromise: Promise<void> | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  async indexWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    this.indexingPromise = this.doIndexing(workspaceFolders);
    await this.indexingPromise;
  }

  private async doIndexing(workspaceFolders: readonly vscode.WorkspaceFolder[]) {
    this.definitions = new Map();
    this.usages = new Map();

    for (const folder of workspaceFolders) {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, `**/*.{${fileExtensions.join(",")}}`),
        `{${excludePatterns.join(",")}}`
      );

      const newDefinitions = await countDefinitions(files);
      const newUsages = await countUsages(files, newDefinitions);

      // Merge new definitions and usages
      for (const [key, value] of newDefinitions) {
        this.definitions.set(key, value);
      }
      for (const [key, value] of newUsages) {
        this.usages.set(key, (this.usages.get(key) || 0) + value);
      }
    }

    // Save indexed data to extension context
    this.context.workspaceState.update("indexedDefinitions", this.definitions);
    this.context.workspaceState.update("indexedUsages", this.usages);
  }

  async getIndexedData() {
    if (this.indexingPromise) {
      await this.indexingPromise;
    }
    return { definitions: this.definitions, usages: this.usages };
  }

  async updateFile(uri: vscode.Uri) {
    const file = await vscode.workspace.openTextDocument(uri);
    const newDefinitions = await countDefinitions([file.uri]);
    const newUsages = await countUsages([file.uri], newDefinitions);

    // Update definitions
    for (const [key, value] of newDefinitions) {
      this.definitions.set(key, value);
    }

    // Remove old usages for this file
    for (const [funcName, count] of this.lastFileUsages) {
      const currentCount = this.usages.get(funcName) || 0;
      this.usages.set(funcName, Math.max(0, currentCount - count));
    }

    // Add new usages for this file
    for (const [funcName, count] of newUsages) {
      const currentCount = this.usages.get(funcName) || 0;
      this.usages.set(funcName, currentCount + count);
    }

    // Store the new usages for this file
    this.lastFileUsages = newUsages;

    // Recalculate global usage count
    await this.recalculateGlobalUsages();

    console.log("Updated usages", this.usages);

    // Update saved data
    this.context.workspaceState.update("indexedDefinitions", this.definitions);
    this.context.workspaceState.update("indexedUsages", this.usages);
  }

  private async recalculateGlobalUsages() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const allFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolders[0], `**/*.{${fileExtensions.join(",")}}`),
      `{${excludePatterns.join(",")}}`
    );

    this.usages = await countUsages(allFiles, this.definitions);
  }
}
