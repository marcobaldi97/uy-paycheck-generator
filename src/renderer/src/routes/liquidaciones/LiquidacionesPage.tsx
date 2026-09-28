// Home screen: one row per period with estado, receipt count and total líquido.

import { Alert, Anchor, Button, Center, Group, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { formatMoney } from '@shared/money'
import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { useLiquidaciones } from '../../api/hooks'
import { formatFecha } from '../../components/Recibo'
import { paths } from '../../paths'
import { EstadoBadge } from './EstadoBadge'
import { nombrePeriodo, periodoSugerido } from './formato'
import { NuevaLiquidacionModal } from './NuevaLiquidacionModal'

export function LiquidacionesPage() {
  const liquidaciones = useLiquidaciones()
  const [nueva, setNueva] = useState(false)
  const lista = liquidaciones.data ?? []

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Liquidaciones</Title>
        <Button onClick={() => setNueva(true)} disabled={!liquidaciones.isSuccess}>
          Nueva liquidación
        </Button>
      </Group>

      {liquidaciones.isPending && (
        <Center py="xl">
          <Loader aria-label="Cargando" />
        </Center>
      )}

      {liquidaciones.isError && (
        <Alert color="red" title="No se pudieron cargar las liquidaciones" role="alert">
          {errorMessage(liquidaciones.error)}
        </Alert>
      )}

      {liquidaciones.isSuccess && lista.length === 0 && (
        <Text c="dimmed">Todavía no hay liquidaciones. Creá la primera con «Nueva liquidación».</Text>
      )}

      {lista.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Período</Table.Th>
              <Table.Th>Fecha de pago</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th ta="right">Recibos</Table.Th>
              <Table.Th ta="right">Total líquido</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lista.map((liq) => (
              <Table.Tr key={liq.id} data-testid="liquidacion-fila">
                <Table.Td>
                  <Anchor component={Link} to={paths.liquidacion(liq.id)}>
                    {nombrePeriodo(liq.periodo)}
                  </Anchor>
                </Table.Td>
                <Table.Td>{formatFecha(liq.fechaPago)}</Table.Td>
                <Table.Td>
                  <EstadoBadge estado={liq.estado} />
                </Table.Td>
                <Table.Td ta="right">{liq.cantidadRecibos}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {formatMoney(liq.totalLiquido)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <NuevaLiquidacionModal
        opened={nueva}
        onClose={() => setNueva(false)}
        periodoInicial={periodoSugerido(lista.map((l) => l.periodo))}
      />
    </Stack>
  )
}
