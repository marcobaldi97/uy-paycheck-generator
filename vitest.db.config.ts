// `npm run test:db`: main-process tests, run by Electron with ELECTRON_RUN_AS_NODE=1 so
// better-sqlite3 loads in the same runtime the app uses.

import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@engine': resolve('src/engine'),
    },
  },
  test: {
    name: 'db',
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    pool: 'forks',
  },
})
