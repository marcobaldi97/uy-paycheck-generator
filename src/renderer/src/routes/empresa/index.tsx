// Empresa: the single company record printed on every receipt.

import { Alert, Button, Group, Loader, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { empresaSchema } from '@shared/schemas'
import type { Empresa } from '@shared/types'
import { errorMessage } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useEmpresa, useGuardarEmpresa } from '../../api/hooks'

const EMPTY: Empresa = { nombre: '', direccion: '', rut: '', nroMtss: '', grupo: '', subgrupo: '' }

export function EmpresaPage() {
  const empresa = useEmpresa()

  return (
    <Stack maw={720}>
      <PageHeader title="Empresa" eyebrow="Aparece en el encabezado de cada recibo" />
      {empresa.isPending ? (
        <Loader aria-label="Cargando" />
      ) : empresa.isError ? (
        <Alert color="red" title="No se pudieron cargar los datos">
          {errorMessage(empresa.error)}
        </Alert>
      ) : (
        <EmpresaForm initial={empresa.data ?? EMPTY} nueva={empresa.data === null} />
      )}
    </Stack>
  )
}

function EmpresaForm({ initial, nueva }: { initial: Empresa; nueva: boolean }) {
  const form = useForm<Empresa>({
    initialValues: initial,
    validate: schemaResolver(empresaSchema, { sync: true }),
  })
  const guardar = useGuardarEmpresa({
    onSuccess: (saved) => {
      form.setValues(saved)
      form.resetDirty(saved)
      notifications.show({ color: 'green', message: 'Datos de la empresa guardados' })
    },
  })

  return (
    <form onSubmit={form.onSubmit((values) => guardar.mutate(values))} noValidate>
      <Paper withBorder p="lg">
        <Stack>
          {nueva && (
            <Text c="dimmed" size="sm">
              Todavía no hay datos de la empresa. Completalos para que aparezcan en los recibos.
            </Text>
          )}
          <TextInput label="Nombre / razón social" withAsterisk {...form.getInputProps('nombre')} />
          <TextInput label="Dirección" {...form.getInputProps('direccion')} />
          <SimpleGrid cols={2}>
            <TextInput label="RUT" withAsterisk {...form.getInputProps('rut')} />
            <TextInput label="Nro. MTSS" {...form.getInputProps('nroMtss')} />
            <TextInput label="Grupo" {...form.getInputProps('grupo')} />
            <TextInput label="Subgrupo" {...form.getInputProps('subgrupo')} />
          </SimpleGrid>
          {guardar.isError && (
            <Alert color="red" title="No se pudo guardar">
              {errorMessage(guardar.error)}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" loading={guardar.isPending}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Paper>
    </form>
  )
}
