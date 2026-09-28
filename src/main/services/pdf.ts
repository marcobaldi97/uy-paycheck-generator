// PDF export and printing. A hidden window loads the print route (`#/print/:liquidacionId[/:reciboId]`,
// T4), which fetches `pdf.datosImpresion`, renders every receipt and calls `pdf.listo()`. Main waits
// for that signal (with a timeout: the route never signals on a load error) and then runs
// `printToPDF` or `print`.

import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, type WebContents } from 'electron'
import dayjs from 'dayjs'
import { AppError } from '@shared/api'
import type {
  Empresa,
  Impresora,
  IsoDate,
  Liquidacion,
  ModoExportacion,
  ReciboImpresion,
  ResultadoExportacion,
  TrabajadorSnapshot,
} from '@shared/types'
import type { Conn } from '../db/connection'
import { getDb } from '../db/connection'
import { loadRenderer, secureWebPreferences } from '../lib/window'
import { empresaRepo } from '../repos/empresa'
import { liquidacionesRepo, type ReciboRow } from '../repos/liquidaciones'
import { trabajadoresRepo } from '../repos/trabajadores'

/** How long main waits for the print route to call `pdf.listo()`. */
export const LISTO_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------- data for the print route

/**
 * Receipts as printed, ordered by worker número. An emitida liquidación uses the snapshots stored
 * on each recibo; a borrador uses the current empresa and worker (sueldo nominal from the
 * condition in force on the last day of the period). Throws NO_ENCONTRADO.
 */
export function datosImpresion(
  liquidacionId: number,
  reciboId: number | null,
  db: Conn = getDb(),
): ReciboImpresion[] {
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

  let empresaActual: Empresa | null | undefined
  const getEmpresaActual = (): Empresa => {
    if (empresaActual === undefined) empresaActual = empresaRepo(db).get()
    if (!empresaActual) {
      throw new AppError('NO_ENCONTRADO', 'Complete los datos de la empresa antes de imprimir')
    }
    return empresaActual
  }

  return rows.map((row) => ({
    reciboId: row.id,
    empresa: row.snapshotEmpresa ?? getEmpresaActual(),
    trabajador: row.snapshotTrabajador ?? trabajadorActual(db, row.trabajadorId, liquidacion),
    liquidacion: {
      periodo: liquidacion.periodo,
      fechaCargo: liquidacion.fechaCargo,
      fechaPago: liquidacion.fechaPago,
    },
    lineas: liquidaciones.getLineas(row.id),
    totales: row.totales,
  }))
}

function trabajadorActual(db: Conn, trabajadorId: number, liquidacion: Liquidacion): TrabajadorSnapshot {
  const repo = trabajadoresRepo(db)
  const trabajador = repo.get(trabajadorId)
  if (!trabajador) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
  const finDePeriodo = dayjs(`${liquidacion.periodo}-01`).endOf('month').format('YYYY-MM-DD')
  const condicion = repo.condicionVigente(trabajadorId, finDePeriodo)
  const { activo: _activo, ...datos } = trabajador
  return { ...datos, sueldoNominal: condicion?.sueldoNominal ?? 0 }
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

/**
 * Opens a hidden window at the print route, waits for `listo` and runs `trabajo` on its
 * webContents. The window is always destroyed afterwards.
 */
export async function conVentanaImpresion<T>(
  liquidacionId: number,
  reciboId: number | null,
  trabajo: (contents: WebContents) => Promise<T>,
  timeoutMs = LISTO_TIMEOUT_MS,
): Promise<T> {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: secureWebPreferences(),
  })
  const abort = new AbortController()
  win.webContents.once('render-process-gone', () => abort.abort())
  win.once('closed', () => abort.abort())
  try {
    const listo = esperarListo(win.webContents.id, timeoutMs, abort.signal)
    // Avoid an unhandled rejection if loading fails first.
    listo.catch(() => undefined)
    const route = reciboId === null ? `print/${liquidacionId}` : `print/${liquidacionId}/${reciboId}`
    await loadRenderer(win, route)
    await listo
    return await trabajo(win.webContents)
  } finally {
    abort.abort()
    if (!win.isDestroyed()) win.destroy()
  }
}

async function generarPdf(liquidacionId: number, reciboId: number | null): Promise<Buffer> {
  return conVentanaImpresion(liquidacionId, reciboId, (contents) =>
    contents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
  )
}

// ---------------------------------------------------------------- exportar, imprimir, impresoras

function recibosParaImprimir(liquidacionId: number): { liquidacion: Liquidacion; recibos: ReciboImpresion[] } {
  const liquidacion = liquidacionesRepo().get(liquidacionId)
  if (!liquidacion) throw new AppError('NO_ENCONTRADO', 'Liquidación no encontrada')
  const recibos = datosImpresion(liquidacionId, null)
  if (recibos.length === 0) throw new AppError('CONFLICTO', 'La liquidación no tiene recibos')
  return { liquidacion, recibos }
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
  const { liquidacion, recibos } = recibosParaImprimir(liquidacionId)
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
    await writeFile(destino, await generarPdf(liquidacionId, null))
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
  for (const [i, recibo] of recibos.entries()) {
    const destino = join(carpeta, nombres[i]!)
    await writeFile(destino, await generarPdf(liquidacionId, recibo.reciboId))
    archivos.push(destino)
  }
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
  const recibos = datosImpresion(liquidacionId, reciboId)
  if (recibos.length === 0) throw new AppError('CONFLICTO', 'La liquidación no tiene recibos')

  await conVentanaImpresion(liquidacionId, reciboId, async (contents) => {
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
