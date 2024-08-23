module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleNameMapper: {
    "^vscode$": "<rootDir>/src/__mocks__/vscode.ts",
  },
  moduleDirectories: ["node_modules", "src", "src/__test__/testFiles"],
  globalTeardown: '<rootDir>/src/__test__/globalTeardown.js',
};