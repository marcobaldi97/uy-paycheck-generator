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
import { formatFecha } from '../../format'
import { AYUDA, AYUDA_FRANJA } from './ayuda'
import { Etiqueta } from './Etiqueta'
import {
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
            <MoneyInput label={<Etiqueta texto="Valor BPC" ayuda={AYUDA.bpc} />}
 aria-description={AYUDA.bpc} withAsterisk rightSection="$" {...form.getInputProps('bpc')} />
            <MoneyInput
              label={<Etiqueta texto="Tope montepío" ayuda={AYUDA.topeMontepio} />}
 aria-description={AYUDA.topeMontepio}
              description="Vacío = sin tope"
              rightSection="$"
              {...form.getInputProps('topeMontepio')}
            />
            <TextInput label={<Etiqueta texto="Montepío" ayuda={AYUDA.montepio} />}
 aria-description={AYUDA.montepio} {...percent} {...form.getInputProps('montepio')} />
            <TextInput label={<Etiqueta texto="FRL" ayuda={AYUDA.frl} />}
 aria-description={AYUDA.frl} {...percent} {...form.getInputProps('frl')} />
          </SimpleGrid>
        </Section>

        <Section title="FONASA">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label={<Etiqueta texto="Umbral de franja" ayuda={AYUDA.fonasaUmbralBpc} />}
 aria-description={AYUDA.fonasaUmbralBpc} {...bpc} {...form.getInputProps('fonasaUmbralBpc')} />
            <div />
            <TextInput label={<Etiqueta texto="Hasta el umbral, sin cónyuge" ayuda={AYUDA.fonasaBajoSinConyuge} />}
 aria-description={AYUDA.fonasaBajoSinConyuge} {...percent} {...form.getInputProps('fonasaBajoSinConyuge')} />
            <TextInput label={<Etiqueta texto="Hasta el umbral, con cónyuge" ayuda={AYUDA.fonasaBajoConConyuge} />}
 aria-description={AYUDA.fonasaBajoConConyuge} {...percent} {...form.getInputProps('fonasaBajoConConyuge')} />
            <TextInput label={<Etiqueta texto="Sobre el umbral, sin cargas" ayuda={AYUDA.fonasaAltoSinCargas} />}
 aria-description={AYUDA.fonasaAltoSinCargas} {...percent} {...form.getInputProps('fonasaAltoSinCargas')} />
            <TextInput label={<Etiqueta texto="Sobre el umbral, con hijos" ayuda={AYUDA.fonasaAltoHijos} />}
 aria-description={AYUDA.fonasaAltoHijos} {...percent} {...form.getInputProps('fonasaAltoHijos')} />
            <TextInput label={<Etiqueta texto="Sobre el umbral, con cónyuge" ayuda={AYUDA.fonasaAltoConyuge} />}
 aria-description={AYUDA.fonasaAltoConyuge} {...percent} {...form.getInputProps('fonasaAltoConyuge')} />
            <TextInput
              label={<Etiqueta texto="Sobre el umbral, cónyuge e hijos" ayuda={AYUDA.fonasaAltoConyugeHijos} />}
 aria-description={AYUDA.fonasaAltoConyugeHijos}
              {...percent}
              {...form.getInputProps('fonasaAltoConyugeHijos')}
            />
          </SimpleGrid>
        </Section>

        <Section title="IRPF">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label={<Etiqueta texto="Umbral del incremento" ayuda={AYUDA.irpfIncrementoUmbralBpc} />}
 aria-description={AYUDA.irpfIncrementoUmbralBpc} {...bpc} {...form.getInputProps('irpfIncrementoUmbralBpc')} />
            <TextInput label={<Etiqueta texto="Incremento" ayuda={AYUDA.irpfIncremento} />}
 aria-description={AYUDA.irpfIncremento} {...percent} {...form.getInputProps('irpfIncremento')} />
            <TextInput label={<Etiqueta texto="Umbral de tasa de deducción" ayuda={AYUDA.irpfDeduccionUmbralBpc} />}
 aria-description={AYUDA.irpfDeduccionUmbralBpc} {...bpc} {...form.getInputProps('irpfDeduccionUmbralBpc')} />
            <div />
            <TextInput
              label={<Etiqueta texto="Tasa de deducción hasta el umbral" ayuda={AYUDA.irpfTasaDeduccionBaja} />}
 aria-description={AYUDA.irpfTasaDeduccionBaja}
              {...percent}
              {...form.getInputProps('irpfTasaDeduccionBaja')}
            />
            <TextInput
              label={<Etiqueta texto="Tasa de deducción sobre el umbral" ayuda={AYUDA.irpfTasaDeduccionAlta} />}
 aria-description={AYUDA.irpfTasaDeduccionAlta}
              {...percent}
              {...form.getInputProps('irpfTasaDeduccionAlta')}
            />
            <TextInput label={<Etiqueta texto="Deducción anual por hijo" ayuda={AYUDA.irpfHijoBpcAnual} />}
 aria-description={AYUDA.irpfHijoBpcAnual} {...bpc} {...form.getInputProps('irpfHijoBpcAnual')} />
            <TextInput
              label={<Etiqueta texto="Deducción anual por hijo con discapacidad" ayuda={AYUDA.irpfHijoDiscBpcAnual} />}
 aria-description={AYUDA.irpfHijoDiscBpcAnual}
              {...bpc}
              {...form.getInputProps('irpfHijoDiscBpcAnual')}
            />
          </SimpleGrid>
        </Section>

        <Section title="Franjas de IRPF">
          <Table withTableBorder aria-label="Franjas de IRPF">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
<Etiqueta texto="Desde (BPC)" ayuda={AYUDA_FRANJA.desde} />
</Table.Th>
                <Table.Th>
<Etiqueta texto="Hasta (BPC)" ayuda={AYUDA_FRANJA.hasta} />
</Table.Th>
                <Table.Th>
<Etiqueta texto="Tasa (%)" ayuda={AYUDA_FRANJA.tasa} />
</Table.Th>
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
