import * as vscode from "vscode";

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
  if (!editor) {
    console.log("No active editor found");
    return;
  }

  try {
    const document = editor.document;
    const text = document.getText();
    console.log(`Scanning file: ${document.fileName}`);

    const classMap = new Map<string, { count: number; type: string }>();

    // Updated regex to correctly capture classes with dashes
    const classRegex = /(?:class|className)=["']([^"']+)["']|(?<=\.)([\w-]+)/g;
    const idRegex = /(?:id)=["']([^"']+)["']|(?<=#)([\w-]+)/g;
    let match;

    // Scan all CSS files in the workspace to collect defined classes
    const cssFiles = await vscode.workspace.findFiles(
      "**/*.css",
      "**/node_modules/**"
    );
    for (const file of cssFiles) {
      console.log(`Scanning CSS file: ${file.fsPath}`);
      const content = await vscode.workspace.fs.readFile(file);
      const fileContent = Buffer.from(content).toString("utf8");

      while ((match = classRegex.exec(fileContent)) !== null) {
        const classes = (match[1] || match[2]).split(/\s+/);
        classes.forEach((cls) => {
          if (cls && !classMap.has(cls)) {
            classMap.set(cls, { count: 0, type: "class" });
            console.log(`Found class in CSS file: ${cls}`);
          }
        });
      }
    }

    // Scan all non-CSS files to count class usage
    const nonCssFiles = await vscode.workspace.findFiles(
      "**/*.{tsx,jsx,html,js,ts}",
      "**/node_modules/**"
    );
    for (const file of nonCssFiles) {
      console.log(`Scanning non-CSS file: ${file.fsPath}`);
      const content = await vscode.workspace.fs.readFile(file);
      const fileContent = Buffer.from(content).toString("utf8");

      // Updated regex to handle more complex class assignments
      const jsxClassRegex =
        /(?:class|className)=(?:{`([^`]+)`}|["']([^"']+)["'])/g;
      let match;
      while ((match = jsxClassRegex.exec(fileContent)) !== null) {
        const classString = match[1] || match[2];
        // Split the class string and handle conditional classes
        const classes = classString.split(/\s+/).flatMap((cls) => {
          if (cls.includes("${")) {
            // Handle conditional classes
            return (
              cls
                .match(/\$\{[^}]+\}/g)
                ?.map((cond) => cond.slice(2, -1).split(":").pop()?.trim()) ||
              []
            );
          }
          return cls;
        });

        classes.forEach((cls) => {
          if (cls && !cls.includes("$")) {
            // Exclude any remaining template literal syntax
            const existingClass = classMap.get(cls);
            if (existingClass) {
              existingClass.count++;
            } else {
              classMap.set(cls, { count: 1, type: "class" });
            }
            console.log(`Found class usage in non-CSS file: ${cls}`);
          }
        });
      }
    }

    // Scan for IDs in the current file
    while ((match = idRegex.exec(text)) !== null) {
      const id = match[1] || match[2];
      if (id) {
        classMap.set(id, { count: 1, type: "id" });
        console.log(`Found ID in current file: ${id}`);
      }
    }

    console.log(
      `Classes and IDs found: ${JSON.stringify(Object.fromEntries(classMap))}`
    );

    const decorationType = vscode.window.createTextEditorDecorationType({});
    const decorations: vscode.DecorationOptions[] = [];
    const decoratedRanges = new Set<string>();

    const isCSS = document.languageId === "css";

    for (const [name, { count, type }] of classMap.entries()) {
      // Use word boundaries to match full class names
      const regex = new RegExp(`\\b${name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + name.length);
        const range = new vscode.Range(startPos, endPos);
        const rangeKey = `${range.start.line},${range.start.character},${range.end.line},${range.end.character}`;

        if (!decoratedRanges.has(rangeKey)) {
          const hoverMessage = new vscode.MarkdownString();
          hoverMessage.appendMarkdown(
            `**${type.toUpperCase()}**: \`${name}\`\n\n`
          );
          hoverMessage.appendMarkdown(
            `Used ${count} time${count !== 1 ? "s" : ""}`
          );

          if (count > 1 && type === "id") {
            hoverMessage.appendMarkdown(
              "\n\n**Warning**: IDs should be unique"
            );
          }

          const decoration: vscode.DecorationOptions = {
            range,
            hoverMessage,
            renderOptions: {
              after: {
                contentText: isCSS ? `  (${count})` : "",
                color:
                  type === "class"
                    ? "rgba(153, 153, 153, 0.7)"
                    : "rgba(255, 165, 0, 0.7)",
                fontWeight: "normal",
              },
            },
          };
          decorations.push(decoration);
          decoratedRanges.add(rangeKey);
        }
      }
    }

    editor.setDecorations(decorationType, decorations);
    console.log(`CSS classes and IDs counted: ${classMap.size}`);
  } catch (error) {
    console.error("Error in countCssClasses:", error);
    vscode.window.showErrorMessage(
      `Error counting CSS classes and IDs: ${error}`
    );
  }
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

export function deactivate() {}