// Manual receipt lines: free description, haber/descuento, optional cantidad and unit value,
// the amount, and whether it is taxed by BPS / IRPF. With both cantidad and unit value the
// amount is their product (read-only); otherwise it is typed.

import { ActionIcon, Button, Checkbox, Group, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import { esImporteCalculado, importeLineaManual } from '@shared/conceptos'
import type { DecimalString, LineaManual, TipoConcepto } from '@shared/types'
import { useState } from 'react'
import { MoneyInput } from '../../components/MoneyInput'
import { TextoParseadoInput } from '../../components/TextoParseadoInput'
import { formatDecimal } from '../../format'
import { nuevaLineaManual, parseCantidad } from './entradas'

const TIPOS = [
  { value: 'haber', label: 'Haber' },
  { value: 'descuento', label: 'Descuento' },
]

export interface LineasManualesProps {
  lineas: LineaManual[]
  onChange: (lineas: LineaManual[]) => void
  disabled: boolean
}

export function LineasManuales({ lineas, onChange, disabled }: LineasManualesProps) {
  // Lines have no id; keep a React key per row so removing one doesn't shift the inputs' state.
  const [keys, setKeys] = useState(() => lineas.map((_, i) => i))
  const [nextKey, setNextKey] = useState(lineas.length)
  if (keys.length !== lineas.length) {
    // Replaced from outside (e.g. reset after reabrir): start over.
    setKeys(lineas.map((_, i) => nextKey + i))
    setNextKey(nextKey + lineas.length)
  }

  const update = (index: number, patch: Partial<LineaManual>) =>
    onChange(lineas.map((linea, i) => (i === index ? { ...linea, ...patch } : linea)))
  const add = () => {
    setKeys([...keys, nextKey])
    setNextKey(nextKey + 1)
    onChange([...lineas, nuevaLineaManual()])
  }
  const remove = (index: number) => {
    setKeys(keys.filter((_, i) => i !== index))
    onChange(lineas.filter((_, i) => i !== index))
  }

  return (
    <Stack gap="sm">
      {lineas.length === 0 && (
        <Text c="dimmed" size="sm">
          Sin líneas manuales.
        </Text>
      )}
      {lineas.map((linea, index) => (
        <LineaManualFila
          key={keys[index] ?? `extra-${index}`}
          index={index}
          linea={linea}
          disabled={disabled}
          onChange={(patch) => update(index, patch)}
          onRemove={() => remove(index)}
        />
      ))}
      {!disabled && (
        <Group>
          <Button variant="light" onClick={add}>
            Agregar línea
          </Button>
        </Group>
      )}
    </Stack>
  )
}

interface FilaProps {
  index: number
  linea: LineaManual
  disabled: boolean
  onChange: (patch: Partial<LineaManual>) => void
  onRemove: () => void
}

function LineaManualFila({ index, linea, disabled, onChange, onRemove }: FilaProps) {
  const n = index + 1
  // Keep the stored importe in step with cantidad × valor unitario; main computes it the same way.
  const cambiarFactor = (patch: Pick<Partial<LineaManual>, 'cantidad' | 'valorUnitario'>) =>
    onChange({ ...patch, importe: importeLineaManual({ ...linea, ...patch }) })
  const calculado = esImporteCalculado(linea)
  return (
    <Paper withBorder p="sm" aria-label={`Línea manual ${n}`} role="group">
      <Stack gap="xs">
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            label="Descripción"
            aria-label={`Descripción línea ${n}`}
            value={linea.descripcion}
            onChange={(e) => onChange({ descripcion: e.currentTarget.value })}
            error={linea.descripcion.trim() === '' ? 'Requerido' : undefined}
            disabled={disabled}
          />
          <Select
            w={130}
            label="Tipo"
            aria-label={`Tipo línea ${n}`}
            data={TIPOS}
            value={linea.tipo}
            allowDeselect={false}
            onChange={(value) => value && onChange({ tipo: value as TipoConcepto })}
            disabled={disabled}
          />
          {!disabled && (
            <ActionIcon
              variant="subtle"
              color="red"
              size="lg"
              mb={2}
              aria-label={`Quitar línea ${n}`}
              title="Quitar línea"
              onClick={onRemove}
            >
              ✕
            </ActionIcon>
          )}
        </Group>
        <Group align="flex-start" grow>
          <CantidadInput
            label="Cantidad"
            aria-label={`Cantidad línea ${n}`}
            value={linea.cantidad}
            onChange={(cantidad) => cambiarFactor({ cantidad })}
            disabled={disabled}
          />
          <MoneyInput
            label="Valor unitario"
            aria-label={`Valor unitario línea ${n}`}
            value={linea.valorUnitario}
            onChange={(valorUnitario) => cambiarFactor({ valorUnitario })}
            disabled={disabled}
          />
          <MoneyInput
            label="Importe"
            aria-label={`Importe línea ${n}`}
            description={calculado ? 'Cantidad × valor unitario' : undefined}
            // Below the input, so the three inputs of the row stay aligned.
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            value={linea.importe}
            // Importe is required: clearing the field keeps the last value.
            onChange={(importe) => importe !== null && onChange({ importe })}
            readOnly={calculado}
            disabled={disabled}
          />
        </Group>
        <Group gap="lg">
          <Checkbox
            label="Gravado BPS"
            checked={linea.gravadoBps}
            onChange={(e) => onChange({ gravadoBps: e.currentTarget.checked })}
            disabled={disabled}
          />
          <Checkbox
            label="Gravado IRPF"
            checked={linea.gravadoIrpf}
            onChange={(e) => onChange({ gravadoIrpf: e.currentTarget.checked })}
            disabled={disabled}
          />
        </Group>
      </Stack>
    </Paper>
  )
}

interface CantidadInputProps {
  label: string
  'aria-label': string
  value: DecimalString | null
  onChange: (value: DecimalString | null) => void
  disabled: boolean
}

/** Optional decimal ("2,5"). Invalid text shows an error and isn't propagated. */
function CantidadInput(props: CantidadInputProps) {
  return <TextoParseadoInput {...props} parse={parseCantidad} format={formatDecimal} mensajeInvalido="Número inválido" />
}
