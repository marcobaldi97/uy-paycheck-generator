// PDF export and printing. Main builds the receipts once and registers them as a print job under
// a hidden window, which loads the print route (`#/print/:liquidacionId[/:reciboId]`, T4). The
// route fetches `pdf.datosImpresion` (answered from the job), renders every receipt and calls
// `pdf.listo()`. Main waits for that signal (with a timeout: the route never signals on a load
// error) and then runs `printToPDF` or `print`. Exporting one PDF per receipt switches the hash
// in that same window instead of opening one window per receipt.

import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, type WebContents } from 'electron'
import dayjs from 'dayjs'
import { AppError } from '@shared/api'
import type {
  Impresora,
  IsoDate,
  Liquidacion,
  ModoExportacion,
  ReciboImpresion,
  ResultadoExportacion,
} from '@shared/types'
import type { Conn } from '../db/connection'
import { getDb } from '../db/connection'
import { loadRenderer, secureWebPreferences } from '../lib/window'
import { liquidacionesRepo, type ReciboRow } from '../repos/liquidaciones'
import { lector } from './recibo'

/** How long main waits for the print route to call `pdf.listo()`. */
export const LISTO_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------- data for the print route

/**
 * Receipts as printed, ordered by worker número, built with the same rules as the editor preview
 * (see ./recibo). Throws NO_ENCONTRADO, also when no empresa is saved for a borrador.
 */
export function datosImpresion(
  liquidacionId: number,
  reciboId: number | null,
  db: Conn = getDb(),
): ReciboImpresion[] {
  return construirImpresion(liquidacionId, reciboId, db).recibos
}

/** `datosImpresion` plus the liquidación it read, for callers that also need its dates. */
function construirImpresion(liquidacionId: number, reciboId: number | null, db: Conn = getDb()): TrabajoImpresion {
  const liquidaciones = liquidacionesRepo(db)
  const liquidacion = liquidaciones.get(liquidacionId)
  if (!liquidacion) throw new AppError('NO_ENCONTRADO', 'Liquidación no encontrada')

  let rows: ReciboRow[]
  if (reciboId === null) {
    rows = liquidaciones.listRecibos(liquidacionId)
  } else {
    const row = liquidaciones.getRecibo(reciboId)
    if (!row || row.liquidacionId !== liquidacionId) {
      throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
    }
    rows = [row]
  }

  const leer = lector(db, liquidacion, { sinEmpresa: 'error' })
  return { liquidacion, recibos: rows.map((row) => leer(row, liquidaciones.getLineas(row.id)).impresion) }
}

// ---------------------------------------------------------------- file names

/** Removes characters Windows forbids in file names and trailing dots and spaces. */
export function limpiarNombreArchivo(nombre: string): string {
  const limpio = nombre
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  return limpio === '' ? 'Recibo' : limpio
}

/** `Nombre--dd-mm-yyyy.pdf`, dated with the fecha de pago. */
export function nombreArchivo(nombre: string, fecha: IsoDate): string {
  return `${limpiarNombreArchivo(nombre)}--${dayjs(fecha).format('DD-MM-YYYY')}.pdf`
}

/** Appends ` (2)`, ` (3)`… to repeated names, case-insensitively (Windows file names). */
export function nombresUnicos(nombres: string[]): string[] {
  const usados = new Set<string>()
  return nombres.map((nombre) => {
    const base = nombre.replace(/\.pdf$/i, '')
    let candidato = nombre
    for (let n = 2; usados.has(candidato.toLowerCase()); n++) candidato = `${base} (${n}).pdf`
    usados.add(candidato.toLowerCase())
    return candidato
  })
}

// ---------------------------------------------------------------- ready signal

const esperando = new Map<number, () => void>()

/** Called by the `pdf.listo` handler with the sender's webContents id. Unknown senders are ignored. */
export function senalarListo(webContentsId: number): void {
  const resolver = esperando.get(webContentsId)
  if (!resolver) return
  esperando.delete(webContentsId)
  resolver()
}

/**
 * Resolves when the print route in `webContentsId` calls `pdf.listo()`. Rejects after `timeoutMs`
 * or when `abort` fires (window closed, renderer crashed).
 */
export function esperarListo(webContentsId: number, timeoutMs: number, abort: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const terminar = (): void => {
      clearTimeout(timer)
      abort.removeEventListener('abort', alAbortar)
      esperando.delete(webContentsId)
    }
    const timer = setTimeout(() => {
      terminar()
      reject(new AppError('INTERNO', 'Se agotó el tiempo de espera al preparar los recibos'))
    }, timeoutMs)
    const alAbortar = (): void => {
      terminar()
      reject(new AppError('INTERNO', 'La ventana de impresión se cerró inesperadamente'))
    }
    if (abort.aborted) return alAbortar()
    abort.addEventListener('abort', alAbortar)
    esperando.set(webContentsId, () => {
      terminar()
      resolve()
    })
  })
}

