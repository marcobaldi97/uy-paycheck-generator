// empresa: the single company row.

import { handle } from '../lib/ipc'
import { empresaRepo } from '../repos/empresa'

export function register(): void {
  const repo = empresaRepo()
  handle('empresa', 'obtener', () => repo.get())
  handle('empresa', 'guardar', (input) => repo.save(input))
}
