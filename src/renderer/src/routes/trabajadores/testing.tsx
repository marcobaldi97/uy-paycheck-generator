// Test-only helpers: an in-memory `window.api.trabajadores` that behaves like the T5
// handlers (ordering, NO_ENCONTRADO, CONFLICTO), and a renderer for the two routes.

import type { Api, ApiResult } from '@shared/api'
import type { Condicion, CondicionInput, Trabajador, TrabajadorInput } from '@shared/types'
import { vi } from 'vitest'
import { paths } from '../../paths'
import { renderWithProviders } from '../../test/render'
import { TrabajadorDetallePage, TrabajadoresPage } from './index'

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data })
const fail = (code: 'NO_ENCONTRADO' | 'CONFLICTO', message: string): ApiResult<never> => ({
  ok: false,
  error: { code, message },
})

export function trabajadorDePrueba(id: number, extra: Partial<Trabajador> = {}): Trabajador {
  return {
    id,
    numero: id,
    ci: `1.111.11${id}-1`,
    nombre: `TRABAJADOR ${id}`,
    cargo: 'Administrativo',
    fechaIngreso: '2020-01-15',
    afiliacionBps: '',
    carpetaBse: '',
    lugarCobro: '',
    lugarTrabajo: '',
    activo: true,
    ...extra,
  }
}

export function condicionDePrueba(id: number, trabajadorId: number, extra: Partial<Condicion> = {}): Condicion {
  return {
    id,
    trabajadorId,
    vigenteDesde: '2025-01-01',
    sueldoNominal: 3_000_000,
    fonasaConyuge: false,
    fonasaHijos: true,
    fonasaTasaManual: null,
    irpfHijos: 1,
    irpfHijosDiscapacidad: 0,
    irpfPctAtribucion: 100,
    irpfOtrasDeducciones: 0,
    ...extra,
  }
}

export function instalarApiFalsa(trabajadores: Trabajador[] = [], condiciones: Condicion[] = []) {
  const db = { trabajadores: [...trabajadores], condiciones: [...condiciones] }
  let nextId = 100

  const numeroOcupado = (numero: number, exceptoId?: number) =>
    db.trabajadores.some((t) => t.numero === numero && t.id !== exceptoId)

  const api = {
    listar: vi.fn(async ({ soloActivos }: { soloActivos: boolean }) =>
      ok(db.trabajadores.filter((t) => !soloActivos || t.activo).sort((a, b) => a.numero - b.numero)),
    ),
    obtener: vi.fn(async ({ id }: { id: number }) => {
      const trabajador = db.trabajadores.find((t) => t.id === id)
      if (!trabajador) return fail('NO_ENCONTRADO', 'Trabajador no encontrado.')
      const propias = db.condiciones
        .filter((c) => c.trabajadorId === id)
        .sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))
      return ok({ trabajador, condiciones: propias })
    }),
    crear: vi.fn(async (input: TrabajadorInput) => {
      if (numeroOcupado(input.numero)) return fail('CONFLICTO', `Ya existe un trabajador con el número ${input.numero}.`)
      const creado = { id: nextId++, ...input }
      db.trabajadores.push(creado)
      return ok(creado)
    }),
    actualizar: vi.fn(async ({ id, datos }: { id: number; datos: TrabajadorInput }) => {
      const i = db.trabajadores.findIndex((t) => t.id === id)
      if (i < 0) return fail('NO_ENCONTRADO', 'Trabajador no encontrado.')
      if (numeroOcupado(datos.numero, id)) return fail('CONFLICTO', `Ya existe un trabajador con el número ${datos.numero}.`)
      db.trabajadores[i] = { id, ...datos }
      return ok(db.trabajadores[i])
    }),
    nuevaCondicion: vi.fn(async ({ trabajadorId, condicion }: { trabajadorId: number; condicion: CondicionInput }) => {
      if (db.condiciones.some((c) => c.trabajadorId === trabajadorId && c.vigenteDesde === condicion.vigenteDesde)) {
        return fail('CONFLICTO', 'Ya existe una condición vigente desde esa fecha.')
      }
      const creada = { id: nextId++, trabajadorId, ...condicion }
      db.condiciones.push(creada)
      return ok(creada)
    }),
  }
  window.api = { trabajadores: api } as unknown as Api
  return { api, db }
}

export function quitarApiFalsa() {
  delete (window as { api?: Api }).api
}

export function renderTrabajadores(path: string = paths.trabajadores()) {
  return renderWithProviders(
    [
      { path: '/trabajadores', element: <TrabajadoresPage /> },
      { path: '/trabajadores/:trabajadorId', element: <TrabajadorDetallePage /> },
    ],
    path,
  )
}
