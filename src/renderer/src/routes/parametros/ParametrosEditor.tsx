// Editor for one parameter version: scalar fields plus the IRPF brackets table.
// Saved with parametros.actualizar, which keys on vigenteDesde (not editable here).

import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  type TextInputProps,
} from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import type { ParametrosVersion } from '@shared/types'
import type { ReactNode } from 'react'
import { errorMessage, isApiErrorCode } from '../../api/client'
import { useActualizarParametros } from '../../api/hooks'
import { MoneyInput } from '../../components/MoneyInput'
import {
  formatFecha,
  parametrosFormSchema,
  toFormValues,
  toVersion,
  type FranjaFormValues,
  type ParametrosFormValues,
} from './form'

const percent: Partial<TextInputProps> = { rightSection: '%', inputMode: 'decimal', autoComplete: 'off' }
const bpc: Partial<TextInputProps> = { rightSection: 'BPC', rightSectionWidth: 44, inputMode: 'decimal', autoComplete: 'off' }

export function ParametrosEditor({ version }: { version: ParametrosVersion }) {
  const form = useForm<ParametrosFormValues>({
    initialValues: toFormValues(version),
    validate: schemaResolver(parametrosFormSchema, { sync: true }),
  })
  const actualizar = useActualizarParametros({
    onSuccess: (saved) => {
      const values = toFormValues(saved)
      form.setValues(values)
      form.resetDirty(values)
      notifications.show({ color: 'green', message: 'Parámetros guardados' })
    },
  })

  const error = actualizar.error
  const franjasServerError =
    isApiErrorCode(error, 'VALIDACION') && error?.details?.['campo'] === 'franjas' ? errorMessage(error) : null
  const generalServerError = error && franjasServerError === null ? errorMessage(error) : null
  const franjasFormError = typeof form.errors['franjas'] === 'string' ? form.errors['franjas'] : null

  const values = form.getValues()
  const franjas = values.franjas

  function setHasta(index: number, value: string) {
    form.setFieldValue(`franjas.${index}.hastaBpc`, value)
    // Keep brackets contiguous: the next one starts where this one ends.
    if (index + 1 < franjas.length) form.setFieldValue(`franjas.${index + 1}.desdeBpc`, value)
  }

  function addFranja() {
    const last = franjas[franjas.length - 1]
    const franja: FranjaFormValues = { desdeBpc: last ? last.hastaBpc : '0', hastaBpc: '', tasa: '' }
    form.insertListItem('franjas', franja)
  }

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) => actualizar.mutate(toVersion(version.vigenteDesde, values)))}
    >
      <Stack>
        <Title order={2} fz={26}>
          Vigente desde {formatFecha(version.vigenteDesde)}
        </Title>

        <Section title="General">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <MoneyInput label="Valor BPC" withAsterisk rightSection="$" {...form.getInputProps('bpc')} />
            <MoneyInput
              label="Tope montepío"
              description="Vacío = sin tope"
              rightSection="$"
              {...form.getInputProps('topeMontepio')}
            />
            <TextInput label="Montepío" {...percent} {...form.getInputProps('montepio')} />
            <TextInput label="FRL" {...percent} {...form.getInputProps('frl')} />
          </SimpleGrid>
        </Section>

        <Section title="FONASA">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Umbral de franja" {...bpc} {...form.getInputProps('fonasaUmbralBpc')} />
            <div />
            <TextInput label="Hasta el umbral, sin cónyuge" {...percent} {...form.getInputProps('fonasaBajoSinConyuge')} />
            <TextInput label="Hasta el umbral, con cónyuge" {...percent} {...form.getInputProps('fonasaBajoConConyuge')} />
            <TextInput label="Sobre el umbral, sin cargas" {...percent} {...form.getInputProps('fonasaAltoSinCargas')} />
            <TextInput label="Sobre el umbral, con hijos" {...percent} {...form.getInputProps('fonasaAltoHijos')} />
            <TextInput label="Sobre el umbral, con cónyuge" {...percent} {...form.getInputProps('fonasaAltoConyuge')} />
            <TextInput
              label="Sobre el umbral, cónyuge e hijos"
              {...percent}
              {...form.getInputProps('fonasaAltoConyugeHijos')}
            />
          </SimpleGrid>
        </Section>

        <Section title="IRPF">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Umbral del incremento" {...bpc} {...form.getInputProps('irpfIncrementoUmbralBpc')} />
            <TextInput label="Incremento" {...percent} {...form.getInputProps('irpfIncremento')} />
            <TextInput label="Umbral de tasa de deducción" {...bpc} {...form.getInputProps('irpfDeduccionUmbralBpc')} />
            <div />
            <TextInput
              label="Tasa de deducción hasta el umbral"
              {...percent}
              {...form.getInputProps('irpfTasaDeduccionBaja')}
            />
            <TextInput
              label="Tasa de deducción sobre el umbral"
              {...percent}
              {...form.getInputProps('irpfTasaDeduccionAlta')}
            />
            <TextInput label="Deducción anual por hijo" {...bpc} {...form.getInputProps('irpfHijoBpcAnual')} />
            <TextInput
              label="Deducción anual por hijo con discapacidad"
              {...bpc}
              {...form.getInputProps('irpfHijoDiscBpcAnual')}
            />
          </SimpleGrid>
        </Section>

        <Section title="Franjas de IRPF">
          <Table withTableBorder aria-label="Franjas de IRPF">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Desde (BPC)</Table.Th>
                <Table.Th>Hasta (BPC)</Table.Th>
                <Table.Th>Tasa (%)</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {franjas.map((_, i) => {
                const hasta = form.getInputProps(`franjas.${i}.hastaBpc`)
                return (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <TextInput
                        aria-label={`Desde franja ${i + 1}`}
                        inputMode="decimal"
                        {...form.getInputProps(`franjas.${i}.desdeBpc`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        aria-label={`Hasta franja ${i + 1}`}
                        placeholder="Sin límite"
                        inputMode="decimal"
                        {...hasta}
                        onChange={(event) => setHasta(i, event.currentTarget.value)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        aria-label={`Tasa franja ${i + 1}`}
                        inputMode="decimal"
                        {...form.getInputProps(`franjas.${i}.tasa`)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Eliminar franja ${i + 1}`}
                        disabled={franjas.length === 1}
                        onClick={() => form.removeListItem('franjas', i)}
                      >
                        ×
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed">
            La primera franja comienza en 0, cada una empieza donde termina la anterior y solo la última queda
            sin límite superior.
          </Text>
          {(franjasServerError ?? franjasFormError) && (
            <Alert color="red" role="alert">
              {franjasServerError ?? franjasFormError}
            </Alert>
          )}
          <Group>
            <Button variant="light" size="xs" onClick={addFranja}>
              Agregar franja
            </Button>
          </Group>
        </Section>

        {generalServerError && (
          <Alert color="red" title="No se pudo guardar">
            {generalServerError}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button type="submit" loading={actualizar.isPending}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={3} fz={18} ff="var(--mantine-font-family)" fw={600}>
          {title}
        </Title>
        {children}
      </Stack>
    </Paper>
  )
}