// ---------------------------------------------------------------- print jobs

/** Receipts already built for one print window, with the liquidación they belong to. */
export interface TrabajoImpresion {
  liquidacion: Liquidacion
  recibos: ReciboImpresion[]
}

/** Print jobs by the webContents id of their hidden window. */
const trabajos = new Map<number, TrabajoImpresion>()

/**
 * Answers `pdf.datosImpresion` for the sender `webContentsId`. A print window gets the receipts
 * of its job, already built by main; any other sender (the in-app preview) gets them built now.
 */
export function datosImpresionPara(
  webContentsId: number,
  liquidacionId: number,
  reciboId: number | null,
): ReciboImpresion[] {
  const trabajo = trabajos.get(webContentsId)
  if (!trabajo) return datosImpresion(liquidacionId, reciboId)
  if (trabajo.liquidacion.id !== liquidacionId) throw new AppError('NO_ENCONTRADO', 'Liquidación no encontrada')
  if (reciboId === null) return trabajo.recibos
  const recibo = trabajo.recibos.find((r) => r.reciboId === reciboId)
  if (!recibo) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
  return [recibo]
}

/** The hidden window of a print job. */
export interface VentanaImpresion {
  readonly contents: WebContents
  /**
   * Shows the print route for the whole job (`null`) or one of its receipts and waits for
   * `listo`. The first call loads the renderer; later ones switch the hash in the same document.
   */
  mostrar(reciboId: number | null): Promise<void>
}

/**
 * Opens a hidden window fed with `trabajo` and runs `usar` on it. The job is registered under
 * the window's webContents before anything loads; afterwards it is unregistered and the window
 * destroyed, also on failure.
 */
export async function conVentanaImpresion<T>(
  trabajo: TrabajoImpresion,
  usar: (ventana: VentanaImpresion) => Promise<T>,
  timeoutMs = LISTO_TIMEOUT_MS,
): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: secureWebPreferences(),
  })
  const contents = win.webContents
  const id = contents.id
  const abort = new AbortController()
  contents.once('render-process-gone', () => abort.abort())
  win.once('closed', () => abort.abort())
  trabajos.set(id, trabajo)

  let cargada = false
  let mostrada: string | null = null
  const ventana: VentanaImpresion = {
    contents,
    async mostrar(reciboId) {
      const ruta = rutaImpresion(trabajo.liquidacion.id, reciboId)
      if (ruta === mostrada) return
      // Armed before navigating so a fast `listo` is not missed.
      const listo = esperarListo(id, timeoutMs, abort.signal)
      // Avoid an unhandled rejection if navigating fails first.
      listo.catch(() => undefined)
      if (!cargada) {
        await loadRenderer(win, ruta)
        cargada = true
      } else {
        // Same `#/<ruta>` format as loadRenderer; the hash router re-renders without a reload.
        await contents.executeJavaScript(`location.hash = ${JSON.stringify(`#/${ruta}`)}`)
      }
      await listo
      mostrada = ruta
    },
  }

  try {
    return await usar(ventana)
  } finally {
    trabajos.delete(id)
    abort.abort()
    if (!win.isDestroyed()) win.destroy()
  }
}

function rutaImpresion(liquidacionId: number, reciboId: number | null): string {
  return reciboId === null ? `print/${liquidacionId}` : `print/${liquidacionId}/${reciboId}`
}

function generarPdf(contents: WebContents): Promise<Buffer> {
  return contents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })
}

// ---------------------------------------------------------------- exportar, imprimir, impresoras

/** Builds the print job once. Throws CONFLICTO when there is nothing to print. */
function recibosParaImprimir(liquidacionId: number, reciboId: number | null): TrabajoImpresion {
  const trabajo = construirImpresion(liquidacionId, reciboId)
  if (trabajo.recibos.length === 0) throw new AppError('CONFLICTO', 'La liquidación no tiene recibos')
  return trabajo
}

/**
 * `unico`: one PDF with every receipt, path chosen in a save dialog.
 * `por_trabajador`: one `Nombre--dd-mm-yyyy.pdf` per receipt in a folder chosen in a dialog.
 */
