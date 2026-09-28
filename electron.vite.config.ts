import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'electron-vite'
import { resolve } from 'node:path'

const sharedAlias = {
  '@shared': resolve('src/shared'),
  '@engine': resolve('src/engine'),
}

export default defineConfig(({ mode }) => {
  // RENDERER_PORT in .env.local lets several worktrees run `npm run dev` at once.
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env['RENDERER_PORT'] ?? 5173)

  return {
    main: {
      resolve: { alias: sharedAlias },
    },
    preload: {
      resolve: { alias: sharedAlias },
    },
    renderer: {
      resolve: { alias: { ...sharedAlias, '@renderer': resolve('src/renderer/src') } },
      plugins: [react()],
      server: { port, strictPort: true },
    },
  }
})
