// trabajadores: identity data and versioned salary conditions.

import dayjs from 'dayjs'
import { fonasaBandaAlta, tasaFonasa } from '@engine/index'
import { AppError, type ApiInput } from '@shared/api'
import type { TasaFonasaPreview, TrabajadorDetalle } from '@shared/types'
import { getDb } from '../db/connection'
import { handle } from '../lib/ipc'
import { parametrosRepo } from '../repos/parametros'
import { trabajadoresRepo } from '../repos/trabajadores'

function obtener(id: number): TrabajadorDetalle {
  return getDb().transaction((tx) => {
    const repo = trabajadoresRepo(tx)
    const trabajador = repo.get(id)
    if (!trabajador) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
    return { trabajador, condiciones: repo.listCondiciones(id) }
  })
}

/** Preview of the computed FONASA rate for a condition, using the parámetros in force on `fecha`. */
function previsualizarTasaFonasa({ fecha, sueldoNominal, fonasaConyuge, fonasaHijos }: ApiInput<'trabajadores', 'tasaFonasa'>): TasaFonasaPreview {
  const p = parametrosRepo().vigente(fecha)
  if (!p) {
    throw new AppError(
      'SIN_PARAMETROS',
      `No hay parámetros vigentes para la fecha ${dayjs(fecha).format('DD/MM/YYYY')}`,
      { fecha },
    )
  }
  return {
    tasa: tasaFonasa(sueldoNominal, { fonasaConyuge, fonasaHijos }, p),
    bandaAlta: fonasaBandaAlta(sueldoNominal, p),
    parametrosVigenteDesde: p.vigenteDesde,
  }
}

export function register(): void {
  handle('trabajadores', 'listar', (input) => trabajadoresRepo().list(input))
  handle('trabajadores', 'obtener', ({ id }) => obtener(id))
  handle('trabajadores', 'crear', (input) => trabajadoresRepo().create(input))
  handle('trabajadores', 'actualizar', ({ id, datos }) => trabajadoresRepo().update(id, datos))
  // Always inserts a new version; existing condiciones are never edited.
  handle('trabajadores', 'nuevaCondicion', ({ trabajadorId, condicion }) =>
    trabajadoresRepo().addCondicion(trabajadorId, condicion),
  )
  handle('trabajadores', 'tasaFonasa', (input) => previsualizarTasaFonasa(input))
}
