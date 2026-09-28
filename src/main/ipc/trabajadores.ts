// trabajadores: identity data and versioned salary conditions.

import { AppError } from '@shared/api'
import type { TrabajadorDetalle } from '@shared/types'
import { getDb } from '../db/connection'
import { handle } from '../lib/ipc'
import { trabajadoresRepo } from '../repos/trabajadores'

function obtener(id: number): TrabajadorDetalle {
  return getDb().transaction((tx) => {
    const repo = trabajadoresRepo(tx)
    const trabajador = repo.get(id)
    if (!trabajador) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
    return { trabajador, condiciones: repo.listCondiciones(id) }
  })
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
}
