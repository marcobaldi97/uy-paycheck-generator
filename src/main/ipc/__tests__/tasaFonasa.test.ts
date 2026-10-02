// trabajadores.tasaFonasa through the real `handle()` pipeline against the seeded
// in-memory database (PARAMETROS_2026: umbral 2,5 BPC = $ 17.160).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '@shared/api'
import type { TasaFonasaPreview } from '@shared/types'

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
const trabajadores = await import('../trabajadores')

trabajadores.register()

async function tasaFonasa(input: unknown): Promise<ApiResult<TasaFonasaPreview>> {
  const listener = listeners.get('trabajadores:tasaFonasa')
  if (!listener) throw new Error('no handler for trabajadores:tasaFonasa')
  return (await listener({}, input)) as ApiResult<TasaFonasaPreview>
}

async function ok(input: unknown): Promise<TasaFonasaPreview> {
  const result = await tasaFonasa(input)
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.message}`)
  return result.data
}

beforeEach(() => setDb(openTestDb()))
afterEach(() => setDb(null))

const FECHA = '2026-03-15'
const BAJO = 1_500_000 // $ 15.000, below the umbral
const ALTO = 3_000_000 // $ 30.000, above the umbral
const p = PARAMETROS_2026

describe('trabajadores.tasaFonasa', () => {
  it('uses the low-band rate, which only depends on cónyuge', async () => {
    for (const fonasaHijos of [false, true]) {
      expect(await ok({ fecha: FECHA, sueldoNominal: BAJO, fonasaConyuge: false, fonasaHijos })).toEqual({
        tasa: p.fonasaBajoSinConyuge,
        bandaAlta: false,
        parametrosVigenteDesde: p.vigenteDesde,
      })
      expect(await ok({ fecha: FECHA, sueldoNominal: BAJO, fonasaConyuge: true, fonasaHijos })).toEqual({
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
  ])('high band with cónyuge=%s hijos=%s → %s', async (fonasaConyuge, fonasaHijos, tasa) => {
    expect(await ok({ fecha: FECHA, sueldoNominal: ALTO, fonasaConyuge, fonasaHijos })).toEqual({
      tasa,
      bandaAlta: true,
      parametrosVigenteDesde: p.vigenteDesde,
    })
  })

  it('fails with SIN_PARAMETROS for a date before any parámetros', async () => {
    const result = await tasaFonasa({ fecha: '2020-01-01', sueldoNominal: ALTO, fonasaConyuge: false, fonasaHijos: false })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('SIN_PARAMETROS')
    expect(result.error.message).toContain('01/01/2020')
  })

  it('rejects invalid input', async () => {
    const result = await tasaFonasa({ fecha: '2026-13-01', sueldoNominal: -1, fonasaConyuge: false, fonasaHijos: false })
    expect(result.ok).toBe(false)
  })
})
