import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import { builtinModules } from 'node:module'
import tseslint from 'typescript-eslint'

// Import boundaries from CLAUDE.md, enforced per layer.
const nodeAndDb = {
  paths: builtinModules.map((name) => ({ name, message: 'No Node APIs in this layer.' })),
  patterns: [
    { regex: '^node:', message: 'No Node APIs in this layer.' },
    { regex: '^(electron|better-sqlite3|drizzle-orm|drizzle-kit)(/|$)', message: 'No Electron or DB in this layer.' },
    { regex: '(^|/)(main|preload)(/|$)', message: 'Do not import main or preload code here.' },
  ],
}
const noEngine = { regex: '^@engine(/|$)|(^|/)engine(/|$)', message: 'Only main computes paychecks.' }
const noUi = { regex: '^(react|react-dom|react-router|@mantine/.*|@tanstack/.*)(/|$)|(^|/)renderer(/|$)', message: 'No UI code in this layer.' }

export default defineConfig(
  { ignores: ['out/**', 'dist/**', 'drizzle/**', 'node_modules/**', '.claude/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': ['error', { ...nodeAndDb, patterns: [...nodeAndDb.patterns, noEngine] }],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { ...nodeAndDb, patterns: [...nodeAndDb.patterns, noUi] }],
    },
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { ...nodeAndDb, patterns: [...nodeAndDb.patterns, noEngine, noUi] }],
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', '*.config.{ts,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
)
