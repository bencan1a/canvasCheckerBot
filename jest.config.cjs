/**
 * Jest configuration for CommonJS / ts-jest (minimal, CommonJS-friendly)
 *
 * This config was converted from an ESM-focused configuration to use ts-jest in CommonJS mode.
 * It runs tests against the compiled/ts-jest-processed CommonJS output.
 */
module.exports = {
  testEnvironment: 'node',

  // Use ts-jest preset for TypeScript -> CommonJS handling
  preset: 'ts-jest',

  globals: {
    'ts-jest': {
      // not using ESM mode
      useESM: false,
      tsconfig: 'tsconfig.json',
      diagnostics: false
    }
  },

  roots: ['<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

  // Transform TypeScript files using ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    "^'(.*)$": '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'  // Map .js imports to .ts files for TypeScript
  },

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  clearMocks: true,
  restoreMocks: true,

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  watchPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],

  verbose: true,

  transformIgnorePatterns: [
    'node_modules/(?!(@babel/runtime)/)'
  ]
};