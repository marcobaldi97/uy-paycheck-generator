import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_METHODS, channel, type ApiResult } from '@shared/api'
import type { Liquidacion, LiquidacionDetalle } from '@shared/types'
import { setDb } from '../../db/connection'
import { openTestDb } from '../../db/testing'
import { trabajadoresRepo } from '../../repos/trabajadores'
import { register } from '../liquidaciones'

type Listener = (event: unknown, raw: unknown) => Promise<ApiResult<unknown>>
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, Listener>() }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, fn: Listener) => handlers.set(name, fn),
  },
}))


function invoke<T>(method: string, input?: unknown): Promise<ApiResult<T>> {
  const fn = handlers.get(channel('liquidaciones', method))
  if (!fn) throw new Error(`no handler for ${method}`)
  return fn({}, input) as Promise<ApiResult<T>>
}

beforeEach(() => {
  handlers.clear()
  setDb(openTestDb())
  register()
})

afterEach(() => setDb(null))

describe('liquidaciones IPC', () => {
  it('registers every method of the domain', () => {
    expect([...handlers.keys()].sort()).toEqual(
      Object.keys(API_METHODS.liquidaciones)
        .map((m) => channel('liquidaciones', m))
        .sort(),
    )
  })

  it('validates input and maps domain errors', async () => {
    const invalid = await invoke('crear', { periodo: '2026-13', fechaCargo: '2026-03-31', fechaPago: '2026-04-05' })
    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDACION' } })

    const sinTrabajadores = await invoke('crear', { periodo: '2026-03', fechaCargo: '2026-03-31', fechaPago: '2026-04-05' })
    expect(sinTrabajadores).toMatchObject({ ok: false, error: { code: 'SIN_TRABAJADORES_ACTIVOS' } })

    expect(await invoke('obtener', { id: 42 })).toMatchObject({ ok: false, error: { code: 'NO_ENCONTRADO' } })
  })

  it('runs the draft flow end to end', async () => {
    const repo = trabajadoresRepo()
    const t = repo.create({
      numero: 1,
      ci: '1.234.567-8',
      nombre: 'Ana',
      cargo: 'Administrativa',
      fechaIngreso: '2020-01-01',
      afiliacionBps: '',
      carpetaBse: '',
      lugarCobro: '',
      lugarTrabajo: '',
      activo: true,
    })
    repo.addCondicion(t.id, {
      vigenteDesde: '2026-01-01',
      sueldoNominal: 3000000,
      fonasaConyuge: false,
      fonasaHijos: false,
      fonasaTasaManual: null,
      irpfHijos: 0,
      irpfHijosDiscapacidad: 0,
      irpfPctAtribucion: 100,
      irpfOtrasDeducciones: 0,
    })

    const created = await invoke<Liquidacion>('crear', {
      periodo: '2026-03',
      fechaCargo: '2026-03-31',
      fechaPago: '2026-04-05',
    })
    if (!created.ok) throw new Error(created.error.message)
    const det = await invoke<LiquidacionDetalle>('recalcular', { id: created.data.id })
    expect(det).toMatchObject({ ok: true, data: { liquidacion: { estado: 'borrador' } } })
    const listed = await invoke('listar')
    expect(listed).toMatchObject({ ok: true, data: [{ periodo: '2026-03', cantidadRecibos: 1 }] })
  })
})
