import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AppError, type ApiResult } from '@shared/api'
import type { CondicionInput, Empresa, Linea, ReciboImpresion, TrabajadorInput } from '@shared/types'
import { setDb, type Db } from '../db/connection'
import { openTestDb } from '../db/testing'
import { empresaRepo } from '../repos/empresa'
import { liquidacionesRepo } from '../repos/liquidaciones'
import { trabajadoresRepo } from '../repos/trabajadores'
import { liquidacionesService } from './liquidaciones'
import type { TrabajoImpresion } from './pdf'

// ---------------------------------------------------------------- electron fakes

const fake = vi.hoisted(() => ({
  ventanas: [] as FakeWindowShape[],
  rutas: [] as string[],
  comportamiento: 'listo' as 'listo' | 'silencio' | 'crash',
  printOpciones: [] as unknown[],
  printResultado: { ok: true, motivo: '' },
  impresoras: [
    { name: 'HP LaserJet', displayName: 'HP LaserJet', description: '', options: {} },
    { name: 'Brother', displayName: 'Brother', description: '', options: { 'printer-is-default': 'true' } },
  ],
  saveDialog: { canceled: false, filePath: '' } as { canceled: boolean; filePath?: string },
  openDialog: { canceled: false, filePaths: [] as string[] },
  /** loadRenderer calls, i.e. full renderer loads. */
  cargas: 0,
  /** What the simulated print route got from `pdf.datosImpresion`. */
  respuestas: [] as ApiResult<ReciboImpresion[]>[],
  /** Reads through liquidacionesRepo, to tell whether receipts were built more than once. */
  lecturas: { get: 0, listRecibos: 0 },
  abrirRuta: null as ((contents: FakeContentsShape, ruta: string) => void) | null,
}))

interface FakeContentsShape extends EventEmitter {
  id: number
  ruta: string
  printToPDF: Mock<() => Promise<Buffer>>
  executeJavaScript: Mock<(codigo: string) => Promise<void>>
}

interface FakeWindowShape {
  webContents: FakeContentsShape
  destroyed: boolean
}

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  let nextId = 100
  class FakeWebContents extends EventEmitter {
    id = nextId++
    ruta = ''
    printToPDF = vi.fn(async () => Buffer.from(`%PDF-${this.ruta}`))
    // Only the hash switch done by the print job is expected here.
    executeJavaScript = vi.fn(async (codigo: string) => {
      const hash = /^location\.hash = (".*")$/.exec(codigo)?.[1]
      if (hash === undefined) throw new Error(`Unexpected script: ${codigo}`)
      fake.abrirRuta?.(this, (JSON.parse(hash) as string).replace(/^#\//, ''))
    })
    getPrintersAsync = vi.fn(async () => fake.impresoras)
    print = vi.fn((opciones: unknown, cb: (ok: boolean, motivo: string) => void) => {
      fake.printOpciones.push(opciones)
      setTimeout(() => cb(fake.printResultado.ok, fake.printResultado.motivo), 0)
    })
  }
  class BrowserWindow extends EventEmitter {
    webContents = new FakeWebContents()
    destroyed = false
    constructor(readonly opciones: unknown) {
      super()
      fake.ventanas.push(this)
    }
    isDestroyed(): boolean {
      return this.destroyed
    }
    destroy(): void {
      this.destroyed = true
      this.emit('closed')
    }
    static fromWebContents(): null {
      return null
    }
  }
  return {
    app: { getPath: () => tmpdir(), isPackaged: false },
    BrowserWindow,
    dialog: {
      showSaveDialog: vi.fn(async () => fake.saveDialog),
      showOpenDialog: vi.fn(async () => fake.openDialog),
    },
    ipcMain: { handle: vi.fn() },
  }
})

vi.mock('../lib/window', () => ({
  secureWebPreferences: () => ({ sandbox: true }),
  loadRenderer: vi.fn(async (win: { webContents: FakeContentsShape }, route: string) => {
    fake.cargas++
    fake.abrirRuta?.(win.webContents, route)
  }),
}))

