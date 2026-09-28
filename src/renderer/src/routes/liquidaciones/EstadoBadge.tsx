import { Badge } from '@mantine/core'
import type { EstadoLiquidacion } from '@shared/types'

export function EstadoBadge({ estado }: { estado: EstadoLiquidacion }) {
  return estado === 'emitida' ? (
    <Badge color="green" variant="light">
      Emitida
    </Badge>
  ) : (
    <Badge color="yellow" variant="light">
      Borrador
    </Badge>
  )
}
