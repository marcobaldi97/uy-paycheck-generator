import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@shared/api'
import { fechaResolucion } from '@shared/periodo'
import type { CondicionInput, Empresa, NuevaLiquidacionInput, ReciboDetalle, ReciboEntradas, TrabajadorInput } from '@shared/types'
import type { Db } from '../db/connection'
import { recibos } from '../db/schema'
import { PARAMETROS_2026 } from '../db/seed'
import { openTestDb } from '../db/testing'
import { empresaRepo } from '../repos/empresa'
import { liquidacionesRepo } from '../repos/liquidaciones'
import { parametrosRepo } from '../repos/parametros'
import { trabajadoresRepo } from '../repos/trabajadores'
import { liquidacionesService, type LiquidacionesService } from './liquidaciones'

let db: Db
let service: LiquidacionesService
beforeEach(() => {
  db = openTestDb()
  service = liquidacionesService(db)
})

function expectAppError(fn: () => unknown, code: AppError['code']): AppError {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(code)
    return error as AppError
  }
  throw new Error(`expected AppError ${code}`)
}

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

const MARZO: NuevaLiquidacionInput = { periodo: '2026-03', fechaCargo: '2026-03-31', fechaPago: '2026-04-05' }

function trabajador(numero: number, extra: Partial<TrabajadorInput> = {}): TrabajadorInput {
  return {
    numero,
    ci: `1.234.56${numero}-7`,
    nombre: `Trabajador ${numero}`,
    cargo: 'Administrativo',
    fechaIngreso: '2020-03-01',
    activo: true,
    ...extra,
  }
}

function condicion(vigenteDesde: string, sueldoNominal: number, extra: Partial<CondicionInput> = {}): CondicionInput {
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
    ...extra,
  }
}

/** Worker with a condition from 2026-01-01. */
function alta(numero: number, sueldo: number, extra: Partial<CondicionInput> = {}) {
  const repo = trabajadoresRepo(db)
  const t = repo.create(trabajador(numero))
  repo.addCondicion(t.id, condicion('2026-01-01', sueldo, extra))
  return t
}

function reciboDe(liquidacionId: number, trabajadorId: number) {
  const r = service.obtener(liquidacionId).recibos.find((x) => x.trabajadorId === trabajadorId)
  if (!r) throw new Error('recibo not found')
  return service.obtenerRecibo(r.id)
}

describe('fechaResolucion', () => {
  it('is the last day of the period', () => {
    expect(fechaResolucion('2026-02')).toBe('2026-02-28')
    expect(fechaResolucion('2024-02')).toBe('2024-02-29')
    expect(fechaResolucion('2026-12')).toBe('2026-12-31')
  })
})

