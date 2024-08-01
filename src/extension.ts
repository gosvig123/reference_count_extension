import * as vscode from "vscode";

let currentDecorationType: vscode.TextEditorDecorationType | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("CSS Class Counter extension is now active");

  const debouncedCountCssClasses = debounce(countCssClasses, 300);

  let disposable = vscode.commands.registerCommand(
    "css-class-counter.countClasses",
    () => {
      debouncedCountCssClasses();
    }
  );

  context.subscriptions.push(disposable);

  // Add event listeners for file open and change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isRelevantFileType(editor.document)) {
        debouncedCountCssClasses();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        event.document === vscode.window.activeTextEditor?.document &&
        isRelevantFileType(event.document)
      ) {
        debouncedCountCssClasses();
      }
    })
  );

  // Initial count for the active editor
  if (
    vscode.window.activeTextEditor &&
    isRelevantFileType(vscode.window.activeTextEditor.document)
  ) {
    debouncedCountCssClasses();
  }
}
function isRelevantFileType(document: vscode.TextDocument): boolean {
  const relevantTypes = [
    "css",
    "html",
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
  ];
  return relevantTypes.includes(document.languageId);
}

async function countCssClasses() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const text = document.getText();
  const classMap = new Map<string, { cssCount: number; usageCount: number; type: string }>();

  // Scan CSS files
  const cssFiles = await vscode.workspace.findFiles("**/*.css", "**/node_modules/**");
  for (const file of cssFiles) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const cssRegex = /([.#])([\w-]+)\s*{/g;
    let cssMatch;
    while ((cssMatch = cssRegex.exec(fileContent)) !== null) {
      const [, prefix, name] = cssMatch;
      const type = prefix === '.' ? 'class' : 'id';
      const info = classMap.get(name) || { cssCount: 0, usageCount: 0, type };
      info.cssCount++;
      classMap.set(name, info);
    }
  }

  // Scan non-CSS files for class usage
  const nonCssFiles = await vscode.workspace.findFiles("**/*.{js,jsx,ts,tsx,html}", "**/node_modules/**");
  for (const file of nonCssFiles) {
    const content = await vscode.workspace.fs.readFile(file);
    const fileContent = Buffer.from(content).toString("utf8");
    const nonCssRegex = /(?:class|className)=(?:{`([^`]+)`}|["']([^"']+)["'])|(?<=\bid\s*=\s*["'])([\w-]+)(?=["'])/g;
    let nonCssMatch;
    while ((nonCssMatch = nonCssRegex.exec(fileContent)) !== null) {
      const classNames = (nonCssMatch[1] || nonCssMatch[2] || nonCssMatch[3] || '').split(/\s+/).filter(cls => cls && !cls.includes("$") && /^[\w-]+$/.test(cls));
      for (const className of classNames) {
        const info = classMap.get(className);
        if (info) {
          info.usageCount++;
        }
      }
    }
  }

  // Process current file
  const isCSS = document.languageId === 'css';
  const regex = isCSS
    ? /([.#])([\w-]+)\s*{/g
    : /(?:class|className)=(?:{`([^`]+)`}|["']([^"']+)["'])|(?<=\bid\s*=\s*["'])([\w-]+)(?=["'])/g;

  const decorations: vscode.DecorationOptions[] = [];
  const decoratedRanges = new Set<string>();

  let match;
  while ((match = regex.exec(text)) !== null) {
    const classNames = isCSS
      ? [match[2]]
      : (match[1] || match[2] || match[3] || '').split(/\s+/).filter(cls => cls && !cls.includes("$") && /^[\w-]+$/.test(cls));

    for (const className of classNames) {
      let info = classMap.get(className);
      if (!info) {
        info = { cssCount: 0, usageCount: 0, type: isCSS ? (match[1] === '.' ? 'class' : 'id') : 'class' };
        classMap.set(className, info);
      }

      const startPos = document.positionAt(match.index + match[0].indexOf(className));
      const endPos = document.positionAt(match.index + match[0].indexOf(className) + className.length);
      const range = new vscode.Range(startPos, endPos);
      const rangeKey = `${range.start.line},${range.start.character},${range.end.line},${range.end.character}`;

      if (!decoratedRanges.has(rangeKey)) {
        const hoverMessage = new vscode.MarkdownString()
          .appendMarkdown(`**${info.type.toUpperCase()}**: \`${className}\`\n\n`)
          .appendMarkdown(`Defined in CSS: ${info.cssCount} time${info.cssCount !== 1 ? 's' : ''}\n`)
          .appendMarkdown(`Used in other files: ${info.usageCount} time${info.usageCount !== 1 ? 's' : ''}`);

        if (info.cssCount > 1 && info.type === "id") {
          hoverMessage.appendMarkdown("\n\n**Warning**: IDs should be unique");
        }

        const decorationText = isCSS ? `  (${info.usageCount})` : `  (${info.cssCount})`;

        decorations.push({
          range,
          hoverMessage,
          renderOptions: {
            after: {
              contentText: decorationText,
              color: info.type === "class" ? "rgba(153, 153, 153, 0.7)" : "rgba(255, 165, 0, 0.7)",
              fontWeight: "normal",
            },
          },
        });
        decoratedRanges.add(rangeKey);
      }
    }
  }

  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
  currentDecorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(currentDecorationType, decorations);
}

function debounce(func: Function, wait: number): (...args: any[]) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function deactivate() {
  if (currentDecorationType) {
    currentDecorationType.dispose();
  }
}