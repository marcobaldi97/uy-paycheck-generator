// Parámetros: versions by vigenteDesde (newest first), an editor for the selected one and
// "Nueva versión", which duplicates the latest version under a new date.

import { Alert, Badge, Button, Grid, Loader, NavLink, Paper, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import type { IsoDate } from '@shared/types'
import dayjs from 'dayjs'
import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { useParametros } from '../../api/hooks'
import { PageHeader } from '../../components/PageHeader'
import { formatFecha } from '../../format'
import { NuevaVersionModal } from './NuevaVersionModal'
import { ParametrosEditor } from './ParametrosEditor'

export function ParametrosPage() {
  const parametros = useParametros()
  const [selected, setSelected] = useState<IsoDate | null>(null)
  const [creating, setCreating] = useState(false)

  const versions = parametros.data ?? []
  const current = versions.find((v) => v.vigenteDesde === selected) ?? versions[0]
  const today = dayjs().format('YYYY-MM-DD')
  const vigente = versions.find((v) => v.vigenteDesde <= today)?.vigenteDesde

  return (
    <Stack>
      <PageHeader
        title="Parámetros"
        eyebrow="Tasas y topes que usa el cálculo de cada recibo"
        actions={
          <Button size="lg" onClick={() => setCreating(true)} disabled={versions.length === 0}>
            Nueva versión
          </Button>
        }
      />

      {parametros.isPending ? (
        <Loader aria-label="Cargando" />
      ) : parametros.isError ? (
        <Alert color="red" title="No se pudieron cargar los parámetros">
          {errorMessage(parametros.error)}
        </Alert>
      ) : current === undefined ? (
        <Alert color="yellow">No hay parámetros cargados.</Alert>
      ) : (
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Paper withBorder radius="lg" p="xs">
              <Text size="sm" fw={600} px="sm" pb="xs">
                Vigente desde
              </Text>
              <nav aria-label="Versiones">
                {versions.map((v) => (
                  <NavLink
                    key={v.vigenteDesde}
                    component="button"
                    label={formatFecha(v.vigenteDesde)}
                    active={v.vigenteDesde === current.vigenteDesde}
                    onClick={() => setSelected(v.vigenteDesde)}
                    rightSection={
                      v.vigenteDesde === vigente ? (
                        <Badge size="xs" variant="light">
                          Vigente
                        </Badge>
                      ) : v.vigenteDesde > today ? (
                        <Badge size="xs" variant="light" color="gray">
                          Futura
                        </Badge>
                      ) : null
                    }
                  />
                ))}
              </nav>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 9 }}>
            <ParametrosEditor key={current.vigenteDesde} version={current} />
          </Grid.Col>
        </Grid>
      )}

      <NuevaVersionModal
        opened={creating}
        onClose={() => setCreating(false)}
        existentes={versions.map((v) => v.vigenteDesde)}
        onCreated={(version) => {
          setCreating(false)
          setSelected(version.vigenteDesde)
          notifications.show({
            color: 'green',
            message: `Versión ${formatFecha(version.vigenteDesde)} creada a partir de la última. Revisá los valores y guardá.`,
          })
        }}
      />
    </Stack>
  )
}
