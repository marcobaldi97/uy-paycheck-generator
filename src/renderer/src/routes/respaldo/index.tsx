// Respaldo: copies the database file to a folder the user picks (main opens the dialog).

import { Alert, Badge, Button, Code, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import type { IsoDateTime } from '@shared/types'
import dayjs from 'dayjs'
import { errorMessage } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useCrearRespaldo, useRespaldoInfo } from '../../api/hooks'

/** ISO UTC → local "DD/MM/YYYY HH:mm". */
const formatFechaHora = (iso: IsoDateTime) => dayjs(iso).format('DD/MM/YYYY HH:mm')

/** A backup older than this many days no longer counts as "al día". */
const DIAS_AL_DIA = 30

function EstadoRespaldo({ ultimo }: { ultimo: IsoDateTime | null }) {
  if (ultimo === null) {
    return (
      <Badge color="amber" variant="light" size="lg">
        Sin respaldos
      </Badge>
    )
  }
  const alDia = dayjs().diff(dayjs(ultimo), 'day') <= DIAS_AL_DIA
  return (
    <Badge color={alDia ? 'forest' : 'amber'} variant="light" size="lg">
      {alDia ? 'Al día' : 'Hace tiempo sin respaldo'}
    </Badge>
  )
}

export function RespaldoPage() {
  const info = useRespaldoInfo()
  const crear = useCrearRespaldo()

  return (
    <Stack maw={720}>
      <PageHeader title="Respaldo" eyebrow="Una copia completa de tus datos" />
      <Paper withBorder radius="xl" p="xl">
        <Stack>
          {info.isPending ? (
            <Loader aria-label="Cargando" />
          ) : info.isError ? (
            <Alert color="red" title="No se pudo obtener la información">
              {errorMessage(info.error)}
            </Alert>
          ) : (
            <>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="sm" c="dimmed">
                    Último respaldo
                  </Text>
                  <Text ff="var(--mantine-font-family-headings)" fz={30} lh={1.15} data-testid="ultimo-respaldo">
                    {info.data.ultimoRespaldo ? formatFechaHora(info.data.ultimoRespaldo) : 'Nunca'}
                  </Text>
                </div>
                <EstadoRespaldo ultimo={info.data.ultimoRespaldo} />
              </Group>
              <div>
                <Text size="sm" c="dimmed">
                  Base de datos
                </Text>
                <Code>{info.data.ubicacionDb}</Code>
              </div>
            </>
          )}

          <Text size="sm">
            Se guarda una copia completa de la base de datos en la carpeta que elijas. Conviene guardarla
            en otro disco o en la nube.
          </Text>
          <Paper bg="amber.0" radius="md" p="md">
            <Text size="sm" c="amber.9">
              Una copia guardada en el mismo disco no te protege si ese disco falla.
            </Text>
          </Paper>

          {crear.isError && (
            <Alert color="red" title="No se pudo crear el respaldo">
              {errorMessage(crear.error)}
            </Alert>
          )}
          {crear.isSuccess && !crear.data.cancelado && (
            <Alert color="forest" title="Respaldo creado">
              <Code>{crear.data.archivo}</Code>
            </Alert>
          )}

          <Group>
            <Button size="lg" onClick={() => crear.mutate()} loading={crear.isPending}>
              Crear respaldo
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  )
}
