// Identity form for a worker, used both to create and to edit.

import { Alert, Button, Checkbox, Group, NumberInput, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import type { TrabajadorInput } from '@shared/types'
import { useState } from 'react'
import { errorMessage, isApiErrorCode } from '../../api/client'
import { formATrabajadorInput, trabajadorFormSchema, type TrabajadorFormValues } from './forms'

export interface TrabajadorFormProps {
  initialValues: TrabajadorFormValues
  submitLabel: string
  /** Rejects with the API error; CONFLICTO is shown on the Nº field. */
  onGuardar: (input: TrabajadorInput) => Promise<unknown>
  /** Edit mode: keep the button disabled until something changes. */
  requireDirty?: boolean
}

export function TrabajadorForm({ initialValues, submitLabel, onGuardar, requireDirty = false }: TrabajadorFormProps) {
  const form = useForm<TrabajadorFormValues>({
    initialValues,
    validate: schemaResolver(trabajadorFormSchema, { sync: true }),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(values: TrabajadorFormValues) {
    setSaving(true)
    setError(null)
    try {
      await onGuardar(formATrabajadorInput(values))
      form.setInitialValues(values)
      form.resetDirty(values)
    } catch (cause) {
      if (isApiErrorCode(cause, 'CONFLICTO')) form.setFieldError('numero', errorMessage(cause))
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
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumberInput
            label="Nº"
            withAsterisk
            min={1}
            allowDecimal={false}
            allowNegative={false}
            {...form.getInputProps('numero')}
          />
          <TextInput label="Nombre" withAsterisk {...form.getInputProps('nombre')} />
          <TextInput label="C.I." withAsterisk {...form.getInputProps('ci')} />
          <TextInput label="Cargo" {...form.getInputProps('cargo')} />
          <TextInput label="Fecha de ingreso" type="date" withAsterisk {...form.getInputProps('fechaIngreso')} />
          <TextInput label="Afiliación BPS" {...form.getInputProps('afiliacionBps')} />
          <TextInput label="Carpeta BSE" {...form.getInputProps('carpetaBse')} />
          <TextInput label="Lugar de cobro" {...form.getInputProps('lugarCobro')} />
          <TextInput label="Centro de costos" {...form.getInputProps('centroCostos')} />
          <TextInput label="Lugar de trabajo" {...form.getInputProps('lugarTrabajo')} />
        </SimpleGrid>
        <Checkbox label="Activo" {...form.getInputProps('activo', { type: 'checkbox' })} />
        <Group justify="flex-end">
          <Button type="submit" loading={saving} disabled={requireDirty && !form.isDirty()}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