describe('crear', () => {
  it('creates a borrador with one computed recibo per active worker', () => {
    const a = alta(1, 8000000) // test case 3: líquido 62015
    const b = alta(2, 1500000, { fonasaConyuge: true })
    trabajadoresRepo(db).create(trabajador(3, { activo: false }))

    const liq = service.crear(MARZO)
    expect(liq).toMatchObject({ ...MARZO, estado: 'borrador' })

    const det = service.obtener(liq.id)
    expect(det.recibos.map((r) => r.trabajadorId)).toEqual([a.id, b.id])
    const ra = reciboDe(liq.id, a.id)
    expect(ra.totales.liquido).toBe(6201500)
    expect(ra.lineas.find((l) => l.codigo === 'IRPF')?.importe).toBe(228520)
    expect(ra.entradas).toEqual({ diasNoTrabajados: 0, lineasManuales: [], overrides: null })
    expect(ra.estado).toBe('borrador')
    const rb = reciboDe(liq.id, b.id)
    expect(rb.lineas.find((l) => l.codigo === 'FONASA')?.cantidad).toBe('0.05')

    expect(det.totales.liquido).toBe(ra.totales.liquido + rb.totales.liquido)
    expect(service.listar()).toEqual([
      { ...liq, cantidadRecibos: 2, totalLiquido: det.totales.liquido },
    ])
  })

  it('uses the condition and parameters in force at the end of the period', () => {
    const repo = trabajadoresRepo(db)
    const t = repo.create(trabajador(1))
    repo.addCondicion(t.id, condicion('2026-01-01', 3000000))
    repo.addCondicion(t.id, condicion('2026-03-15', 4000000))
    parametrosRepo(db).insert({ ...PARAMETROS_2026, vigenteDesde: '2026-03-10', montepio: '0.16' })

    const liq = service.crear(MARZO)
    const r = reciboDe(liq.id, t.id)
    expect(r.lineas.find((l) => l.codigo === 'SUELDO')?.importe).toBe(4000000)
    expect(r.lineas.find((l) => l.codigo === 'MONTEPIO')).toMatchObject({ cantidad: '0.16', importe: 640000 })
  })

  it('fails with a named reason', () => {
    // Parameters start 2026-01-01.
    alta(1, 3000000)
    expectAppError(() => service.crear({ ...MARZO, periodo: '2025-12' }), 'SIN_PARAMETROS')

    trabajadoresRepo(db).update(1, trabajador(1, { activo: false }))
    expectAppError(() => service.crear(MARZO), 'SIN_TRABAJADORES_ACTIVOS')
    trabajadoresRepo(db).update(1, trabajador(1))

    const sin = trabajadoresRepo(db).create(trabajador(2, { nombre: 'Ana Pérez' }))
    const tarde = trabajadoresRepo(db).create(trabajador(3, { nombre: 'Luis Gómez' }))
    trabajadoresRepo(db).addCondicion(tarde.id, condicion('2026-04-01', 3000000))
    const error = expectAppError(() => service.crear(MARZO), 'TRABAJADOR_SIN_CONDICIONES')
    expect(error.details).toMatchObject({
      trabajadores: [
        { id: sin.id, nombre: 'Ana Pérez' },
        { id: tarde.id, nombre: 'Luis Gómez' },
      ],
    })
    expect(error.message).toContain('Ana Pérez')
    // Nothing was written by the failed attempts.
    expect(service.listar()).toEqual([])

    trabajadoresRepo(db).addCondicion(sin.id, condicion('2026-01-01', 3000000))
    trabajadoresRepo(db).update(tarde.id, trabajador(3, { activo: false }))
    service.crear(MARZO)
    expectAppError(() => service.crear(MARZO), 'LIQUIDACION_EXISTENTE')
  })
})

describe('actualizarRecibo and recalcular', () => {
  it('stores entradas, recomputes, and keeps them on recalcular with new conditions', () => {
    const t = alta(1, 8000000)
    const liq = service.crear(MARZO)
    const id = service.obtener(liq.id).recibos[0]!.id

    const entradas: ReciboEntradas = {
      diasNoTrabajados: 3,
      lineasManuales: [
        {
          descripcion: 'Partida extra',
          tipo: 'haber',
          cantidad: null,
          valorUnitario: null,
          importe: 100000,
          gravadoBps: true,
          gravadoIrpf: true,
        },
      ],
      overrides: { fonasaTasa: '0.08' },
    }
    const r = service.actualizarRecibo(id, entradas)
    expect(r.entradas).toEqual(entradas)
    expect(r.lineas.find((l) => l.codigo === 'FONASA')).toMatchObject({ cantidad: '0.08', override: true })
    expect(r.lineas.find((l) => l.codigo === 'DIAS_NO_TRABAJADOS')?.importe).toBe(-800000)
    expect(r.lineas.some((l) => l.origen === 'manual' && l.descripcion === 'Partida extra')).toBe(true)
    // "restaurar" value: computed FONASA rate without the override (> 2,5 BPC, no dependents).
    expect(r.valoresCalculados.fonasaTasa).toBe('0.045')
    expect(service.obtener(liq.id).recibos[0]!.tieneOverrides).toBe(true)

    // Conditions change: drafts only update on recalcular.
    trabajadoresRepo(db).addCondicion(t.id, condicion('2026-03-01', 9000000))
    expect(service.obtenerRecibo(id).lineas.find((l) => l.codigo === 'SUELDO')?.importe).toBe(8000000)

    const det = service.recalcular(liq.id)
    const after = service.obtenerRecibo(id)
    expect(after.entradas).toEqual(entradas)
    expect(after.lineas.find((l) => l.codigo === 'SUELDO')?.importe).toBe(9000000)
    expect(after.lineas.find((l) => l.codigo === 'FONASA')).toMatchObject({ cantidad: '0.08', override: true })
    expect(det.recibos[0]!.liquido).toBe(after.totales.liquido)

    // Restaurar: clearing the override brings back the computed rate.
    const restored = service.actualizarRecibo(id, { ...entradas, overrides: null })
    expect(restored.lineas.find((l) => l.codigo === 'FONASA')).toMatchObject({ cantidad: '0.045', override: false })
    expect(service.obtener(liq.id).recibos[0]!.tieneOverrides).toBe(false)
  })

  it('adds recibos for workers activated after creation', () => {
    alta(1, 3000000)
    const liq = service.crear(MARZO)
    const nuevo = alta(2, 4000000)
    const det = service.recalcular(liq.id)
    expect(det.recibos.map((r) => r.trabajadorId)).toContain(nuevo.id)
    expect(det.recibos).toHaveLength(2)
  })

  it('reports unknown ids', () => {
    expectAppError(() => service.obtener(999), 'NO_ENCONTRADO')
    expectAppError(() => service.recalcular(999), 'NO_ENCONTRADO')
    expectAppError(() => service.obtenerRecibo(999), 'NO_ENCONTRADO')
    expectAppError(() => service.actualizarRecibo(999, { diasNoTrabajados: 0, lineasManuales: [], overrides: null }), 'NO_ENCONTRADO')
  })
})

