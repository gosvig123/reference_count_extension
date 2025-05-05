module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/test/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/test/**',
    '!**/node_modules/**',
  ],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  // Mock vscode module
  moduleNameMapper: {
    'vscode': '<rootDir>/src/test/mocks/vscode.ts'
  },
  // Handle open handles
  testTimeout: 10000,
  forceExit: true,
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
};
