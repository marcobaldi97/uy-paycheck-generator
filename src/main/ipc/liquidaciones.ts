import { handle } from '../lib/ipc'
import { liquidacionesService } from '../services/liquidaciones'

export function register(): void {
  const service = () => liquidacionesService()
  handle('liquidaciones', 'listar', () => service().listar())
  handle('liquidaciones', 'obtener', ({ id }) => service().obtener(id))
  handle('liquidaciones', 'crear', (input) => service().crear(input))
  handle('liquidaciones', 'recalcular', ({ id }) => service().recalcular(id))
  handle('liquidaciones', 'emitir', ({ id }) => service().emitir(id))
  handle('liquidaciones', 'reabrir', ({ id }) => service().reabrir(id))
  handle('liquidaciones', 'obtenerRecibo', ({ id }) => service().obtenerRecibo(id))
  handle('liquidaciones', 'actualizarRecibo', ({ id, entradas }) => service().actualizarRecibo(id, entradas))
}