describe('emitir and reabrir', () => {
  it('requires empresa data', () => {
    alta(1, 3000000)
    const liq = service.crear(MARZO)
    expectAppError(() => service.emitir(liq.id), 'CONFLICTO')
    expect(service.obtener(liq.id).liquidacion.estado).toBe('borrador')
  })

  it('snapshots empresa and trabajador, rejects writes, and reabrir clears the snapshots', () => {
    empresaRepo(db).save(EMPRESA)
    const t = alta(1, 3000000)
    const liq = service.crear(MARZO)
    const id = service.obtener(liq.id).recibos[0]!.id

    const det = service.emitir(liq.id)
    expect(det.liquidacion.estado).toBe('emitida')
    const raw = liquidacionesRepo(db).getRecibo(id)!
    expect(raw.snapshotEmpresa).toEqual(EMPRESA)
    expect(raw.snapshotTrabajador).toMatchObject({ id: t.id, nombre: 'Trabajador 1', sueldoNominal: 3000000 })

    // Later edits to empresa or worker don't reach the emitida recibo.
    empresaRepo(db).save({ ...EMPRESA, nombre: 'Otra SA' })
    trabajadoresRepo(db).update(t.id, trabajador(1, { nombre: 'Renombrado' }))
    trabajadoresRepo(db).addCondicion(t.id, condicion('2026-03-01', 5000000))
    const r = service.obtenerRecibo(id)
    expect(r.estado).toBe('emitida')
    expect(r.impresion.empresa.nombre).toBe('Ejemplo SA')
    expect(r.impresion.trabajador).toMatchObject({ nombre: 'Trabajador 1', sueldoNominal: 3000000 })
    expect(service.obtener(liq.id).recibos[0]!.trabajadorNombre).toBe('Trabajador 1')

    // Writes to an emitida are rejected and change nothing.
    const before = service.obtenerRecibo(id)
    expectAppError(() => service.recalcular(liq.id), 'LIQUIDACION_EMITIDA')
    expectAppError(() => service.actualizarRecibo(id, { diasNoTrabajados: 5, lineasManuales: [], overrides: null }), 'LIQUIDACION_EMITIDA')
    expectAppError(() => service.emitir(liq.id), 'LIQUIDACION_EMITIDA')
    expect(service.obtenerRecibo(id)).toEqual(before)

    // Reabrir
    const reabierta = service.reabrir(liq.id)
    expect(reabierta.liquidacion.estado).toBe('borrador')
    const raw2 = liquidacionesRepo(db).getRecibo(id)!
    expect(raw2.snapshotEmpresa).toBeNull()
    expect(raw2.snapshotTrabajador).toBeNull()
    expect(service.obtenerRecibo(id).impresion.trabajador.nombre).toBe('Renombrado')
    expectAppError(() => service.reabrir(liq.id), 'CONFLICTO')

    // Editable again.
    const edited = service.actualizarRecibo(id, { diasNoTrabajados: 0, lineasManuales: [], overrides: null })
    expect(edited.lineas.find((l) => l.codigo === 'SUELDO')?.importe).toBe(5000000)
  })
})

