// Respaldo: copies the database file to a folder the user picks (main opens the dialog).

import { Alert, Button, Code, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import type { IsoDateTime } from '@shared/types'
import dayjs from 'dayjs'
import { errorMessage } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { useCrearRespaldo, useRespaldoInfo } from '../../api/hooks'

/** ISO UTC → local "DD/MM/YYYY HH:mm". */
const formatFechaHora = (iso: IsoDateTime) => dayjs(iso).format('DD/MM/YYYY HH:mm')

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
              <div>
                <Text size="sm" c="dimmed">
                  Último respaldo
                </Text>
                <Text data-testid="ultimo-respaldo">
                  {info.data.ultimoRespaldo ? formatFechaHora(info.data.ultimoRespaldo) : 'Nunca'}
                </Text>
              </div>
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
