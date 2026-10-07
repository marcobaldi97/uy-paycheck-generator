// Test-only helpers: fixtures for the trabajadores screens and a renderer for the two routes.
// Install API answers per test with `instalarApi` from test/fakeApi.

import type { Condicion, Trabajador } from '@shared/types'
import { paths } from '../../paths'
import { renderWithProviders } from '../../test/render'
import { TrabajadorDetallePage, TrabajadoresPage } from './index'

export function trabajadorDePrueba(id: number, extra: Partial<Trabajador> = {}): Trabajador {
  return {
    id,
    numero: id,
    ci: `1.111.11${id}-1`,
    nombre: `TRABAJADOR ${id}`,
    cargo: 'Administrativo',
    fechaIngreso: '2020-01-15',
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

export function renderTrabajadores(path: string = paths.trabajadores()) {
  return renderWithProviders(
    [
      { path: '/trabajadores', element: <TrabajadoresPage /> },
      { path: '/trabajadores/:trabajadorId', element: <TrabajadorDetallePage /> },
    ],
    path,
  )
}
