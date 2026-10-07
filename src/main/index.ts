import { app, BrowserWindow, shell } from 'electron'
import { initDb } from './db/client'
import { loadRenderer, secureWebPreferences } from './lib/window'
import { buscarActualizaciones } from './updater'

/** Every file in ./ipc exports `register()`, which calls `handle()` for its methods. */
interface IpcModule {
  register: () => void
}
const ipcModules = import.meta.glob<IpcModule>('./ipc/*.ts', { eager: true })

let mainWindow: BrowserWindow | null = null

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Recibos de sueldo',
    webPreferences: secureWebPreferences(),
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  void loadRenderer(mainWindow)
}

// One instance only: two processes must never write the same SQLite file.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('window-all-closed', () => app.quit())

  void app.whenReady().then(async () => {
    await initDb()
    for (const module of Object.values(ipcModules)) module.register()
    createMainWindow()
    if (mainWindow) buscarActualizaciones(mainWindow)
  })
}
