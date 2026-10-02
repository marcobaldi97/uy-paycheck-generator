// Empresa: the single company record printed on every receipt.

import { Alert, Box, Button, Group, Loader, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { empresaSchema } from '@shared/schemas'
import type { Empresa } from '@shared/types'
import { errorMessage } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useEmpresa, useGuardarEmpresa } from '../../api/hooks'

const EMPTY: Empresa = { nombre: '', direccion: '', rut: '', nroMtss: '', afiliacionBps: '', carpetaBse: '', grupo: '', subgrupo: '' }

export function EmpresaPage() {
  const empresa = useEmpresa()

  return (
    <Stack maw={1200}>
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
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl" style={{ alignItems: 'start' }}>
    <form onSubmit={form.onSubmit((values) => guardar.mutate(values))} noValidate>
      <Paper withBorder radius="lg" p="xl">
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
            <TextInput label="Afiliación BPS" {...form.getInputProps('afiliacionBps')} />
            <TextInput label="Carpeta BSE" {...form.getInputProps('carpetaBse')} />
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
    <EncabezadoPreview empresa={form.values} />
    </SimpleGrid>
  )
}

/** How the company appears at the top of every receipt, updated as the form is edited. */
function EncabezadoPreview({ empresa }: { empresa: Empresa }) {
  const dato = (valor: string, vacio: string) => (valor.trim() === '' ? vacio : valor)
  const lineas = [
    `RUT ${dato(empresa.rut, '[RUT]')}`,
    `MTSS ${dato(empresa.nroMtss, '[N.º MTSS]')}`,
    `Grupo ${dato(empresa.grupo, '[G]')} / Subgrupo ${dato(empresa.subgrupo, '[S]')}`,
    `BPS ${dato(empresa.afiliacionBps, '[Afiliación BPS]')}`,
    `BSE ${dato(empresa.carpetaBse, '[Carpeta BSE]')}`,
  ]
  return (
    <Stack gap="xs" component="aside" aria-label="Vista previa del encabezado">
      <Title order={2} fz={16} ff="var(--mantine-font-family)" fw={600}>
        Así se ve en el recibo
      </Title>
      <Paper withBorder p="xl" radius="xs" shadow="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap" pb="sm" style={{ borderBottom: '2px solid #1B2421' }}>
          <Box>
            <Text ff="var(--mantine-font-family-headings)" fz={18} fw={600}>
              {dato(empresa.nombre, '[Nombre de la empresa]')}
            </Text>
            <Text size="xs" c="dimmed">
              {dato(empresa.direccion, '[Dirección]')}
            </Text>
            <Text size="xs" c="dimmed">
              {lineas.join(' · ')}
            </Text>
          </Box>
          <Box ta="right">
            <Text size="sm" fw={600}>
              RECIBO DE SUELDO
            </Text>
            <Text size="xs" c="dimmed">
              Período MM/AAAA
            </Text>
          </Box>
        </Group>
        <Stack gap={8} mt="md">
          <Box h={10} w="70%" bg="#F6F3EC" style={{ borderRadius: 3 }} />
          <Box h={10} w="55%" bg="#F6F3EC" style={{ borderRadius: 3 }} />
          <Box h={10} w="85%" bg="#F6F3EC" style={{ borderRadius: 3 }} />
        </Stack>
      </Paper>
    </Stack>
  )
}