vi.mock('../repos/liquidaciones', async (importOriginal) => {
  const real = await importOriginal<typeof import('../repos/liquidaciones')>()
  return {
    ...real,
    liquidacionesRepo: (...args: Parameters<typeof real.liquidacionesRepo>) => {
      const repo = real.liquidacionesRepo(...args)
      return {
        ...repo,
        get: (id: number) => {
          fake.lecturas.get++
          return repo.get(id)
        },
        listRecibos: (liquidacionId: number) => {
          fake.lecturas.listRecibos++
          return repo.listRecibos(liquidacionId)
        },
      }
    },
  }
})

const pdf = await import('./pdf')

// The real IPC handlers, captured from the mocked ipcMain.handle.
type FakeHandler = (event: { sender: { id: number } }, input?: unknown) => Promise<ApiResult<unknown>>
const { ipcMain } = await import('electron')
;(await import('../ipc/pdf')).register()
function handler(method: string): FakeHandler {
  const registrado = vi.mocked(ipcMain.handle).mock.calls.find(([canal]) => canal === `pdf:${method}`)
  return registrado![1] as unknown as FakeHandler
}
const datosHandler = handler('datosImpresion') as (
  event: { sender: { id: number } },
  input: { liquidacionId: number; reciboId: number | null },
) => Promise<ApiResult<ReciboImpresion[]>>
const listoHandler = handler('listo')

// Simulates the print route at `ruta`: it fetches pdf.datosImpresion over IPC and signals listo,
// stays silent, or crashes.
fake.abrirRuta = (contents, ruta) => {
  fake.rutas.push(ruta)
  contents.ruta = ruta
  setTimeout(() => {
    void (async () => {
      if (fake.comportamiento === 'crash') return void contents.emit('render-process-gone')
      if (fake.comportamiento === 'silencio') return
      const [, liquidacionId, reciboId] = ruta.split('/')
      const result = await datosHandler(
        { sender: contents },
        { liquidacionId: Number(liquidacionId), reciboId: reciboId === undefined ? null : Number(reciboId) },
      )
      fake.respuestas.push(result)
      if (result.ok) await listoHandler({ sender: contents })
    })()
  }, 5)
}

// ---------------------------------------------------------------- fixtures

const EMPRESA: Empresa = {
  nombre: 'Ejemplo SA',
  direccion: 'Av. Italia 1234',
  rut: '211234560018',
  nroMtss: '123456',
  afiliacionBps: '',
  carpetaBse: '',
  grupo: '10',
  subgrupo: '01',
}

function trabajador(numero: number, nombre: string): TrabajadorInput {
  return {
    numero,
    ci: `1.234.56${numero}-7`,
    nombre,
    cargo: 'Administrativo',
    fechaIngreso: '2020-03-01',
    activo: true,
  }
}

function condicion(vigenteDesde: string, sueldoNominal: number): CondicionInput {
  return {
    vigenteDesde,
    sueldoNominal,
    fonasaConyuge: false,
    fonasaHijos: false,
    fonasaTasaManual: null,
    irpfHijos: 0,
    irpfHijosDiscapacidad: 0,
    irpfPctAtribucion: 100,
    irpfOtrasDeducciones: 0,
  }
}

const LINEA: Linea = {
  codigo: 'SUELDO',
  descripcion: 'Sueldo',
  cantidad: '30',
  valorUnitario: 1_000_000,
  importe: 3_000_000,
  tipo: 'haber',
  orden: 1,
  origen: 'auto',
  override: false,
}

const TOTALES = { imponibleBps: 3_000_000, imponibleIrpf: 3_000_000, totalHaberes: 3_000_000, totalDescuentos: 0, liquido: 3_000_000 }

let db: Db
let dir: string
let siguienteNumero = 1

