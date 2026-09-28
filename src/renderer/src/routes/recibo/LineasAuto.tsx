// Computed receipt lines as main returned them, with an override control on montepío, FONASA,
// FRL (rate) and IRPF (amount). Overridden lines carry a "Modificado" marker and "Restaurar".
// Nothing here computes amounts; after each save main sends the recomputed lines back.

import { Badge, Button, Group, Stack, Table, Text, TextInput } from '@mantine/core'
import { formatMoney, formatRatePercent, parseRatePercent } from '@shared/money'
import type { Cents, Linea, Overrides, Rate, ValoresCalculados } from '@shared/types'
import { useState } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { formatCantidad, NOMBRE_OVERRIDE, ORDEN_OVERRIDES, OVERRIDE_POR_CODIGO, tieneOverride, type OverrideKey } from './entradas'

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
                    <Badge size="xs" color="orange" variant="light">
                      Modificado
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td ta="right">
                <Text size="sm">{cantidad(fila)}</Text>
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

function cantidad(fila: Fila): string {
  const value = fila.linea?.cantidad
  if (value == null) return ''
  // Montepío / FONASA / FRL lines carry the rate in `cantidad`.
  return fila.override && fila.override !== 'irpfImporte' ? `${formatRatePercent(value)} %` : formatCantidad(value)
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
        value={overrides?.[campo]}
        onChange={(value) => onOverride(campo, value)}
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

interface TasaInputProps {
  'aria-label': string
  placeholder: string
  value: Rate | undefined
  onChange: (value: Rate | undefined) => void
  disabled: boolean
}

/** Percent text ("8" or "4,5") ↔ rate string ("0.08"). Empty means no override. */
function TasaInput({ value, onChange, ...props }: TasaInputProps) {
  const display = (v: Rate | undefined) => (v === undefined ? '' : formatRatePercent(v))
  const [text, setText] = useState(() => display(value))
  const [invalid, setInvalid] = useState(false)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (parseTasa(text) !== value) {
      setText(display(value))
      setInvalid(false)
    }
  }

  return (
    <TextInput
      {...props}
      size="xs"
      inputMode="decimal"
      autoComplete="off"
      rightSection={<Text size="xs">%</Text>}
      styles={{ input: { textAlign: 'right' } }}
      value={text}
      error={invalid ? 'Tasa inválida (0 a 100)' : undefined}
      onChange={(e) => {
        const next = e.currentTarget.value
        setText(next)
        const parsed = parseTasa(next)
        setInvalid(parsed === null)
        if (parsed !== null && parsed !== value) onChange(parsed)
      }}
      onBlur={() => {
        setText(display(value))
        setInvalid(false)
      }}
    />
  )
}

/** undefined for empty (no override), null for invalid. */
function parseTasa(text: string): Rate | undefined | null {
  if (text.trim() === '') return undefined
  const rate = parseRatePercent(text)
  if (rate === null || Number(rate) > 1) return null
  return rate
}
