// T5 handlers exercised through the real `handle()` pipeline (Zod validation + error mapping)
// against an in-memory database. Lives in a subfolder so src/main/index.ts's `./ipc/*.ts`
// glob never picks it up.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '@shared/api'
import type {
  Condicion,
  CondicionInput,
  Empresa,
  ParametrosVersion,
  Trabajador,
  TrabajadorDetalle,
  TrabajadorInput,
} from '@shared/types'

type Listener = (event: unknown, raw?: unknown) => Promise<ApiResult<unknown>>
const listeners = vi.hoisted(() => new Map<string, Listener>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: Listener) => listeners.set(channel, listener),
  },
}))

const { setDb } = await import('../../db/connection')
const { openTestDb } = await import('../../db/testing')
const { PARAMETROS_2026 } = await import('../../db/seed')
const empresa = await import('../empresa')
const trabajadores = await import('../trabajadores')
const parametros = await import('../parametros')

empresa.register()
trabajadores.register()
parametros.register()

async function call<T>(channel: string, input?: unknown): Promise<ApiResult<T>> {
  const listener = listeners.get(channel)
  if (!listener) throw new Error(`no handler for ${channel}`)
  return (await listener({}, input)) as ApiResult<T>
}

async function ok<T>(channel: string, input?: unknown): Promise<T> {
  const result = await call<T>(channel, input)
  if (!result.ok) throw new Error(`${channel}: ${result.error.code} ${result.error.message}`)
  return result.data
}

async function errorCode(channel: string, input?: unknown): Promise<string> {
  const result = await call(channel, input)
  if (result.ok) throw new Error(`${channel} unexpectedly succeeded`)
  return result.error.code
}

beforeEach(() => setDb(openTestDb()))
afterEach(() => setDb(null))

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
    fechaIngreso: '2024-03-01',
    afiliacionBps: '',
    carpetaBse: '',
    lugarCobro: 'Banco',
    centroCostos: '',
    lugarTrabajo: 'Montevideo',
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

describe('empresa', () => {
  it('returns null before saving, then the saved row', async () => {
    expect(await ok('empresa:obtener')).toBeNull()
    expect(await ok('empresa:guardar', EMPRESA)).toEqual(EMPRESA)
    expect(await ok('empresa:obtener')).toEqual(EMPRESA)
    await ok('empresa:guardar', { ...EMPRESA, nombre: 'Otra SA' })
    expect(await ok<Empresa>('empresa:obtener')).toMatchObject({ nombre: 'Otra SA' })
  })

  it('rejects invalid input with VALIDACION', async () => {
    expect(await errorCode('empresa:guardar', { ...EMPRESA, rut: '  ' })).toBe('VALIDACION')
    expect(await errorCode('empresa:guardar', undefined)).toBe('VALIDACION')
    expect(await ok('empresa:obtener')).toBeNull()
  })
})

describe('trabajadores', () => {
  it('creates, lists with active filter, gets and updates', async () => {
    const a = await ok<Trabajador>('trabajadores:crear', trabajador(2))
    const b = await ok<Trabajador>('trabajadores:crear', trabajador(1, { activo: false }))
    expect(a.id).toBeGreaterThan(0)

    const todos = await ok<Trabajador[]>('trabajadores:listar', { soloActivos: false })
    expect(todos.map((t) => t.numero)).toEqual([1, 2])
    const activos = await ok<Trabajador[]>('trabajadores:listar', { soloActivos: true })
    expect(activos.map((t) => t.id)).toEqual([a.id])

    const actualizado = await ok<Trabajador>('trabajadores:actualizar', {
      id: b.id,
      datos: trabajador(1, { nombre: 'Renombrado', activo: true }),
    })
    expect(actualizado).toMatchObject({ id: b.id, nombre: 'Renombrado', activo: true })

    const detalle = await ok<TrabajadorDetalle>('trabajadores:obtener', { id: b.id })
    expect(detalle).toEqual({ trabajador: actualizado, condiciones: [] })
  })

  it('maps repo and validation failures to error codes', async () => {
    const a = await ok<Trabajador>('trabajadores:crear', trabajador(1))
    expect(await errorCode('trabajadores:crear', trabajador(1))).toBe('CONFLICTO')
    expect(await errorCode('trabajadores:obtener', { id: 999 })).toBe('NO_ENCONTRADO')
    expect(await errorCode('trabajadores:actualizar', { id: 999, datos: trabajador(5) })).toBe('NO_ENCONTRADO')
    expect(await errorCode('trabajadores:crear', { ...trabajador(3), fechaIngreso: '2024-13-01' })).toBe(
      'VALIDACION',
    )
    expect(await errorCode('trabajadores:obtener', { id: -1 })).toBe('VALIDACION')
    expect(await errorCode('trabajadores:listar', {})).toBe('VALIDACION')
    await ok('trabajadores:crear', trabajador(2))
    expect(await errorCode('trabajadores:actualizar', { id: a.id, datos: trabajador(2) })).toBe('CONFLICTO')
  })

  it('nuevaCondicion adds versions and never edits past rows', async () => {
    const t = await ok<Trabajador>('trabajadores:crear', trabajador(1))
    const primera = await ok<Condicion>('trabajadores:nuevaCondicion', {
      trabajadorId: t.id,
      condicion: condicion('2026-01-01'),
    })
    const segunda = await ok<Condicion>('trabajadores:nuevaCondicion', {
      trabajadorId: t.id,
      condicion: condicion('2026-07-01', 3300000),
    })
    expect(segunda.id).not.toBe(primera.id)
    expect(segunda).toMatchObject({ trabajadorId: t.id, vigenteDesde: '2026-07-01', sueldoNominal: 3300000 })

    // Same date again: conflict, and the existing row is untouched.
    expect(
      await errorCode('trabajadores:nuevaCondicion', {
        trabajadorId: t.id,
        condicion: condicion('2026-01-01', 9999999),
      }),
    ).toBe('CONFLICTO')

    const detalle = await ok<TrabajadorDetalle>('trabajadores:obtener', { id: t.id })
    expect(detalle.condiciones).toEqual([segunda, primera])

    expect(
      await errorCode('trabajadores:nuevaCondicion', { trabajadorId: 999, condicion: condicion('2026-01-01') }),
    ).toBe('NO_ENCONTRADO')
    expect(
      await errorCode('trabajadores:nuevaCondicion', {
        trabajadorId: t.id,
        condicion: { ...condicion('2026-08-01'), irpfPctAtribucion: 75 },
      }),
    ).toBe('VALIDACION')
  })
})