function crearLiquidacion(nombres: string[], periodo = '2024-08') {
  const trabajadores = trabajadoresRepo(db)
  const liquidaciones = liquidacionesRepo(db)
  const liq = liquidaciones.create({ periodo, fechaCargo: `${periodo}-31`, fechaPago: '2024-09-05' })
  // Inserted in reverse so ordering by número is observable.
  const recibos = nombres
    .map((nombre) => ({ nombre, numero: siguienteNumero++ }))
    .reverse()
    .map(({ nombre, numero }) => {
      const t = trabajadores.create(trabajador(numero, nombre))
      trabajadores.addCondicion(t.id, condicion('2024-01-01', 2_500_000))
      trabajadores.addCondicion(t.id, condicion('2024-08-15', 3_000_000))
      trabajadores.addCondicion(t.id, condicion('2024-09-01', 9_999_999))
      return liquidaciones.insertRecibo(liq.id, t.id, {
        entradas: { diasNoTrabajados: 0, lineasManuales: [], overrides: null },
        totales: TOTALES,
        lineas: [LINEA],
        valoresCalculados: { montepioTasa: '0.15', fonasaTasa: '0.045', frlTasa: '0.00125', irpfImporte: 0 },
      })
    })
  return { liq, recibos: recibos.reverse() }
}

async function expectAppError(promise: Promise<unknown>, code: AppError['code']): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(AppError)
  expect((error as AppError).code).toBe(code)
}

/** A print job for the whole liquidación, built as exportar does. */
function trabajoDe(liquidacionId: number): TrabajoImpresion {
  return { liquidacion: liquidacionesRepo(db).get(liquidacionId)!, recibos: pdf.datosImpresion(liquidacionId, null, db) }
}

function empresaDe(result: ApiResult<ReciboImpresion[]>): string | undefined {
  return result.ok ? result.data[0]?.empresa.nombre : undefined
}

beforeEach(async () => {
  db = openTestDb()
  setDb(db)
  empresaRepo(db).save(EMPRESA)
  dir = await mkdtemp(join(tmpdir(), 'recibos-pdf-'))
  fake.ventanas.length = 0
  fake.rutas.length = 0
  fake.printOpciones.length = 0
  fake.comportamiento = 'listo'
  fake.printResultado = { ok: true, motivo: '' }
  fake.cargas = 0
  fake.respuestas.length = 0
  fake.lecturas = { get: 0, listRecibos: 0 }
})

afterEach(async () => {
  setDb(null)
  await rm(dir, { recursive: true, force: true })
})

// ---------------------------------------------------------------- tests

describe('datosImpresion', () => {
  it('builds borrador receipts from current data, ordered by número', () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz'])
    const datos = pdf.datosImpresion(liq.id, null, db)
    expect(datos.map((d) => d.trabajador.nombre)).toEqual(['Ana Pérez', 'Bruno Díaz'])
    expect(datos[0]).toMatchObject({
      reciboId: recibos[0]!.id,
      empresa: EMPRESA,
      liquidacion: { periodo: '2024-08', fechaCargo: '2024-08-31', fechaPago: '2024-09-05' },
      lineas: [LINEA],
      totales: TOTALES,
    })
    // The stored SUELDO line, not a condición resolved on read.
    expect(datos[0]!.trabajador.sueldoNominal).toBe(LINEA.importe)
    expect(datos[0]!.trabajador).not.toHaveProperty('activo')
  })

  it('uses the snapshots of an emitida', () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez'])
    const snapshot = { ...pdf.datosImpresion(liq.id, null, db)[0]!.trabajador, nombre: 'Ana (snapshot)' }
    liquidacionesRepo(db).setSnapshots(recibos[0]!.id, { ...EMPRESA, nombre: 'Vieja SA' }, snapshot)
    empresaRepo(db).save({ ...EMPRESA, nombre: 'Nueva SA' })
    const [dato] = pdf.datosImpresion(liq.id, recibos[0]!.id, db)
    expect(dato!.empresa.nombre).toBe('Vieja SA')
    expect(dato!.trabajador.nombre).toBe('Ana (snapshot)')
  })

  it('returns one receipt and rejects unknown or foreign ones', () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz'])
    const otra = crearLiquidacion(['Carla Ruiz'], '2024-09')
    expect(pdf.datosImpresion(liq.id, recibos[1]!.id, db).map((d) => d.reciboId)).toEqual([recibos[1]!.id])
    expect(() => pdf.datosImpresion(liq.id, otra.recibos[0]!.id, db)).toThrow(AppError)
    expect(() => pdf.datosImpresion(9999, null, db)).toThrow(AppError)
  })

  it('matches the editor preview; without empresa the preview is blank and printing fails', () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz'])
    const servicio = liquidacionesService(db)
    const datos = pdf.datosImpresion(liq.id, null, db)
    expect(recibos.map((r) => servicio.obtenerRecibo(r.id).impresion)).toEqual(datos)

    db.$client.prepare('DELETE FROM empresa').run()
    expect(servicio.obtenerRecibo(recibos[0]!.id).impresion.empresa).toEqual({
      nombre: '',
      direccion: '',
      rut: '',
      nroMtss: '',
      afiliacionBps: '',
      carpetaBse: '',
      grupo: '',
      subgrupo: '',
    })
    expect(() => pdf.datosImpresion(liq.id, null, db)).toThrow(/empresa/)
  })

  it('returns an empty list for a liquidación without receipts', () => {
    const liq = liquidacionesRepo(db).create({ periodo: '2024-10', fechaCargo: '2024-10-31', fechaPago: '2024-11-05' })
    expect(pdf.datosImpresion(liq.id, null, db)).toEqual([])
  })
})

