import { getReferencesForSymbol } from "./references";
import { getWorkspaceSymbols } from "./symbols";

export async function searchWorkspace() {
  const workspaceSymbols = await getWorkspaceSymbols();
  const referencesForSymbols = await Promise.all(workspaceSymbols.map(async (symbol) => {
    const references = await getReferencesForSymbol(symbol);
    return {
      symbol,
      references
    };
  }));
  console.log(referencesForSymbols);
}