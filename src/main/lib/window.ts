import { app, type BrowserWindow, type WebPreferences } from 'electron'
import { join } from 'node:path'

/** webPreferences every window uses (main window and the hidden print window). */
export function secureWebPreferences(): WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  }
}

/**
 * Loads the renderer at a hash route, e.g. `loadRenderer(win, 'print/3')`.
 * Dev uses the electron-vite server; production loads the built file (hash router).
 */
export function loadRenderer(win: BrowserWindow, route = ''): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) return win.loadURL(`${devUrl}#/${route}`)
  return win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${route}` })
}
