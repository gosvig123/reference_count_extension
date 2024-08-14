export function getFunctionDefinitionRegex(languageId: string): RegExp {
  switch (languageId) {
    case "python":
      return /def\s+(\w+)\s*\(/g;
    case "javascript":
    case "typescript":
    case "javascriptreact":
    case "typescriptreact":
      return /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>|async\s*(?:function|\([^)]*\)\s*=>))|(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>|\b(\w+)\s*:\s*(?:function|\([^)]*\)\s*=>)|(?:class\s+(\w+)|const\s+(\w+)\s*=\s*class)|(?:const|let|var)\s+(\w+)\s*=\s*React\.(?:memo|forwardRef)\()/g;
    default:
      return /(?:)/g; // Empty regex for unsupported file types
  }
}
