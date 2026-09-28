import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import { handle } from '../lib/ipc'
import { dbPath } from '../db/client'
import { crearRespaldo, respaldoInfo } from '../services/backup'

export function register(): void {
  handle('respaldo', 'info', () => respaldoInfo(dbPath()))

  handle('respaldo', 'crear', async (_input, event) => {
    const options: OpenDialogOptions = {
      title: 'Elegir carpeta para el respaldo',
      buttonLabel: 'Guardar respaldo aquí',
      properties: ['openDirectory', 'createDirectory'],
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const carpeta = result.filePaths[0]
    if (result.canceled || !carpeta) return { cancelado: true, archivo: null }
    return { cancelado: false, archivo: await crearRespaldo(carpeta) }
  })
}
