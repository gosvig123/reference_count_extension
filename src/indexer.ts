import * as vscode from "vscode";
import { countDefinitions, countUsages } from "./countLogic";
import { excludePatterns, fileExtensions } from "./constants";

export class Indexer {
  private definitions: Map<string, string[]> = new Map();
  private usages: Map<string, number> = new Map();
  private indexingPromise: Promise<void> | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  async indexWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    this.indexingPromise = this.doIndexing(workspaceFolders);
    await this.indexingPromise;
  }

  private async doIndexing(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ) {
    for (const folder of workspaceFolders) {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(
          folder,
          `**/*.{${fileExtensions.join(",")}}`
        ),
        `{${excludePatterns.join(",")}}`
      );

      this.definitions = await countDefinitions(files);
      this.usages = await countUsages(files, this.definitions);
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

    // Merge new data with existing data
    for (const [key, value] of newDefinitions) {
      this.definitions.set(key, value);
    }
    for (const [key, value] of newUsages) {
      this.usages.set(key, value);
    }

    // Update saved data
    this.context.workspaceState.update("indexedDefinitions", this.definitions);
    this.context.workspaceState.update("indexedUsages", this.usages);
  }
}
