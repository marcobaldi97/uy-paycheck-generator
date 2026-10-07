import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/api'
import type { CondicionInput, TrabajadorInput } from '@shared/types'
import { PARAMETROS_2026 } from '../db/seed'
import { openTestDb } from '../db/testing'
import { trabajadoresService, type TrabajadoresService } from './trabajadores'

let service: TrabajadoresService
beforeEach(() => {
  service = trabajadoresService(openTestDb())
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

function trabajador(numero: number, extra: Partial<TrabajadorInput> = {}): TrabajadorInput {
  return {
    numero,
    ci: `1.234.56${numero}-7`,
    nombre: `Trabajador ${numero}`,
    cargo: 'Administrativo',
    fechaIngreso: '2024-03-01',
    activo: true,
    ...extra,
  }
}

function condicion(vigenteDesde: string, sueldoNominal = 3000000): CondicionInput {
  return {
    vigenteDesde,
    sueldoNominal,
    fonasaConyuge: false,
    fonasaHijos: true,
    fonasaTasaManual: null,
    irpfHijos: 1,
    irpfHijosDiscapacidad: 0,
    irpfPctAtribucion: 100,
    irpfOtrasDeducciones: 0,
  }
}

describe('trabajadoresService', () => {
  it('creates, lists with active filter, gets and updates', () => {
    const a = service.crear(trabajador(2))
    const b = service.crear(trabajador(1, { activo: false }))
    expect(a.id).toBeGreaterThan(0)

    expect(service.listar({ soloActivos: false }).map((t) => t.numero)).toEqual([1, 2])
    expect(service.listar({ soloActivos: true }).map((t) => t.id)).toEqual([a.id])

    const actualizado = service.actualizar(b.id, trabajador(1, { nombre: 'Renombrado', activo: true }))
    expect(actualizado).toMatchObject({ id: b.id, nombre: 'Renombrado', activo: true })

    expect(service.obtener(b.id)).toEqual({ trabajador: actualizado, condiciones: [] })
  })

  it('rejects a taken numero and unknown ids', () => {
    const a = service.crear(trabajador(1))
    expectAppError(() => service.crear(trabajador(1)), 'CONFLICTO')
    expect(expectAppError(() => service.obtener(999), 'NO_ENCONTRADO').message).toBe('Trabajador no encontrado')
    expectAppError(() => service.actualizar(999, trabajador(5)), 'NO_ENCONTRADO')
    service.crear(trabajador(2))
    expectAppError(() => service.actualizar(a.id, trabajador(2)), 'CONFLICTO')
  })

  it('nuevaCondicion adds versions and never edits past rows', () => {
    const t = service.crear(trabajador(1))
    const primera = service.nuevaCondicion(t.id, condicion('2026-01-01'))
    const segunda = service.nuevaCondicion(t.id, condicion('2026-07-01', 3300000))
    expect(segunda.id).not.toBe(primera.id)
    expect(segunda).toMatchObject({ trabajadorId: t.id, vigenteDesde: '2026-07-01', sueldoNominal: 3300000 })

    // Same date again: conflict, and the existing row is untouched.
    expectAppError(() => service.nuevaCondicion(t.id, condicion('2026-01-01', 9999999)), 'CONFLICTO')
    expect(service.obtener(t.id).condiciones).toEqual([segunda, primera])

    expectAppError(() => service.nuevaCondicion(999, condicion('2026-01-01')), 'NO_ENCONTRADO')
  })
})

// PARAMETROS_2026: umbral 2,5 BPC = $ 17.160.
describe('trabajadoresService.tasaFonasa', () => {
  const FECHA = '2026-03-15'
  const BAJO = 1_500_000 // $ 15.000, below the umbral
  const ALTO = 3_000_000 // $ 30.000, above the umbral
  const p = PARAMETROS_2026

  it('uses the low-band rate, which only depends on cónyuge', () => {
    for (const fonasaHijos of [false, true]) {
      expect(service.tasaFonasa({ fecha: FECHA, sueldoNominal: BAJO, fonasaConyuge: false, fonasaHijos })).toEqual({
        tasa: p.fonasaBajoSinConyuge,
        bandaAlta: false,
        parametrosVigenteDesde: p.vigenteDesde,
      })
      expect(service.tasaFonasa({ fecha: FECHA, sueldoNominal: BAJO, fonasaConyuge: true, fonasaHijos })).toEqual({
        tasa: p.fonasaBajoConConyuge,
        bandaAlta: false,
        parametrosVigenteDesde: p.vigenteDesde,
      })
    }
  })

  it.each([
    [false, false, p.fonasaAltoSinCargas],
    [false, true, p.fonasaAltoHijos],
    [true, false, p.fonasaAltoConyuge],
    [true, true, p.fonasaAltoConyugeHijos],
  ])('high band with cónyuge=%s hijos=%s → %s', (fonasaConyuge, fonasaHijos, tasa) => {
    expect(service.tasaFonasa({ fecha: FECHA, sueldoNominal: ALTO, fonasaConyuge, fonasaHijos })).toEqual({
      tasa,
      bandaAlta: true,
      parametrosVigenteDesde: p.vigenteDesde,
    })
  })

  it('fails with SIN_PARAMETROS for a date before any parámetros', () => {
    const error = expectAppError(
      () => service.tasaFonasa({ fecha: '2020-01-01', sueldoNominal: ALTO, fonasaConyuge: false, fonasaHijos: false }),
      'SIN_PARAMETROS',
    )
    expect(error.message).toBe('No hay parámetros vigentes para la fecha 01/01/2020')
    expect(error.details).toEqual({ fecha: '2020-01-01' })
  })
})
