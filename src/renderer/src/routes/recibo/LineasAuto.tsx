// Computed receipt lines as main returned them, with an override control on montepío, FONASA,
// FRL (rate) and IRPF (amount). Overridden lines carry a "Modificado" marker and "Restaurar".
// Nothing here computes amounts; after each save main sends the recomputed lines back.

import { Badge, Button, Group, Stack, Table, Text } from '@mantine/core'
import { OVERRIDE_POR_CODIGO, type OverrideKey } from '@shared/conceptos'
import { formatMoney, formatRatePercent, parseTasaPercent } from '@shared/money'
import type { Cents, Linea, Overrides, Rate, ValoresCalculados } from '@shared/types'
import { MoneyInput } from '../../components/MoneyInput'
import { TextoParseadoInput } from '../../components/TextoParseadoInput'
import { formatCantidad } from '../../format'
import { NOMBRE_OVERRIDE, ORDEN_OVERRIDES, tieneOverride } from './entradas'

export interface LineasAutoProps {
  lineas: Linea[]
  overrides: Overrides | null
  valoresCalculados: ValoresCalculados
  onOverride: <K extends OverrideKey>(key: K, value: Overrides[K] | undefined) => void
  disabled: boolean
}

interface Fila {
  key: string
  linea: Linea | null
  descripcion: string
  override: OverrideKey | null
}

export function LineasAuto({ lineas, overrides, valoresCalculados, onOverride, disabled }: LineasAutoProps) {
  const filas: Fila[] = lineas
    .filter((l) => l.origen === 'auto')
    .sort((a, b) => a.orden - b.orden)
    .map((linea) => ({
      key: `${linea.codigo}-${linea.orden}`,
      linea,
      descripcion: linea.descripcion,
      override: (linea.codigo && OVERRIDE_POR_CODIGO[linea.codigo]) ?? null,
    }))
  // Overridable lines main omitted (IRPF is left out when it is 0) still get a control.
  for (const key of ORDEN_OVERRIDES) {
    if (!filas.some((f) => f.override === key)) {
      filas.push({ key, linea: null, descripcion: NOMBRE_OVERRIDE[key], override: key })
    }
  }

  return (
    <Table verticalSpacing="xs" layout="fixed">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w="26%">Concepto</Table.Th>
          <Table.Th w="12%" ta="right">
            Cantidad
          </Table.Th>
          <Table.Th w="16%" ta="right">
            Base
          </Table.Th>
          <Table.Th w="16%" ta="right">
            Importe
          </Table.Th>
          <Table.Th>Ajuste manual</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {filas.map((fila) => {
          const modificado = fila.linea?.override === true || (fila.override !== null && tieneOverride(overrides, fila.override))
          return (
            <Table.Tr key={fila.key} data-testid={`linea-auto-${fila.linea?.codigo ?? fila.key}`}>
              <Table.Td>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm">{fila.descripcion}</Text>
                  {modificado && (
                    <Badge size="sm" color="amber" variant="light">
                      Modificado
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm">{fila.linea ? formatCantidad(fila.linea) : ''}</Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm">{fila.linea?.valorUnitario != null ? formatMoney(fila.linea.valorUnitario) : ''}</Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm">{fila.linea ? formatMoney(fila.linea.importe) : '—'}</Text>
              </Table.Td>
              <Table.Td>
                {fila.override && (
                  <OverrideControl
                    campo={fila.override}
                    nombre={fila.descripcion}
                    overrides={overrides}
                    calculados={valoresCalculados}
                    onOverride={onOverride}
                    disabled={disabled}
                  />
                )}
              </Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Tbody>
    </Table>
  )
}

interface OverrideControlProps {
  campo: OverrideKey
  nombre: string
  overrides: Overrides | null
  calculados: ValoresCalculados
  onOverride: LineasAutoProps['onOverride']
  disabled: boolean
}

function OverrideControl({ campo, nombre, overrides, calculados, onOverride, disabled }: OverrideControlProps) {
  const activo = tieneOverride(overrides, campo)
  const restaurar = !disabled && activo && (
    <Button size="compact-xs" variant="subtle" onClick={() => onOverride(campo, undefined)} aria-label={`Restaurar ${nombre}`}>
      Restaurar
    </Button>
  )

  if (campo === 'irpfImporte') {
    const calculado = calculados.irpfImporte
    return (
      <Stack gap={2}>
        <MoneyInput
          size="xs"
          aria-label={`Ajuste ${nombre}`}
          placeholder={formatMoney(calculado)}
          value={overrides?.irpfImporte ?? null}
          onChange={(value: Cents | null) => onOverride('irpfImporte', value ?? undefined)}
          disabled={disabled}
        />
        <Group gap={4} justify="space-between" wrap="nowrap">
          <Text size="xs" c="dimmed">
            Calculado: {formatMoney(calculado)}
          </Text>
          {restaurar}
        </Group>
      </Stack>
    )
  }

  const calculado = calculados[campo]
  return (
    <Stack gap={2}>
      <TasaInput
        aria-label={`Ajuste ${nombre}`}
        placeholder={formatRatePercent(calculado)}
        value={overrides?.[campo] ?? null}
        onChange={(value) => onOverride(campo, value ?? undefined)}
        disabled={disabled}
      />
      <Group gap={4} justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          Calculado: {formatRatePercent(calculado)} %
        </Text>
        {restaurar}
      </Group>
    </Stack>
  )
}

/** Percent text ("8" or "4,5") ↔ rate string ("0.08"). Empty means no override (null). */
function TasaInput(props: {
  'aria-label': string
  placeholder: string
  value: Rate | null
  onChange: (value: Rate | null) => void
  disabled: boolean
}) {
  return (
    <TextoParseadoInput
      {...props}
      size="xs"
      rightSection={<Text size="xs">%</Text>}
      parse={parseTasa}
      format={(v) => (v === null ? '' : formatRatePercent(v))}
      mensajeInvalido="Tasa inválida (0 a 100)"
    />
  )
}

/** null for empty (no override), undefined for invalid. */
function parseTasa(text: string): Rate | null | undefined {
  return text.trim() === '' ? null : (parseTasaPercent(text) ?? undefined)
}