describe('file names', () => {
  it('formats Nombre--dd-mm-yyyy.pdf and strips forbidden characters', () => {
    expect(pdf.nombreArchivo('Juan Carmona', '2024-09-05')).toBe('Juan Carmona--05-09-2024.pdf')
    expect(pdf.nombreArchivo(' A/B:C*D?  ', '2024-09-05')).toBe('ABCD--05-09-2024.pdf')
    expect(pdf.nombreArchivo('...', '2024-09-05')).toBe('Recibo--05-09-2024.pdf')
  })

  it('deduplicates repeated names', () => {
    expect(pdf.nombresUnicos(['a.pdf', 'b.pdf', 'A.pdf', 'a.pdf'])).toEqual(['a.pdf', 'b.pdf', 'A (2).pdf', 'a (3).pdf'])
  })

  it('parses the default printer from the registry', () => {
    const salida = '\r\nHKEY_CURRENT_USER\\...\\Windows\r\n    Device    REG_SZ    HP LaserJet,winspool,Ne01:\r\n'
    expect(pdf.parseDispositivoRegistro(salida)).toBe('HP LaserJet')
    expect(pdf.parseDispositivoRegistro('ERROR')).toBeNull()
  })
})

describe('print window', () => {
  it('waits for listo, runs the job and destroys the window', async () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez'])
    const result = await pdf.conVentanaImpresion(trabajoDe(liq.id), async (ventana) => {
      await ventana.mostrar(recibos[0]!.id)
      return 'hecho'
    })
    expect(result).toBe('hecho')
    expect(fake.rutas).toEqual([`print/${liq.id}/${recibos[0]!.id}`])
    expect(fake.ventanas).toHaveLength(1)
    expect(fake.ventanas[0]!.destroyed).toBe(true)
  })

  it('answers datosImpresion from the job for its window and builds it for other senders', async () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz'])
    const trabajo = trabajoDe(liq.id)
    // Changed after the job was built: only a rebuild would see it.
    empresaRepo(db).save({ ...EMPRESA, nombre: 'Nueva SA' })
    const todos = { liquidacionId: liq.id, reciboId: null }

    await pdf.conVentanaImpresion(trabajo, async (ventana) => {
      await ventana.mostrar(recibos[1]!.id)
      expect(fake.respuestas).toEqual([{ ok: true, data: [trabajo.recibos[1]] }])

      const propio = { sender: ventana.contents }
      expect(await datosHandler(propio, todos)).toEqual({ ok: true, data: trabajo.recibos })
      expect(await datosHandler(propio, { liquidacionId: liq.id, reciboId: 9999 })).toMatchObject({
        ok: false,
        error: { code: 'NO_ENCONTRADO', message: 'Recibo no encontrado' },
      })
      expect(await datosHandler(propio, { liquidacionId: liq.id + 1, reciboId: null })).toMatchObject({
        ok: false,
        error: { code: 'NO_ENCONTRADO' },
      })
      // The in-app preview (another sender) gets current data.
      expect(empresaDe(await datosHandler({ sender: { id: 1 } }, todos))).toBe('Nueva SA')
    })

    // Unregistered afterwards: the same sender id now gets current data.
    const id = fake.ventanas[0]!.webContents.id
    expect(empresaDe(await datosHandler({ sender: { id } }, todos))).toBe('Nueva SA')
  })

  it('unregisters the job when the work fails', async () => {
    const { liq } = crearLiquidacion(['Ana Pérez'])
    const trabajo = trabajoDe(liq.id)
    empresaRepo(db).save({ ...EMPRESA, nombre: 'Nueva SA' })
    await expectAppError(
      pdf.conVentanaImpresion(trabajo, async (ventana) => {
        await ventana.mostrar(null)
        throw new AppError('INTERNO', 'falló')
      }),
      'INTERNO',
    )
    const id = fake.ventanas[0]!.webContents.id
    expect(fake.ventanas[0]!.destroyed).toBe(true)
    expect(empresaDe(await datosHandler({ sender: { id } }, { liquidacionId: liq.id, reciboId: null }))).toBe('Nueva SA')
  })

  it('switches receipts in the same window and skips the route already shown', async () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz'])
    await pdf.conVentanaImpresion(trabajoDe(liq.id), async (ventana) => {
      await ventana.mostrar(recibos[0]!.id)
      await ventana.mostrar(recibos[0]!.id)
      await ventana.mostrar(recibos[1]!.id)
    })
    expect(fake.ventanas).toHaveLength(1)
    expect(fake.cargas).toBe(1)
    expect(fake.rutas).toEqual(recibos.map((r) => `print/${liq.id}/${r.id}`))
    expect(fake.ventanas[0]!.webContents.executeJavaScript).toHaveBeenCalledExactlyOnceWith(
      `location.hash = "#/print/${liq.id}/${recibos[1]!.id}"`,
    )
  })

  it('times out when the route never signals and still destroys the window', async () => {
    fake.comportamiento = 'silencio'
    const { liq } = crearLiquidacion(['Ana Pérez'])
    const despues = vi.fn()
    await expectAppError(
      pdf.conVentanaImpresion(
        trabajoDe(liq.id),
        async (ventana) => {
          await ventana.mostrar(null)
          despues()
        },
        50,
      ),
      'INTERNO',
    )
    expect(despues).not.toHaveBeenCalled()
    expect(fake.ventanas[0]!.destroyed).toBe(true)
  })

  it('fails fast when the renderer crashes', async () => {
    fake.comportamiento = 'crash'
    const { liq } = crearLiquidacion(['Ana Pérez'])
    await expectAppError(pdf.conVentanaImpresion(trabajoDe(liq.id), (ventana) => ventana.mostrar(null), 10_000), 'INTERNO')
    expect(fake.ventanas[0]!.destroyed).toBe(true)
  })

  it('ignores listo from unknown senders', () => {
    expect(() => pdf.senalarListo(123456)).not.toThrow()
  })
})

