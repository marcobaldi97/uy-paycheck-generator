// empresa: the single company row.

import { handle } from '../lib/ipc'
import { empresaRepo } from '../repos/empresa'

export function register(): void {
  handle('empresa', 'obtener', () => empresaRepo().get())
  handle('empresa', 'guardar', (input) => empresaRepo().save(input))
}
