import { BrowserWindow } from 'electron'
import { handle } from '../lib/ipc'
import { datosImpresion, exportar, impresoras, imprimir, senalarListo } from '../services/pdf'

export function register(): void {
  handle('pdf', 'datosImpresion', ({ liquidacionId, reciboId }) => datosImpresion(liquidacionId, reciboId))
  handle('pdf', 'listo', (_input, event) => {
    senalarListo(event.sender.id)
    return null
  })
  handle('pdf', 'exportar', ({ liquidacionId, modo }, event) =>
    exportar(liquidacionId, modo, BrowserWindow.fromWebContents(event.sender)),
  )
  handle('pdf', 'impresoras', (_input, event) => impresoras(event.sender))
  handle('pdf', 'imprimir', ({ liquidacionId, reciboId, impresora }) =>
    imprimir(liquidacionId, reciboId, impresora),
  )
}
