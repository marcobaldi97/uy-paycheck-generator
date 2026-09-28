// Home screen: one row per period with estado, receipt count and total líquido.

import { Alert, Anchor, Button, Center, Loader, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { formatMoney } from '@shared/money'
import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { useLiquidaciones } from '../../api/hooks'
import { PageHeader } from '../../components/PageHeader'
import { formatFecha } from '../../components/Recibo'
import { StatCard } from '../../components/StatCard'
import { paths } from '../../paths'
import { EstadoBadge } from './EstadoBadge'
import { nombrePeriodo, periodoSugerido } from './formato'
import { NuevaLiquidacionModal } from './NuevaLiquidacionModal'

export function LiquidacionesPage() {
  const liquidaciones = useLiquidaciones()
  const [nueva, setNueva] = useState(false)
  const lista = liquidaciones.data ?? []
  const enCurso = lista.find((liq) => liq.estado === 'borrador')

  return (
    <Stack>
      <PageHeader
        title="Liquidaciones"
        actions={
          <Button size="lg" onClick={() => setNueva(true)} disabled={!liquidaciones.isSuccess}>
            Nueva liquidación
          </Button>
        }
      />

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

      {enCurso && (
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
          <Paper radius="xl" p="xl" c="white" style={{ background: '#17211E', gridColumn: 'span 1' }}>
            <Stack gap="md" justify="space-between" h="100%" align="flex-start">
              <Stack gap={8} align="flex-start">
                <EstadoBadge estado={enCurso.estado} />
                <Title order={2} c="white" fz={32}>
                  {nombrePeriodo(enCurso.periodo)}
                </Title>
                <Text c="#B9C6C0">Falta revisar los recibos y emitir. Pago el {formatFecha(enCurso.fechaPago)}.</Text>
              </Stack>
              <Button component={Link} to={paths.liquidacion(enCurso.id)} color="forest.0" c="ink" size="md">
                Continuar con la liquidación
              </Button>
            </Stack>
          </Paper>
          <StatCard label="Recibos" value={enCurso.cantidadRecibos} />
          <StatCard label="Total líquido estimado" value={`$ ${formatMoney(enCurso.totalLiquido)}`} />
        </SimpleGrid>
      )}

      {lista.length > 0 && (
        <Title order={3} fz={16} ff="var(--mantine-font-family)" fw={600}>
          Historial
        </Title>
      )}

      {lista.length > 0 && (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
          <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
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
                    <Anchor component={Link} to={paths.liquidacion(liq.id)} fw={600} c="inherit" underline="hover">
                      {nombrePeriodo(liq.periodo)}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{formatFecha(liq.fechaPago)}</Table.Td>
                  <Table.Td>
                    <EstadoBadge estado={liq.estado} />
                  </Table.Td>
                  <Table.Td ta="right">{liq.cantidadRecibos}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {formatMoney(liq.totalLiquido)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <NuevaLiquidacionModal
        opened={nueva}
        onClose={() => setNueva(false)}
        periodoInicial={periodoSugerido(lista.map((l) => l.periodo))}
      />
    </Stack>
  )
}
