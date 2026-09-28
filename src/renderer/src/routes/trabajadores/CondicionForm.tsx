// "Nueva condición" form. Past conditions are never edited: every change is a new row
// with its own start date, prefilled from the newest one.

import { Alert, Button, Checkbox, Group, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import type { CondicionInput } from '@shared/types'
import { useState } from 'react'
import { errorMessage, isApiErrorCode } from '../../api/client'
import { MoneyInput } from '../../components/MoneyInput'
import { condicionFormSchema, formACondicionInput, type CondicionFormValues } from './forms'

export interface CondicionFormProps {
  initialValues: CondicionFormValues
  /** Rejects with the API error; CONFLICTO (duplicate date) is shown on the date field. */
  onGuardar: (input: CondicionInput) => Promise<unknown>
  onCancelar: () => void
}

export function CondicionForm({ initialValues, onGuardar, onCancelar }: CondicionFormProps) {
  const form = useForm<CondicionFormValues>({
    initialValues,
    validate: schemaResolver(condicionFormSchema, { sync: true }),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(values: CondicionFormValues) {
    setSaving(true)
    setError(null)
    try {
      await onGuardar(formACondicionInput(values))
    } catch (cause) {
      if (isApiErrorCode(cause, 'CONFLICTO')) form.setFieldError('vigenteDesde', errorMessage(cause))
      else setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
      <Stack>
        {error && (
          <Alert color="red" title="No se pudo guardar">
            {error}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Vigente desde" type="date" withAsterisk {...form.getInputProps('vigenteDesde')} />
          <MoneyInput
            label="Sueldo nominal"
            withAsterisk
            {...form.getInputProps('sueldoNominal')}
            value={form.values.sueldoNominal}
          />
        </SimpleGrid>

        <Text fw={600} size="sm">
          FONASA
        </Text>
        <Group>
          <Checkbox label="Cónyuge a cargo" {...form.getInputProps('fonasaConyuge', { type: 'checkbox' })} />
          <Checkbox label="Hijos a cargo" {...form.getInputProps('fonasaHijos', { type: 'checkbox' })} />
        </Group>
        <TextInput
          label="Tasa FONASA manual (%)"
          description="Vacío = se calcula según parámetros"
          placeholder="ej.: 4,5"
          {...form.getInputProps('fonasaTasaManual')}
        />

        <Text fw={600} size="sm">
          IRPF
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput label="Hijos" min={0} allowDecimal={false} allowNegative={false} {...form.getInputProps('irpfHijos')} />
          <NumberInput
            label="Hijos con discapacidad"
            min={0}
            allowDecimal={false}
            allowNegative={false}
            {...form.getInputProps('irpfHijosDiscapacidad')}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Atribución de deducciones por hijos
            </Text>
            <SegmentedControl
              aria-label="Atribución de deducciones por hijos"
              data={[
                { value: '100', label: '100%' },
                { value: '50', label: '50%' },
              ]}
              {...form.getInputProps('irpfPctAtribucion')}
            />
          </Stack>
          <MoneyInput
            label="Otras deducciones (mensual)"
            {...form.getInputProps('irpfOtrasDeducciones')}
            value={form.values.irpfOtrasDeducciones}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancelar} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar condición
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
