// Previous / next receipt of the same liquidación, in the order the detail lists them.
// Renders nothing until the list is known (or if it fails to load): it is only a shortcut.

import { ActionIcon, Group, Text } from '@mantine/core'
import { Link } from 'react-router'
import { useLiquidacion } from '../../api/hooks'
import { paths } from '../../paths'

export function NavegacionRecibos({ liquidacionId, reciboId }: { liquidacionId: number; reciboId: number }) {
  const liquidacion = useLiquidacion(liquidacionId)
  const recibos = liquidacion.data?.recibos ?? []
  const index = recibos.findIndex((r) => r.id === reciboId)
  if (index < 0) return null

  const anterior = recibos[index - 1]
  const siguiente = recibos[index + 1]
  const boton = (destino: typeof anterior, etiqueta: string, flecha: string) =>
    destino ? (
      <ActionIcon
        component={Link}
        to={paths.recibo(liquidacionId, destino.id)}
        variant="default"
        size={44}
        aria-label={`${etiqueta}: ${destino.trabajadorNombre}`}
      >
        {flecha}
      </ActionIcon>
    ) : (
      <ActionIcon variant="default" size={44} disabled aria-label={etiqueta}>
        {flecha}
      </ActionIcon>
    )

  return (
    <Group gap="xs" component="nav" aria-label="Recibos de la liquidación">
      {boton(anterior, 'Recibo anterior', '←')}
      <Text size="sm" c="dimmed">
        {index + 1} de {recibos.length}
      </Text>
      {boton(siguiente, 'Recibo siguiente', '→')}
    </Group>
  )
}
