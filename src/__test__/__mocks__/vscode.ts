const vscode = {
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  workspace: {
    fs: {
      readFile: jest.fn(),
    },
  },
};

module.exports = vscode;
