import { Badge } from '@mantine/core'
import type { EstadoLiquidacion } from '@shared/types'

function Punto() {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        background: 'currentColor',
      }}
    />
  )
}

export function EstadoBadge({ estado }: { estado: EstadoLiquidacion }) {
  return estado === 'emitida' ? (
    <Badge color="forest" variant="light" size="lg" leftSection={<Punto />}>
      Emitida
    </Badge>
  ) : (
    <Badge color="amber" variant="light" size="lg" leftSection={<Punto />}>
      Borrador
    </Badge>
  )
}
