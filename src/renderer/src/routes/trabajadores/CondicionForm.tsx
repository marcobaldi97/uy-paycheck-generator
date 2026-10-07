// "Nueva condición" form. Past conditions are never edited: every change is a new row
// with its own start date, prefilled from the newest one.

import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { casoFonasa, type CasoFonasa } from '@shared/fonasa'
import { formatRatePercent, parseRatePercent } from '@shared/money'
import type { Cents, CondicionInput, IsoDate } from '@shared/types'
import dayjs from 'dayjs'
import { useState } from 'react'
import { errorMessage, isApiErrorCode } from '../../api/client'
import { useTasaFonasa } from '../../api/hooks'
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
        <TasaFonasaAplicada
          vigenteDesde={form.values.vigenteDesde}
          sueldoNominal={form.values.sueldoNominal}
          fonasaConyuge={form.values.fonasaConyuge}
          fonasaHijos={form.values.fonasaHijos}
          fonasaTasaManual={form.values.fonasaTasaManual}
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

interface TasaFonasaAplicadaProps {
  vigenteDesde: string
  sueldoNominal: Cents | null
  fonasaConyuge: boolean
  fonasaHijos: boolean
  fonasaTasaManual: string
}

/** The date the preview resolves parámetros for: the condition's start date, or today. */
function fechaConsulta(vigenteDesde: string): IsoDate {
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde) && dayjs(vigenteDesde).format('YYYY-MM-DD') === vigenteDesde
  return valida ? vigenteDesde : dayjs().format('YYYY-MM-DD')
}

const DESCRIPCION_CASO: Record<CasoFonasa, string> = {
  bajo_sin_conyuge: 'hasta el umbral, sin cónyuge',
  bajo_con_conyuge: 'hasta el umbral, con cónyuge',
  alto_sin_cargas: 'sobre el umbral, sin cónyuge ni hijos',
  alto_conyuge: 'sobre el umbral, con cónyuge',
  alto_hijos: 'sobre el umbral, con hijos',
  alto_conyuge_hijos: 'sobre el umbral, con cónyuge e hijos',
}

/**
 * Live preview of the FONASA rate this condition produces. The rate comes from main
 * (`trabajadores.tasaFonasa`); this component only formats it.
 */
function TasaFonasaAplicada({
  vigenteDesde,
  sueldoNominal,
  fonasaConyuge,
  fonasaHijos,
  fonasaTasaManual,
}: TasaFonasaAplicadaProps) {
  const manual = fonasaTasaManual.trim() === '' ? null : parseRatePercent(fonasaTasaManual)
  const consulta =
    manual === null && sueldoNominal !== null
      ? { fecha: fechaConsulta(vigenteDesde), sueldoNominal, fonasaConyuge, fonasaHijos }
      : null
  const query = useTasaFonasa(consulta)

  let contenido
  if (manual !== null) {
    contenido = <Text size="sm">Tasa FONASA aplicada: {formatRatePercent(manual)} % (manual)</Text>
  } else if (consulta === null) {
    contenido = (
      <Text size="sm" c="dimmed">
        Ingrese el sueldo nominal para ver la tasa FONASA.
      </Text>
    )
  } else if (query.isError) {
    contenido = (
      <Text size="sm" c="dimmed">
        {errorMessage(query.error)}
      </Text>
    )
  } else if (!query.data) {
    contenido = <Loader size="xs" aria-label="Calculando tasa FONASA" />
  } else {
    const caso = DESCRIPCION_CASO[casoFonasa(query.data.bandaAlta, consulta)]
    contenido = (
      <>
        <Text size="sm">
          Tasa FONASA aplicada: {formatRatePercent(query.data.tasa)} % ({caso})
        </Text>
        <Text size="xs" c="dimmed">
          Estimada con el sueldo nominal; en el recibo se usa el imponible del mes.
        </Text>
      </>
    )
  }

  // Fixed minimum height so switching between states doesn't shift the fields below.
  return (
    <Stack gap={2} mih={40} aria-live="polite" data-testid="tasa-fonasa-aplicada">
      {contenido}
    </Stack>
  )
}