export async function exportar(
  liquidacionId: number,
  modo: ModoExportacion,
  parent: BrowserWindow | null = null,
): Promise<ResultadoExportacion> {
  const trabajo = recibosParaImprimir(liquidacionId, null)
  const { liquidacion, recibos } = trabajo
  const documentos = app.getPath('documents')

  if (modo === 'unico') {
    const opciones: Electron.SaveDialogOptions = {
      title: 'Exportar recibos',
      defaultPath: join(documentos, nombreArchivo(`Recibos ${liquidacion.periodo}`, liquidacion.fechaPago)),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    }
    const eleccion = parent ? await dialog.showSaveDialog(parent, opciones) : await dialog.showSaveDialog(opciones)
    if (eleccion.canceled || !eleccion.filePath) return { cancelado: true, archivos: [] }
    const destino = /\.pdf$/i.test(eleccion.filePath) ? eleccion.filePath : `${eleccion.filePath}.pdf`
    const pdf = await conVentanaImpresion(trabajo, async (ventana) => {
      await ventana.mostrar(null)
      return generarPdf(ventana.contents)
    })
    await writeFile(destino, pdf)
    return { cancelado: false, archivos: [destino] }
  }

  const opciones: Electron.OpenDialogOptions = {
    title: 'Carpeta para los recibos',
    defaultPath: documentos,
    properties: ['openDirectory', 'createDirectory'],
  }
  const eleccion = parent ? await dialog.showOpenDialog(parent, opciones) : await dialog.showOpenDialog(opciones)
  const carpeta = eleccion.filePaths[0]
  if (eleccion.canceled || !carpeta) return { cancelado: true, archivos: [] }

  const nombres = nombresUnicos(recibos.map((r) => nombreArchivo(r.trabajador.nombre, liquidacion.fechaPago)))
  const archivos: string[] = []
  // One window for every receipt: each one is a hash switch, not a new renderer.
  await conVentanaImpresion(trabajo, async (ventana) => {
    for (const [i, recibo] of recibos.entries()) {
      await ventana.mostrar(recibo.reciboId)
      const destino = join(carpeta, nombres[i]!)
      await writeFile(destino, await generarPdf(ventana.contents))
      archivos.push(destino)
    }
  })
  return { cancelado: false, archivos }
}

/**
 * Prints the whole liquidación or one receipt. `impresora` null shows the system print dialog;
 * otherwise prints silently to that printer. A cancelled dialog is not an error.
 */
export async function imprimir(
  liquidacionId: number,
  reciboId: number | null,
  impresora: string | null,
): Promise<null> {
  const trabajo = recibosParaImprimir(liquidacionId, reciboId)

  await conVentanaImpresion(trabajo, async ({ contents, mostrar }) => {
    await mostrar(reciboId)
    if (impresora !== null) {
      const disponibles = await contents.getPrintersAsync()
      if (!disponibles.some((p) => p.name === impresora)) {
        throw new AppError('NO_ENCONTRADO', `No se encontró la impresora "${impresora}"`)
      }
    }
    await new Promise<void>((resolve, reject) => {
      contents.print(
        {
          silent: impresora !== null,
          ...(impresora !== null ? { deviceName: impresora } : {}),
          printBackground: true,
          pageSize: 'A4',
          margins: { marginType: 'none' },
        },
        (ok, motivo) => {
          if (ok || /cancel/i.test(motivo)) resolve()
          else reject(new AppError('INTERNO', `No se pudo imprimir: ${motivo}`))
        },
      )
    })
  })
  return null
}

/** Installed printers, default first, then by name. */
export async function impresoras(contents: WebContents): Promise<Impresora[]> {
  const lista = await contents.getPrintersAsync()
  const predeterminada = await impresoraPredeterminada()
  return lista
    .map((p) => ({
      nombre: p.name,
      predeterminada: esPredeterminadaSegunOpciones(p.options) || p.name === predeterminada,
    }))
    .sort((a, b) => Number(b.predeterminada) - Number(a.predeterminada) || a.nombre.localeCompare(b.nombre))
}

function esPredeterminadaSegunOpciones(options: object | undefined): boolean {
  if (!options) return false
  const valores = options as Record<string, unknown>
  return ['is-default', 'printer-is-default', 'isDefault'].some((k) => String(valores[k]) === 'true')
}

/** Windows keeps the default printer in HKCU\...\Windows\Device as `Name,winspool,Ne00:`. */
function impresoraPredeterminada(): Promise<string | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows', '/v', 'Device'],
      { windowsHide: true, timeout: 5_000 },
      (error, stdout) => resolve(error ? null : parseDispositivoRegistro(stdout)),
    )
  })
}

/** Extracts the printer name from `reg query ... /v Device` output. */
export function parseDispositivoRegistro(salida: string): string | null {
  const match = /^\s*Device\s+REG_SZ\s+(.+)$/m.exec(salida)
  if (!match) return null
  const valor = match[1]!.trim()
  const coma = valor.indexOf(',')
  const nombre = (coma === -1 ? valor : valor.slice(0, coma)).trim()
  return nombre === '' ? null : nombre
}
