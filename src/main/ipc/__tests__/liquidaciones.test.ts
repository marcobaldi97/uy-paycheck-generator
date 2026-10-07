// IPC wiring for liquidaciones. The state rules and numbers are tested in
// src/main/services/liquidaciones.test.ts; here only registration, validation, `{ ok, data }`
// results and AppError mapping.

import { describe, expect, it, vi } from 'vitest'
import { API_METHODS, channel } from '@shared/api'
import { trabajadoresRepo } from '../../repos/trabajadores'
import * as liquidaciones from '../liquidaciones'
import { canales, invocar, ok, usarIpc } from './harness'

vi.mock('electron', () => import('./harness').then((m) => m.electronMock))
usarIpc(liquidaciones)

const MARZO = { periodo: '2026-03', fechaCargo: '2026-03-31', fechaPago: '2026-04-05' }

describe('liquidaciones IPC', () => {
  it('registers every method of the domain', () => {
    expect(canales()).toEqual(
      Object.keys(API_METHODS.liquidaciones)
        .map((m) => channel('liquidaciones', m))
        .sort(),
    )
  })

  it('validates input and maps domain errors', async () => {
    const invalid = await invocar('liquidaciones', 'crear', { ...MARZO, periodo: '2026-13' })
    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDACION' } })

    const sinTrabajadores = await invocar('liquidaciones', 'crear', MARZO)
    expect(sinTrabajadores).toMatchObject({ ok: false, error: { code: 'SIN_TRABAJADORES_ACTIVOS' } })

    expect(await invocar('liquidaciones', 'obtener', { id: 42 })).toMatchObject({
      ok: false,
      error: { code: 'NO_ENCONTRADO' },
    })
  })

  it('runs the draft flow end to end', async () => {
    const repo = trabajadoresRepo()
    const t = repo.create({
      numero: 1,
      ci: '1.234.567-8',
      nombre: 'Ana',
      cargo: 'Administrativa',
      fechaIngreso: '2020-01-01',
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

    const created = await ok('liquidaciones', 'crear', MARZO)
    const det = await invocar('liquidaciones', 'recalcular', { id: created.id })
    expect(det).toMatchObject({ ok: true, data: { liquidacion: { id: created.id, estado: 'borrador' } } })
    expect(await invocar('liquidaciones', 'listar')).toMatchObject({
      ok: true,
      data: [{ periodo: '2026-03', cantidadRecibos: 1 }],
    })
  })
})
