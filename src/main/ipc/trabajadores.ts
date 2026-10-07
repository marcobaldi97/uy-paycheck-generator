// trabajadores: identity data and versioned salary conditions.

import { handle } from '../lib/ipc'
import { trabajadoresService } from '../services/trabajadores'

export function register(): void {
  const service = trabajadoresService()
  handle('trabajadores', 'listar', (input) => service.listar(input))
  handle('trabajadores', 'obtener', ({ id }) => service.obtener(id))
  handle('trabajadores', 'crear', (input) => service.crear(input))
  handle('trabajadores', 'actualizar', ({ id, datos }) => service.actualizar(id, datos))
  handle('trabajadores', 'nuevaCondicion', ({ trabajadorId, condicion }) =>
    service.nuevaCondicion(trabajadorId, condicion),
  )
  handle('trabajadores', 'tasaFonasa', (input) => service.tasaFonasa(input))
}
