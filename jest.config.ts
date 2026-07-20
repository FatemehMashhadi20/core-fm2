// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Collab Digital Twins

import type { Config } from 'jest'
import nextJest from 'next/jest.js'

// core-local is a component library, not a Next.js app (no pages/app dir), so
// nextJest() is called with no `dir` — that skips next.config.js/env loading
// (which requires a pages/app dir) while still providing the SWC TS/JSX
// transform and CSS/image mocks.
const createJestConfig = nextJest()

// Add any custom config to be passed to Jest
const customJestConfig: Config = {
  testEnvironment: 'jsdom', // Tells Jest to run tests in a browser-like environment - for testing React components
  coverageProvider: 'v8', // Use V8's built-in code coverage to track which lines of code are executed during tests

  // Doesn't look for test files in these directories - speeds up test runs by ignoring irrelevant directories
  testPathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],

  // Collect coverage from all TypeScript files in the src directory, excluding declaration files and test files
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/types/**',
    '!src/**/index.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Path to the setup file that configures the testing environment before each test runs
  clearMocks: true, // Clears mock calls/instances/results before every test to ensure tests are independent

  // Resolve the "@/*" path alias used across src (mirrors tsconfig.json's "paths").
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig)
