export function getFunctionDefinitions(languageId: string, code: string): string[] {
  switch (languageId) {
    case 'python':
      return findPythonFunctionDefinitions(tokenizePython(code));
    case 'javascript':
    case 'typescript':
      return findJSFunctionDefinitions(tokenizeJS(code));
    case 'javascriptreact':
    case 'typescriptreact':
      return findReactFunctionDefinitions(tokenizeReact(code));
    default:
      return []; // Empty array for unsupported file types
  }
}

function tokenizePython(code: string): string[] {
  // Tokenize the code, splitting on whitespace and preserving important symbols
  return code.split(/(\s+|\(|\)|:)/).filter((token) => token.trim() !== '');
}

export function getFunctionUsages(languageId: string, code: string): string[] {
  switch (languageId) {
    case 'python':
      return findPythonFunctionUsages(tokenizePython(code));
    case 'javascript':
    case 'typescript':
    case 'javascriptreact':
    case 'typescriptreact':
      return findJSFunctionUsages(tokenizeJS(code));
    default:
      return []; // Empty array for unsupported file types
  }
}

function findPythonFunctionUsages(tokens: string[]): string[] {
  const usages: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'def' && tokens[i] !== 'class' &&
        i + 1 < tokens.length && tokens[i + 1] === '(' &&
        !['if', 'for', 'while'].includes(tokens[i]) &&
        (i === 0 || tokens[i - 1] !== '.') &&
        (i < 2 || tokens[i - 2] !== 'def') &&
        (i === 0 || tokens[i - 1] !== 'def')) {
      usages.push(tokens[i]);
    }
  }
  return usages;
}

function tokenizeJS(code: string): string[] {
  // Tokenize the code, splitting on whitespace and preserving important symbols
  return code.split(/(\s+|\(|\)|=|=>|{|}|,)/).filter((token) => token.trim() !== '');
}

function findJSFunctionUsages(tokens: string[]): string[] {
  const usages: string[] = [];
  let skipNext = false;
  for (let i = 0; i < tokens.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if ((tokens[i] === 'function' && i + 1 < tokens.length) ||
        (tokens[i] === '=' && i + 1 < tokens.length && tokens[i + 1] === '>')) {
      skipNext = true;
      continue;
    }
    if (tokens[i] !== 'function' && tokens[i] !== 'class' &&
        i + 1 < tokens.length && tokens[i + 1] === '(' &&
        !['if', 'for', 'while', 'switch'].includes(tokens[i]) &&
        (i === 0 || tokens[i - 1] !== '.')) {
      usages.push(tokens[i]);
    }
  }
  return usages;
}

function tokenizeReact(code: string): string[] {
  // Similar to JS/TS tokenization, but also preserve JSX syntax
  return code.split(/(\s+|\(|\)|=|=>|{|}|,|<|>|\/|:)/).filter((token) => token.trim() !== '');
}

function findPythonFunctionDefinitions(tokens: string[]): string[] {
  const functions: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'def' && i + 1 < tokens.length) {
      functions.push(tokens[i + 1]);
    }
  }
  return functions;
}

function findJSFunctionDefinitions(tokens: string[]): string[] {
  const functions: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'function' && i + 1 < tokens.length) {
      functions.push(tokens[i + 1]);
    } else if (
      ['const', 'let', 'var'].includes(tokens[i]) &&
      i + 2 < tokens.length &&
      tokens[i + 2] === '=' &&
      (tokens[i + 3] === 'function' || tokens[i + 3] === '(')
    ) {
      functions.push(tokens[i + 1]);
    } else if (tokens[i] === 'class' && i + 1 < tokens.length) {
      functions.push(tokens[i + 1]);
    } else if (
      i + 2 < tokens.length &&
      tokens[i + 1] === '=' &&
      (tokens[i + 2] === 'function' || tokens[i + 2] === '(')
    ) {
      functions.push(tokens[i]);
    }
  }
  return functions;
}

function findReactFunctionDefinitions(tokens: string[]): string[] {
  const functions: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (
      ['function', 'const', 'let', 'var'].includes(tokens[i]) &&
      i + 2 < tokens.length &&
      (tokens[i + 2] === '=' || tokens[i + 2] === '(')
    ) {
      functions.push(tokens[i + 1]);
    } else if (tokens[i] === 'React' && i + 2 < tokens.length && ['memo', 'forwardRef'].includes(tokens[i + 2])) {
      functions.push(tokens[i - 1]);
    }
  }
  return functions;
}
