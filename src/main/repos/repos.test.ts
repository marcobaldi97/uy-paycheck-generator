import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/api'
import type { CondicionInput, Empresa, Linea, ReciboEntradas, ReciboTotales, TrabajadorInput } from '@shared/types'
import type { Db } from '../db/connection'
import { PARAMETROS_2026 } from '../db/seed'
import { openTestDb } from '../db/testing'
import { ajustesRepo } from './ajustes'
import { empresaRepo } from './empresa'
import { liquidacionesRepo, type ReciboData } from './liquidaciones'
import { parametrosRepo } from './parametros'
import { trabajadoresRepo } from './trabajadores'

let db: Db
beforeEach(() => {
  db = openTestDb()
})

function expectAppError(fn: () => unknown, code: AppError['code']): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(code)
    return
  }
  throw new Error(`expected AppError ${code}`)
}

const EMPRESA: Empresa = {
  nombre: 'Ejemplo SA',
  direccion: 'Av. Italia 1234',
  rut: '211234560018',
  nroMtss: '123456',
  grupo: '10',
  subgrupo: '01',
}

function trabajador(numero: number, extra: Partial<TrabajadorInput> = {}): TrabajadorInput {
  return {
    numero,
    ci: `1.234.56${numero}-7`,
    nombre: `Trabajador ${numero}`,
    cargo: 'Administrativo',
    fechaIngreso: '2020-03-01',
    afiliacionBps: '',
    carpetaBse: '',
    lugarCobro: 'Montevideo',
    centroCostos: '',
    lugarTrabajo: 'Montevideo',
    activo: true,
    ...extra,
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

describe('empresaRepo', () => {
  it('returns null until saved, then upserts the single row', () => {
    const repo = empresaRepo(db)
    expect(repo.get()).toBeNull()
    expect(repo.save(EMPRESA)).toEqual(EMPRESA)
    repo.save({ ...EMPRESA, nombre: 'Otra SA' })
    expect(repo.get()).toEqual({ ...EMPRESA, nombre: 'Otra SA' })
    expect(db.$client.prepare('select count(*) as n from empresa').get()).toEqual({ n: 1 })
  })
})

describe('ajustesRepo', () => {
  it('gets and sets values', () => {
    const repo = ajustesRepo(db)
    expect(repo.get('ultimoRespaldo')).toBeNull()
    repo.set('ultimoRespaldo', '2026-09-28T14:05:00.000Z')
    repo.set('ultimoRespaldo', '2026-09-29T10:00:00.000Z')
    expect(repo.get('ultimoRespaldo')).toBe('2026-09-29T10:00:00.000Z')
  })
})

describe('trabajadoresRepo', () => {
  it('creates, lists by numero with the active filter, and updates', () => {
    const repo = trabajadoresRepo(db)
    const b = repo.create(trabajador(2))
    const a = repo.create(trabajador(1, { activo: false }))
    expect(repo.list().map((t) => t.numero)).toEqual([1, 2])
    expect(repo.list({ soloActivos: true }).map((t) => t.id)).toEqual([b.id])
    expect(repo.get(a.id)).toEqual(a)
    expect(a.activo).toBe(false)

    const updated = repo.update(a.id, { ...trabajador(1), nombre: 'Nuevo nombre' })
    expect(updated).toMatchObject({ id: a.id, nombre: 'Nuevo nombre', activo: true })
    expect(repo.get(999)).toBeNull()
  })

  it('rejects a duplicate numero and unknown ids', () => {
    const repo = trabajadoresRepo(db)
    const a = repo.create(trabajador(1))
    repo.create(trabajador(2))
    expectAppError(() => repo.create(trabajador(1)), 'CONFLICTO')
    expectAppError(() => repo.update(a.id, trabajador(2)), 'CONFLICTO')
    expect(repo.update(a.id, trabajador(1)).numero).toBe(1)
    expectAppError(() => repo.update(999, trabajador(3)), 'NO_ENCONTRADO')
  })

  it('adds condition versions without touching past rows and resolves the one in force', () => {
    const repo = trabajadoresRepo(db)
    const t = repo.create(trabajador(1))
    const c1 = repo.addCondicion(t.id, condicion('2024-01-01', 3000000))
    const c2 = repo.addCondicion(t.id, {
      ...condicion('2026-03-01', 3500000),
      fonasaConyuge: true,
      fonasaTasaManual: '0.08',
      irpfPctAtribucion: 50,
    })
    expect(c2).toMatchObject({ trabajadorId: t.id, fonasaConyuge: true, fonasaTasaManual: '0.08', irpfPctAtribucion: 50 })

    expect(repo.listCondiciones(t.id)).toEqual([c2, c1])
    expect(repo.condicionVigente(t.id, '2023-12-31')).toBeNull()
    expect(repo.condicionVigente(t.id, '2026-02-28')).toEqual(c1)
    expect(repo.condicionVigente(t.id, '2026-03-01')).toEqual(c2)

    expectAppError(() => repo.addCondicion(t.id, condicion('2026-03-01', 1)), 'CONFLICTO')
    expectAppError(() => repo.addCondicion(999, condicion('2026-03-01', 1)), 'NO_ENCONTRADO')
    expect(repo.listCondiciones(t.id)).toEqual([c2, c1])
  })
})

describe('parametrosRepo', () => {
  it('inserts versions, lists newest first and resolves the one in force', () => {
    const repo = parametrosRepo(db)
    const v2027 = repo.insert({
      ...PARAMETROS_2026,
      vigenteDesde: '2027-01-01',
      bpc: 720000,
      // out of order on purpose: franjas come back sorted by desdeBpc
      franjas: [
        { desdeBpc: '10', hastaBpc: null, tasa: '0.2' },
        { desdeBpc: '0', hastaBpc: '10', tasa: '0' },
      ],
    })
    expect(v2027.franjas.map((f) => f.desdeBpc)).toEqual(['0', '10'])
    expect(repo.list().map((v) => v.vigenteDesde)).toEqual(['2027-01-01', '2026-01-01'])
    expect(repo.latest()!.vigenteDesde).toBe('2027-01-01')
    expect(repo.vigente('2025-12-31')).toBeNull()
    expect(repo.vigente('2026-08-01')!.bpc).toBe(686400)
    expect(repo.vigente('2027-01-01')!.bpc).toBe(720000)
    expectAppError(() => repo.insert(PARAMETROS_2026), 'CONFLICTO')
  })

  it('replaces a version with its franjas', () => {
    const repo = parametrosRepo(db)
    const replaced = repo.replace({
      ...PARAMETROS_2026,
      topeMontepio: 50000000,
      franjas: [{ desdeBpc: '0', hastaBpc: null, tasa: '0.1' }],
    })
    expect(replaced.topeMontepio).toBe(50000000)
    expect(replaced.franjas).toEqual([{ desdeBpc: '0', hastaBpc: null, tasa: '0.1' }])
    expect(db.$client.prepare('select count(*) as n from irpf_franjas').get()).toEqual({ n: 1 })
    expectAppError(() => repo.replace({ ...PARAMETROS_2026, vigenteDesde: '2030-01-01' }), 'NO_ENCONTRADO')
  })
})

describe('liquidacionesRepo', () => {
  const TOTALES: ReciboTotales = {
    imponibleBps: 3000000,
    imponibleIrpf: 3000000,
    totalHaberes: 3000000,
    totalDescuentos: 693700,
    liquido: 2306300,
  }
  const ENTRADAS: ReciboEntradas = {
    diasNoTrabajados: 0,
    lineasManuales: [
      {
        descripcion: 'Adelanto',
        tipo: 'descuento',
        cantidad: null,
        valorUnitario: null,
        importe: 100000,
        gravadoBps: false,
        gravadoIrpf: false,
      },
    ],
    overrides: { fonasaTasa: '0.05' },
  }
  const LINEAS: Linea[] = [
    { codigo: 'SUELDO', descripcion: 'Sueldo Mensual', cantidad: '30', valorUnitario: 100000, importe: 3000000, tipo: 'haber', orden: 10, origen: 'auto', override: false },
    { codigo: 'FONASA', descripcion: 'FONASA', cantidad: '0.05', valorUnitario: 3000000, importe: 150000, tipo: 'descuento', orden: 120, origen: 'auto', override: true },
    { codigo: 'MONTEPIO', descripcion: 'Montepío', cantidad: '0.15', valorUnitario: 3000000, importe: 450000, tipo: 'descuento', orden: 110, origen: 'auto', override: false },
    { codigo: null, descripcion: 'Adelanto', cantidad: null, valorUnitario: null, importe: 100000, tipo: 'descuento', orden: 150, origen: 'manual', override: false },
    { codigo: 'REDONDEO', descripcion: 'Redondeo', cantidad: null, valorUnitario: null, importe: -50, tipo: 'descuento', orden: 190, origen: 'auto', override: false },
  ]
  const DATA: ReciboData = { entradas: ENTRADAS, totales: TOTALES, lineas: LINEAS }

  function setup() {
    const trabajadores = trabajadoresRepo(db)
    const t1 = trabajadores.create(trabajador(1))
    const t2 = trabajadores.create(trabajador(2))
    const repo = liquidacionesRepo(db)
    const liq = repo.create({ periodo: '2026-08', fechaCargo: '2026-08-31', fechaPago: '2026-09-05' })
    return { repo, t1, t2, liq }
  }

  it('creates liquidaciones in borrador, one per period', () => {
    const { repo, liq } = setup()
    expect(liq).toMatchObject({ periodo: '2026-08', estado: 'borrador' })
    expect(repo.get(liq.id)).toEqual(liq)
    expect(repo.getByPeriodo('2026-08')).toEqual(liq)
    expectAppError(
      () => repo.create({ periodo: '2026-08', fechaCargo: '2026-08-31', fechaPago: '2026-09-05' }),
      'LIQUIDACION_EXISTENTE',
    )
    expect(repo.setEstado(liq.id, 'emitida').estado).toBe('emitida')
    expectAppError(() => repo.setEstado(999, 'emitida'), 'NO_ENCONTRADO')
  })

  it('lists newest period first with receipt count and total líquido', () => {
    const { repo, t1, t2, liq } = setup()
    repo.create({ periodo: '2026-09', fechaCargo: '2026-09-30', fechaPago: '2026-10-05' })
    repo.insertRecibo(liq.id, t1.id, DATA)
    repo.insertRecibo(liq.id, t2.id, { ...DATA, totales: { ...TOTALES, liquido: 1000000 } })
    const list = repo.list()
    expect(list.map((l) => [l.periodo, l.cantidadRecibos, l.totalLiquido])).toEqual([
      ['2026-09', 0, 0],
      ['2026-08', 2, 3306300],
    ])
  })

  it('round-trips recibo inputs, totals and lines', () => {
    const { repo, t1, liq } = setup()
    const recibo = repo.insertRecibo(liq.id, t1.id, DATA)
    expect(recibo).toEqual({
      id: recibo.id,
      liquidacionId: liq.id,
      trabajadorId: t1.id,
      entradas: ENTRADAS,
      totales: TOTALES,
      snapshotEmpresa: null,
      snapshotTrabajador: null,
    })
    expect(repo.getRecibo(recibo.id)).toEqual(recibo)
    expect(repo.getLineas(recibo.id)).toEqual([...LINEAS].sort((a, b) => a.orden - b.orden))
    // one recibo per worker per liquidación
    expect(() => repo.insertRecibo(liq.id, t1.id, DATA)).toThrow(/UNIQUE/)
  })

  it('updates a recibo, replacing its lines, and normalizes empty overrides to null', () => {
    const { repo, t1, liq } = setup()
    const recibo = repo.insertRecibo(liq.id, t1.id, DATA)
    const updated = repo.updateRecibo(recibo.id, {
      entradas: { diasNoTrabajados: 2, lineasManuales: [], overrides: {} },
      totales: { ...TOTALES, liquido: 1 },
      lineas: [LINEAS[0]!],
    })
    expect(updated.entradas).toEqual({ diasNoTrabajados: 2, lineasManuales: [], overrides: null })
    expect(updated.totales.liquido).toBe(1)
    expect(repo.getLineas(recibo.id)).toEqual([LINEAS[0]])
    expectAppError(() => repo.updateRecibo(999, DATA), 'NO_ENCONTRADO')
  })

  it('summarizes recibos by worker número, using the snapshot name once emitida', () => {
    const { repo, t1, t2, liq } = setup()
    const r2 = repo.insertRecibo(liq.id, t2.id, { ...DATA, entradas: { ...ENTRADAS, overrides: null } })
    const r1 = repo.insertRecibo(liq.id, t1.id, DATA)
    expect(repo.listResumen(liq.id)).toEqual([
      { id: r1.id, trabajadorId: t1.id, trabajadorNombre: 'Trabajador 1', totalHaberes: 3000000, totalDescuentos: 693700, liquido: 2306300, tieneOverrides: true },
      { id: r2.id, trabajadorId: t2.id, trabajadorNombre: 'Trabajador 2', totalHaberes: 3000000, totalDescuentos: 693700, liquido: 2306300, tieneOverrides: false },
    ])
    expect(repo.listRecibos(liq.id).map((r) => r.id)).toEqual([r1.id, r2.id])

    const { activo: _activo, ...datos } = t1
    repo.setSnapshots(r1.id, EMPRESA, { ...datos, nombre: 'Nombre al emitir', sueldoNominal: 3000000 })
    trabajadoresRepo(db).update(t1.id, { ...trabajador(1), nombre: 'Nombre actual' })
    expect(repo.listResumen(liq.id)[0]!.trabajadorNombre).toBe('Nombre al emitir')
    expect(repo.getRecibo(r1.id)!.snapshotEmpresa).toEqual(EMPRESA)

    repo.setSnapshots(r1.id, null, null)
    expect(repo.getRecibo(r1.id)).toMatchObject({ snapshotEmpresa: null, snapshotTrabajador: null })
    expect(repo.listResumen(liq.id)[0]!.trabajadorNombre).toBe('Nombre actual')
    expectAppError(() => repo.setSnapshots(999, null, null), 'NO_ENCONTRADO')
  })

  it('runs several repos atomically inside a transaction', () => {
    const { t1, liq } = setup()
    expect(() =>
      db.transaction((tx) => {
        const repo = liquidacionesRepo(tx)
        repo.create({ periodo: '2026-10', fechaCargo: '2026-10-31', fechaPago: '2026-11-05' })
        repo.insertRecibo(liq.id, t1.id, DATA)
        throw new Error('rollback')
      }),
    ).toThrow('rollback')
    const repo = liquidacionesRepo(db)
    expect(repo.getByPeriodo('2026-10')).toBeNull()
    expect(repo.listRecibos(liq.id)).toEqual([])
  })

  it('deletes a liquidación with its recibos and lines', () => {
    const { repo, t1, liq } = setup()
    const r = repo.insertRecibo(liq.id, t1.id, DATA)
    repo.delete(liq.id)
    expect(repo.get(liq.id)).toBeNull()
    expect(repo.getRecibo(r.id)).toBeNull()
    expect(db.$client.prepare('select count(*) as n from recibo_lineas').get()).toEqual({ n: 0 })
  })
})