describe('parametros', () => {
  it('lists the seeded version', async () => {
    const versiones = await ok<ParametrosVersion[]>('parametros:listar')
    expect(versiones).toHaveLength(1)
    expect(versiones[0]).toEqual(PARAMETROS_2026)
  })

  it('nuevaVersion duplicates the latest version, franjas included', async () => {
    const nueva = await ok<ParametrosVersion>('parametros:nuevaVersion', { vigenteDesde: '2027-01-01' })
    expect(nueva).toEqual({ ...PARAMETROS_2026, vigenteDesde: '2027-01-01' })

    // Edit the new one; the next duplicate copies the edited latest, the old one is untouched.
    await ok('parametros:actualizar', { ...nueva, bpc: 700000 })
    const otra = await ok<ParametrosVersion>('parametros:nuevaVersion', { vigenteDesde: '2027-07-01' })
    expect(otra.bpc).toBe(700000)

    const versiones = await ok<ParametrosVersion[]>('parametros:listar')
    expect(versiones.map((v) => v.vigenteDesde)).toEqual(['2027-07-01', '2027-01-01', PARAMETROS_2026.vigenteDesde])
    expect(versiones[2]).toEqual(PARAMETROS_2026)
  })

  it('nuevaVersion rejects an existing date and invalid input', async () => {
    expect(await errorCode('parametros:nuevaVersion', { vigenteDesde: PARAMETROS_2026.vigenteDesde })).toBe(
      'CONFLICTO',
    )
    expect(await errorCode('parametros:nuevaVersion', { vigenteDesde: '2027-02-30' })).toBe('VALIDACION')
    expect(await ok<ParametrosVersion[]>('parametros:listar')).toHaveLength(1)
  })

  it('actualizar replaces scalars and franjas of one version', async () => {
    const franjas = [
      { desdeBpc: '0', hastaBpc: '8', tasa: '0' },
      { desdeBpc: '8', hastaBpc: null, tasa: '0.2' },
    ]
    const actualizada = await ok<ParametrosVersion>('parametros:actualizar', {
      ...PARAMETROS_2026,
      montepio: '0.16',
      franjas: [...franjas].reverse(),
    })
    expect(actualizada).toEqual({ ...PARAMETROS_2026, montepio: '0.16', franjas })
    expect(await ok('parametros:listar')).toEqual([actualizada])
  })

  it('actualizar rejects unknown versions and inconsistent franjas', async () => {
    expect(await errorCode('parametros:actualizar', { ...PARAMETROS_2026, vigenteDesde: '2030-01-01' })).toBe(
      'NO_ENCONTRADO',
    )
    const malas = [
      [{ desdeBpc: '1', hastaBpc: null, tasa: '0' }],
      [
        { desdeBpc: '0', hastaBpc: '7', tasa: '0' },
        { desdeBpc: '8', hastaBpc: null, tasa: '0.1' },
      ],
      [
        { desdeBpc: '0', hastaBpc: null, tasa: '0' },
        { desdeBpc: '7', hastaBpc: null, tasa: '0.1' },
      ],
      [
        { desdeBpc: '0', hastaBpc: '7', tasa: '0' },
        { desdeBpc: '7', hastaBpc: '10', tasa: '0.1' },
      ],
      [{ desdeBpc: '0', hastaBpc: '0', tasa: '0' }],
      [],
    ]
    for (const franjas of malas) {
      expect(await errorCode('parametros:actualizar', { ...PARAMETROS_2026, franjas })).toBe('VALIDACION')
    }
    expect(await errorCode('parametros:actualizar', { ...PARAMETROS_2026, montepio: '1.5' })).toBe('VALIDACION')
    expect(await ok('parametros:listar')).toEqual([PARAMETROS_2026])
  })
})
