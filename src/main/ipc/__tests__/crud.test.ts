// IPC wiring for empresa, trabajadores and parametros: every method is registered, input is
// validated (VALIDACION), results come back as `{ ok, data }` and AppErrors as `{ ok: false, error }`.
// The domain rules themselves are tested in src/main/services/*.test.ts.

import { describe, expect, it, vi } from 'vitest'
import { API_METHODS, channel } from '@shared/api'
import type { CondicionInput, Empresa, TrabajadorInput } from '@shared/types'
import { PARAMETROS_2026 } from '../../db/seed'
import * as empresa from '../empresa'
import * as parametros from '../parametros'
import * as trabajadores from '../trabajadores'
import { canales, errorCode, invocar, ok, usarIpc } from './harness'

vi.mock('electron', () => import('./harness').then((m) => m.electronMock))
usarIpc(empresa, trabajadores, parametros)

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

it('registers every method of the three domains', () => {
  const domains = ['empresa', 'trabajadores', 'parametros'] as const
  expect(canales()).toEqual(
    domains.flatMap((d) => Object.keys(API_METHODS[d]).map((m) => channel(d, m))).sort(),
  )
})

describe('empresa', () => {
  it('returns null before saving, then the saved row', async () => {
    expect(await ok('empresa', 'obtener')).toBeNull()
    expect(await invocar('empresa', 'guardar', EMPRESA)).toEqual({ ok: true, data: EMPRESA })
    expect(await ok('empresa', 'obtener')).toEqual(EMPRESA)
    await ok('empresa', 'guardar', { ...EMPRESA, nombre: 'Otra SA' })
    expect(await ok('empresa', 'obtener')).toMatchObject({ nombre: 'Otra SA' })
  })

  it('rejects invalid input with VALIDACION', async () => {
    expect(await errorCode('empresa', 'guardar', { ...EMPRESA, rut: '  ' })).toBe('VALIDACION')
    expect(await errorCode('empresa', 'guardar', undefined)).toBe('VALIDACION')
    expect(await ok('empresa', 'obtener')).toBeNull()
  })
})

describe('trabajadores', () => {
  it('passes input through to the service and returns its data', async () => {
    const a = await ok('trabajadores', 'crear', trabajador(2))
    const b = await ok('trabajadores', 'crear', trabajador(1, { activo: false }))
    expect(await invocar('trabajadores', 'listar', { soloActivos: true })).toEqual({ ok: true, data: [a] })
    expect((await ok('trabajadores', 'listar', { soloActivos: false })).map((t) => t.id)).toEqual([b.id, a.id])

    const actualizado = await ok('trabajadores', 'actualizar', { id: b.id, datos: trabajador(1, { nombre: 'Renombrado' }) })
    expect(actualizado).toMatchObject({ id: b.id, nombre: 'Renombrado' })

    const c = await ok('trabajadores', 'nuevaCondicion', { trabajadorId: b.id, condicion: condicion('2026-07-01') })
    expect(c).toMatchObject({ trabajadorId: b.id, vigenteDesde: '2026-07-01' })
    expect(await ok('trabajadores', 'obtener', { id: b.id })).toEqual({ trabajador: actualizado, condiciones: [c] })

    expect(
      await ok('trabajadores', 'tasaFonasa', { fecha: '2026-03-15', sueldoNominal: 3000000, fonasaConyuge: false, fonasaHijos: false }),
    ).toEqual({ tasa: PARAMETROS_2026.fonasaAltoSinCargas, bandaAlta: true, parametrosVigenteDesde: PARAMETROS_2026.vigenteDesde })
  })

  it('rejects invalid input with VALIDACION', async () => {
    const t = await ok('trabajadores', 'crear', trabajador(1))
    expect(await errorCode('trabajadores', 'crear', { ...trabajador(3), fechaIngreso: '2024-13-01' })).toBe('VALIDACION')
    expect(await errorCode('trabajadores', 'obtener', { id: -1 })).toBe('VALIDACION')
    expect(await errorCode('trabajadores', 'listar', {})).toBe('VALIDACION')
    expect(
      await errorCode('trabajadores', 'nuevaCondicion', {
        trabajadorId: t.id,
        condicion: { ...condicion('2026-08-01'), irpfPctAtribucion: 75 },
      }),
    ).toBe('VALIDACION')
    expect(
      await errorCode('trabajadores', 'tasaFonasa', { fecha: '2026-13-01', sueldoNominal: -1, fonasaConyuge: false, fonasaHijos: false }),
    ).toBe('VALIDACION')
  })

  it('maps AppErrors to { ok: false, error }', async () => {
    await ok('trabajadores', 'crear', trabajador(1))
    expect(await errorCode('trabajadores', 'crear', trabajador(1))).toBe('CONFLICTO')
    expect(await invocar('trabajadores', 'obtener', { id: 999 })).toEqual({
      ok: false,
      error: { code: 'NO_ENCONTRADO', message: 'Trabajador no encontrado' },
    })
    expect(
      await invocar('trabajadores', 'tasaFonasa', { fecha: '2020-01-01', sueldoNominal: 3000000, fonasaConyuge: false, fonasaHijos: false }),
    ).toEqual({
      ok: false,
      error: {
        code: 'SIN_PARAMETROS',
        message: 'No hay parámetros vigentes para la fecha 01/01/2020',
        details: { fecha: '2020-01-01' },
      },
    })
  })
})

describe('parametros', () => {
  it('passes input through to the service and returns its data', async () => {
    expect(await invocar('parametros', 'listar')).toEqual({ ok: true, data: [PARAMETROS_2026] })
    const nueva = await ok('parametros', 'nuevaVersion', { vigenteDesde: '2027-01-01' })
    expect(nueva).toEqual({ ...PARAMETROS_2026, vigenteDesde: '2027-01-01' })
    expect(await ok('parametros', 'actualizar', { ...nueva, bpc: 700000 })).toEqual({ ...nueva, bpc: 700000 })
  })

  it('rejects invalid input with VALIDACION', async () => {
    expect(await errorCode('parametros', 'nuevaVersion', { vigenteDesde: '2027-02-30' })).toBe('VALIDACION')
    expect(await errorCode('parametros', 'actualizar', { ...PARAMETROS_2026, montepio: '1.5' })).toBe('VALIDACION')
    expect(await ok('parametros', 'listar')).toEqual([PARAMETROS_2026])
  })

  it('maps AppErrors to { ok: false, error }', async () => {
    expect(await errorCode('parametros', 'nuevaVersion', { vigenteDesde: PARAMETROS_2026.vigenteDesde })).toBe('CONFLICTO')
    expect(await errorCode('parametros', 'actualizar', { ...PARAMETROS_2026, vigenteDesde: '2030-01-01' })).toBe(
      'NO_ENCONTRADO',
    )
    const franjas = [{ desdeBpc: '1', hastaBpc: null, tasa: '0' }]
    expect(await invocar('parametros', 'actualizar', { ...PARAMETROS_2026, franjas })).toEqual({
      ok: false,
      error: { code: 'VALIDACION', message: 'La primera franja debe comenzar en 0 BPC', details: { campo: 'franjas' } },
    })
  })
})