describe('exportar', () => {
  it('unico writes one PDF of the whole liquidación', async () => {
    const { liq } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz'])
    fake.saveDialog = { canceled: false, filePath: join(dir, 'todos') }
    const result = await pdf.exportar(liq.id, 'unico')
    expect(result).toEqual({ cancelado: false, archivos: [join(dir, 'todos.pdf')] })
    expect(fake.rutas).toEqual([`print/${liq.id}`])
    expect(await readFile(join(dir, 'todos.pdf'), 'utf8')).toBe(`%PDF-print/${liq.id}`)
    // Built once in main; the route was answered from the job.
    expect(fake.lecturas).toEqual({ get: 1, listRecibos: 1 })
    expect(fake.respuestas).toEqual([{ ok: true, data: [expect.anything(), expect.anything()] }])
  })

  it('por_trabajador writes one Nombre--dd-mm-yyyy.pdf per receipt from one window', async () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez', 'Bruno Díaz', 'Ana Pérez'])
    fake.openDialog = { canceled: false, filePaths: [dir] }
    const result = await pdf.exportar(liq.id, 'por_trabajador')
    expect(result.cancelado).toBe(false)
    expect(result.archivos).toEqual([
      join(dir, 'Ana Pérez--05-09-2024.pdf'),
      join(dir, 'Bruno Díaz--05-09-2024.pdf'),
      join(dir, 'Ana Pérez--05-09-2024 (2).pdf'),
    ])
    expect(fake.rutas).toEqual(recibos.map((r) => `print/${liq.id}/${r.id}`))
    expect((await readdir(dir)).sort()).toHaveLength(3)

    // One window, one renderer load, one printToPDF per receipt, each after its route rendered.
    expect(fake.ventanas).toHaveLength(1)
    expect(fake.ventanas[0]!.destroyed).toBe(true)
    expect(fake.cargas).toBe(1)
    expect(fake.ventanas[0]!.webContents.printToPDF).toHaveBeenCalledTimes(3)
    for (const [i, archivo] of result.archivos.entries()) {
      expect(await readFile(archivo, 'utf8')).toBe(`%PDF-print/${liq.id}/${recibos[i]!.id}`)
    }
    // The receipts were built once, not once per window or per route.
    expect(fake.lecturas).toEqual({ get: 1, listRecibos: 1 })
    expect(fake.respuestas.every((r) => r.ok)).toBe(true)
  })

  it('returns cancelado when a dialog is cancelled', async () => {
    const { liq } = crearLiquidacion(['Ana Pérez'])
    fake.saveDialog = { canceled: true }
    expect(await pdf.exportar(liq.id, 'unico')).toEqual({ cancelado: true, archivos: [] })
    fake.openDialog = { canceled: true, filePaths: [] }
    expect(await pdf.exportar(liq.id, 'por_trabajador')).toEqual({ cancelado: true, archivos: [] })
    expect(fake.ventanas).toHaveLength(0)
  })

  it('rejects a liquidación without receipts before opening a dialog', async () => {
    const liq = liquidacionesRepo(db).create({ periodo: '2024-10', fechaCargo: '2024-10-31', fechaPago: '2024-11-05' })
    await expectAppError(pdf.exportar(liq.id, 'unico'), 'CONFLICTO')
    await expectAppError(pdf.exportar(9999, 'unico'), 'NO_ENCONTRADO')
  })
})

