// parametros: versioned legal parameters with their IRPF brackets.

import { handle } from '../lib/ipc'
import { parametrosService } from '../services/parametros'

export function register(): void {
  const service = parametrosService()
  handle('parametros', 'listar', () => service.listar())
  handle('parametros', 'nuevaVersion', ({ vigenteDesde }) => service.nuevaVersion(vigenteDesde))
  handle('parametros', 'actualizar', (input) => service.actualizar(input))
}
