// Asks for the vigenteDesde of a new parameter version. Main copies the latest version under
// that date right away; the page then opens it for editing.

import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { schemaResolver, useForm } from '@mantine/form'
import { isoDateSchema } from '@shared/schemas'
import type { IsoDate, ParametrosVersion } from '@shared/types'
import { z } from 'zod'
import { errorMessage } from '../../api/client'
import { useNuevaVersionParametros } from '../../api/hooks'
import { parseFechaUy } from './form'

interface Props {
  opened: boolean
  onClose: () => void
  /** vigenteDesde of the versions that already exist. */
  existentes: IsoDate[]
  onCreated: (version: ParametrosVersion) => void
}

export function NuevaVersionModal({ opened, onClose, existentes, onCreated }: Props) {
  const schema = z.object({
    vigenteDesde: z
      .string({ error: 'Elegí una fecha' })
      .pipe(isoDateSchema)
      .refine((d) => !existentes.includes(d), 'Ya existe una versión con esa fecha'),
  })
  const form = useForm<{ vigenteDesde: IsoDate | null }>({
    initialValues: { vigenteDesde: null },
    validate: schemaResolver(schema, { sync: true }),
  })
  const nuevaVersion = useNuevaVersionParametros({
    onSuccess: (version) => {
      close()
      onCreated(version)
    },
  })

  function close() {
    form.reset()
    nuevaVersion.reset()
    onClose()
  }

  return (
    <Modal opened={opened} onClose={close} title="Nueva versión de parámetros">
      <form
        noValidate
        onSubmit={form.onSubmit(({ vigenteDesde }) => {
          if (vigenteDesde) nuevaVersion.mutate({ vigenteDesde })
        })}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Se copian los valores y las franjas de IRPF de la última versión. Después podés modificarlos.
          </Text>
          <DateInput
            label="Vigente desde"
            placeholder="dd/mm/aaaa"
            valueFormat="DD/MM/YYYY"
            dateParser={parseFechaUy}
            withAsterisk
            data-autofocus
            {...form.getInputProps('vigenteDesde')}
          />
          {nuevaVersion.isError && <Alert color="red">{errorMessage(nuevaVersion.error)}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={nuevaVersion.isPending}>
              Crear
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