describe('imprimir and impresoras', () => {
  it('prints silently to the chosen printer', async () => {
    const { liq } = crearLiquidacion(['Ana Pérez'])
    expect(await pdf.imprimir(liq.id, null, 'HP LaserJet')).toBeNull()
    expect(fake.printOpciones).toEqual([expect.objectContaining({ silent: true, deviceName: 'HP LaserJet', pageSize: 'A4' })])
    expect(fake.lecturas).toEqual({ get: 1, listRecibos: 1 })
    expect(fake.respuestas).toEqual([{ ok: true, data: [expect.anything()] }])
  })

  it('shows the system dialog when no printer is given and treats cancel as success', async () => {
    const { liq, recibos } = crearLiquidacion(['Ana Pérez'])
    fake.printResultado = { ok: false, motivo: 'Print job canceled' }
    expect(await pdf.imprimir(liq.id, recibos[0]!.id, null)).toBeNull()
    expect(fake.printOpciones[0]).toMatchObject({ silent: false })
    expect(fake.printOpciones[0]).not.toHaveProperty('deviceName')
    expect(fake.rutas).toEqual([`print/${liq.id}/${recibos[0]!.id}`])
  })

  it('reports print failures and unknown printers', async () => {
    const { liq } = crearLiquidacion(['Ana Pérez'])
    fake.printResultado = { ok: false, motivo: 'Print job failed' }
    await expectAppError(pdf.imprimir(liq.id, null, null), 'INTERNO')
    await expectAppError(pdf.imprimir(liq.id, null, 'No existe'), 'NO_ENCONTRADO')
    expect(fake.ventanas.every((w) => w.destroyed)).toBe(true)
  })

  it('lists printers with the default first', async () => {
    const { BrowserWindow } = await import('electron')
    const win = new BrowserWindow({})
    const lista = await pdf.impresoras(win.webContents)
    expect(lista[0]).toEqual({ nombre: 'Brother', predeterminada: true })
    expect(lista).toContainEqual({ nombre: 'HP LaserJet', predeterminada: expect.any(Boolean) })
  })
})
