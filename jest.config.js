// Jest configuration for IDE compatibility
// This file uses ES module syntax for IDEs that expect .js files

export default {
  // Force Node.js environment (not browser/jsdom)
  testEnvironment: 'node',
  
  // Specify directories
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  
  // Critical: Transform TypeScript files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      // Use CommonJS for compatibility
      useESM: false,
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
        skipLibCheck: true,
        declaration: false,
        declarationMap: false,
        sourceMap: false
      }
    }]
  },
  
  // Handle module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Map .js imports to .ts files
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // File extensions to treat as modules
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Clear and restore mocks for each test
  clearMocks: true,
  restoreMocks: true,
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Path ignores for watch mode
  watchPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  
  // Verbose output
  verbose: true,
  
  // Ensure transformIgnorePatterns includes node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(@babel/runtime)/)'
  ]
};