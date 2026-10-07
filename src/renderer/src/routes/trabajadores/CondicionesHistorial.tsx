// Read-only history of a worker's conditions, newest first.

import { Badge, Group, Paper, Stack, Table, Text } from '@mantine/core'
import { formatMoney, formatRatePercent } from '@shared/money'
import type { Condicion } from '@shared/types'
import { formatFecha } from '../../format'
import { condicionVigente } from './forms'

export interface CondicionesHistorialProps {
  /** Newest first, as `trabajadores.obtener` returns them. */
  condiciones: readonly Condicion[]
  /** Today, `YYYY-MM-DD`; decides which row is "Vigente" and which are "Futura". */
  hoy: string
}

const siNo = (value: boolean) => (value ? 'Sí' : 'No')

export function CondicionesHistorial({ condiciones, hoy }: CondicionesHistorialProps) {
  if (condiciones.length === 0) {
    return (
      <Text c="dimmed">
        Sin condiciones registradas. Agregue una para poder incluir al trabajador en una liquidación.
      </Text>
    )
  }
  const vigente = condicionVigente(condiciones, hoy)

  return (
    <Stack>
      {vigente && <CondicionVigente condicion={vigente} />}
    <Table.ScrollContainer minWidth={800}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Vigente desde</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Sueldo nominal</Table.Th>
            <Table.Th>Cónyuge</Table.Th>
            <Table.Th>Hijos (FONASA)</Table.Th>
            <Table.Th>Tasa FONASA manual</Table.Th>
            <Table.Th>Hijos (IRPF)</Table.Th>
            <Table.Th>Hijos c/ discapacidad</Table.Th>
            <Table.Th>Atribución</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Otras deducciones</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {condiciones.map((c) => (
            <Table.Tr key={c.id} data-testid="condicion-fila">
              <Table.Td>
                {formatFecha(c.vigenteDesde)}{' '}
                {c === vigente && (
                  <Badge color="forest" variant="light" size="sm">
                    Vigente
                  </Badge>
                )}
                {c.vigenteDesde > hoy && (
                  <Badge color="amber" variant="light" size="sm">
                    Futura
                  </Badge>
                )}
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{formatMoney(c.sueldoNominal)}</Table.Td>
              <Table.Td>{siNo(c.fonasaConyuge)}</Table.Td>
              <Table.Td>{siNo(c.fonasaHijos)}</Table.Td>
              <Table.Td>{c.fonasaTasaManual === null ? '—' : `${formatRatePercent(c.fonasaTasaManual)}%`}</Table.Td>
              <Table.Td>{c.irpfHijos}</Table.Td>
              <Table.Td>{c.irpfHijosDiscapacidad}</Table.Td>
              <Table.Td>{c.irpfPctAtribucion}%</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>{formatMoney(c.irpfOtrasDeducciones)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
    </Stack>
  )
}

function CondicionVigente({ condicion: c }: { condicion: Condicion }) {
  const chips = [
    c.fonasaConyuge && 'Cónyuge a cargo',
    c.fonasaHijos && 'Hijos a cargo (FONASA)',
    c.irpfHijos > 0 && `IRPF: ${c.irpfHijos} ${c.irpfHijos === 1 ? 'hijo' : 'hijos'}`,
    c.irpfHijosDiscapacidad > 0 && `${c.irpfHijosDiscapacidad} con discapacidad`,
    c.fonasaTasaManual !== null && `FONASA manual ${formatRatePercent(c.fonasaTasaManual)}%`,
  ].filter((chip): chip is string => chip !== false)
  return (
    <Paper radius="lg" p="lg" bg="forest.0" style={{ border: '1px solid var(--mantine-color-forest-1)' }}>
      <Group justify="space-between" align="center" gap="lg">
        <div>
          <Text size="sm" fw={600} c="forest.7">
            Condición en uso desde {formatFecha(c.vigenteDesde)}
          </Text>
          <Text ff="var(--mantine-font-family-headings)" fz={30} lh={1.15}>
            $ {formatMoney(c.sueldoNominal)}{' '}
            <Text span size="sm" ff="var(--mantine-font-family)" c="dimmed">
              sueldo nominal
            </Text>
          </Text>
        </div>
        <Group gap="xs" justify="flex-end">
          {chips.map((chip) => (
            <Badge key={chip} color="forest" variant="white" size="lg" tt="none" fw={500}>
              {chip}
            </Badge>
          ))}
        </Group>
      </Group>
    </Paper>
  )
}
