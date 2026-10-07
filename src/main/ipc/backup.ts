// respaldo: database backup. The folder dialog lives here; services/backup.ts has no Electron.

import { BrowserWindow, dialog, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron'
import { handle } from '../lib/ipc'
import { dbPath } from '../db/client'
import { crearRespaldo, respaldoInfo } from '../services/backup'

/** Asks for the destination folder, attached to the calling window. Null when cancelled. */
async function elegirCarpeta(event: IpcMainInvokeEvent): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: 'Elegir carpeta para el respaldo',
    buttonLabel: 'Guardar respaldo aquí',
    properties: ['openDirectory', 'createDirectory'],
  }
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const carpeta = result.filePaths[0]
  return result.canceled || !carpeta ? null : carpeta
}

export function register(): void {
  handle('respaldo', 'info', () => respaldoInfo(dbPath()))
  handle('respaldo', 'crear', async (_input, event) => {
    const carpeta = await elegirCarpeta(event)
    if (!carpeta) return { cancelado: true, archivo: null }
    return { cancelado: false, archivo: await crearRespaldo(carpeta) }
  })
}
