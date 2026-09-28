// `npm test`: engine and shared under Node, renderer under jsdom.
// Tests that load better-sqlite3 live in src/main and run with `npm run test:db` instead.

import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = {
  '@shared': resolve('src/shared'),
  '@engine': resolve('src/engine'),
  '@renderer': resolve('src/renderer/src'),
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/engine/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts'],
        },
      },
    ],
  },
})