describe('obtenerRecibo impresion (borrador)', () => {
  it('uses current empresa and worker, sueldo from the recibo as calculated', () => {
    const t = alta(1, 3000000)
    const liq = service.crear(MARZO)
    const id = service.obtener(liq.id).recibos[0]!.id

    // No empresa saved yet: blank fields, the draft stays viewable.
    expect(service.obtenerRecibo(id).impresion).toMatchObject({
      reciboId: id,
      empresa: { nombre: '' },
      trabajador: { id: t.id, numero: 1, sueldoNominal: 3000000 },
      liquidacion: { periodo: '2026-03', fechaCargo: '2026-03-31', fechaPago: '2026-04-05' },
    })

    // A new condición shows only after Recalcular, like the lines; identity data is current.
    empresaRepo(db).save(EMPRESA)
    trabajadoresRepo(db).addCondicion(t.id, condicion('2026-03-20', 3500000))
    trabajadoresRepo(db).update(t.id, trabajador(1, { cargo: 'Gerente' }))
    const r = service.obtenerRecibo(id)
    expect(r.impresion.empresa).toEqual(EMPRESA)
    expect(r.impresion.trabajador).toMatchObject({ cargo: 'Gerente', sueldoNominal: 3000000 })

    service.recalcular(liq.id)
    expect(service.obtenerRecibo(id).impresion.trabajador.sueldoNominal).toBe(3500000)
  })
})

describe('a recibo shows what it was calculated with', () => {
  const sueldoLinea = (r: ReciboDetalle) => r.lineas.find((l) => l.codigo === 'SUELDO')!.importe

  it('prints the SUELDO line as sueldo nominal, in borrador and emitida', () => {
    empresaRepo(db).save(EMPRESA)
    const t = alta(1, 3000000)
    const liq = service.crear(MARZO)
    const id = service.obtener(liq.id).recibos[0]!.id
    service.actualizarRecibo(id, { diasNoTrabajados: 2, lineasManuales: [], overrides: null })
    trabajadoresRepo(db).addCondicion(t.id, condicion('2026-03-01', 4200000))

    const borrador = service.obtenerRecibo(id)
    expect(borrador.impresion.trabajador.sueldoNominal).toBe(sueldoLinea(borrador))
    expect(sueldoLinea(borrador)).toBe(3000000)

    service.emitir(liq.id)
    const emitida = service.obtenerRecibo(id)
    expect(emitida.impresion.trabajador.sueldoNominal).toBe(sueldoLinea(emitida))
    expect(emitida.impresion).toEqual(borrador.impresion)
  })

  it('an emitida ignores condiciones added afterwards', () => {
    empresaRepo(db).save(EMPRESA)
    const t = alta(1, 3000000)
    const liq = service.crear(MARZO)
    const id = service.obtener(liq.id).recibos[0]!.id
    service.emitir(liq.id)
    const before = service.obtenerRecibo(id)
    expect(before.valoresCalculados.fonasaTasa).toBe('0.045')

    trabajadoresRepo(db).addCondicion(t.id, condicion('2026-03-01', 1500000, { fonasaConyuge: true }))
    const after = service.obtenerRecibo(id)
    expect(after.valoresCalculados).toEqual(before.valoresCalculados)
    expect(after.impresion).toEqual(before.impresion)
  })

  it('falls back to re-resolving for rows stored before valores_calculados existed', () => {
    empresaRepo(db).save(EMPRESA)
    const t = alta(1, 3000000)
    const liq = service.crear(MARZO)
    const id = service.obtener(liq.id).recibos[0]!.id
    const calculados = service.obtenerRecibo(id).valoresCalculados
    db.update(recibos).set({ valoresCalculados: null }).where(eq(recibos.id, id)).run()
    expect(liquidacionesRepo(db).getRecibo(id)!.valoresCalculados).toBeNull()

    expect(service.obtenerRecibo(id).valoresCalculados).toEqual(calculados)

    // Emitir freezes them, so later condiciones don't reach the emitida.
    service.emitir(liq.id)
    expect(liquidacionesRepo(db).getRecibo(id)!.valoresCalculados).toEqual(calculados)
    trabajadoresRepo(db).addCondicion(t.id, condicion('2026-03-01', 1500000, { fonasaConyuge: true }))
    expect(service.obtenerRecibo(id).valoresCalculados).toEqual(calculados)
  })

  it('reads conceptos once per operation, not once per worker', () => {
    alta(1, 3000000)
    alta(2, 4000000)
    alta(3, 5000000)
    const prepare = vi.spyOn(db.$client, 'prepare')
    const consultasConceptos = () => prepare.mock.calls.filter(([sql]) => /from "conceptos"/.test(sql)).length

    const liq = service.crear(MARZO)
    // One for the printed descriptions, one for the concepto ids of the stored lines.
    expect(consultasConceptos()).toBe(2)

    prepare.mockClear()
    service.recalcular(liq.id)
    expect(consultasConceptos()).toBe(2)
    prepare.mockRestore()
  })
})
