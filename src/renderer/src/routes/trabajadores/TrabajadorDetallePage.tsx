// Worker detail: identity form + conditions history with "Nueva condición".
// `/trabajadores/nuevo` shows the create form; after creating, it moves to the new
// worker's detail so the first condition can be added.

import { Alert, Anchor, Button, Card, Group, Loader, Modal, Stack, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { errorMessage, isApiErrorCode } from '../../api/client'
import { useActualizarTrabajador, useCrearTrabajador, useNuevaCondicion, useTrabajador, useTrabajadores } from '../../api/hooks'
import { paths } from '../../paths'
import { CondicionesHistorial } from './CondicionesHistorial'
import { CondicionForm } from './CondicionForm'
import { nuevaCondicionInicial, siguienteNumero, trabajadorAForm, trabajadorVacio } from './forms'
import { TrabajadorForm } from './TrabajadorForm'

export function TrabajadorDetallePage() {
  const { trabajadorId } = useParams()
  if (trabajadorId === 'nuevo') return <NuevoTrabajador />
  const id = Number(trabajadorId)
  if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== trabajadorId) return <NoEncontrado />
  // key: a fresh form per worker when navigating between details.
  return <TrabajadorExistente key={id} id={id} />
}

function Volver() {
  return (
    <Anchor component={Link} to={paths.trabajadores()} size="sm">
      ← Trabajadores
    </Anchor>
  )
}

function NoEncontrado() {
  return (
    <Stack>
      <Volver />
      <Alert color="yellow" title="Trabajador no encontrado">
        El trabajador no existe o fue eliminado.
      </Alert>
    </Stack>
  )
}

function NuevoTrabajador() {
  const navigate = useNavigate()
  const todos = useTrabajadores(false)
  const crear = useCrearTrabajador()

  return (
    <Stack>
      <Volver />
      <Title order={2}>Nuevo trabajador</Title>
      {todos.isPending ? (
        <Loader aria-label="Cargando" />
      ) : (
        <Card withBorder>
          <TrabajadorForm
            // Suggest the next number once the list is known; empty if it failed to load.
            initialValues={trabajadorVacio(todos.data ? siguienteNumero(todos.data) : '')}
            submitLabel="Crear trabajador"
            onGuardar={async (input) => {
              const creado = await crear.mutateAsync(input)
              notifications.show({ color: 'green', message: 'Trabajador creado. Agregue sus condiciones.' })
              navigate(paths.trabajador(creado.id), { replace: true })
            }}
          />
        </Card>
      )}
    </Stack>
  )
}

function TrabajadorExistente({ id }: { id: number }) {
  const { data, error, isPending } = useTrabajador(id)
  const actualizar = useActualizarTrabajador()
  const nuevaCondicion = useNuevaCondicion()
  const [condicionAbierta, setCondicionAbierta] = useState(false)

  if (isPending) return <Loader aria-label="Cargando" />
  if (error) {
    if (isApiErrorCode(error, 'NO_ENCONTRADO')) return <NoEncontrado />
    return (
      <Stack>
        <Volver />
        <Alert color="red" title="No se pudo cargar el trabajador">
          {errorMessage(error)}
        </Alert>
      </Stack>
    )
  }

  const { trabajador, condiciones } = data
  const hoy = dayjs().format('YYYY-MM-DD')

  return (
    <Stack>
      <Volver />
      <Title order={2}>
        {trabajador.numero} · {trabajador.nombre}
      </Title>

      <Card withBorder>
        <Stack>
          <Title order={4}>Datos</Title>
          <TrabajadorForm
            initialValues={trabajadorAForm(trabajador)}
            submitLabel="Guardar"
            requireDirty
            onGuardar={async (datos) => {
              await actualizar.mutateAsync({ id, datos })
              notifications.show({ color: 'green', message: 'Datos guardados.' })
            }}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Title order={4}>Condiciones</Title>
            <Button onClick={() => setCondicionAbierta(true)}>Nueva condición</Button>
          </Group>
          <CondicionesHistorial condiciones={condiciones} hoy={hoy} />
        </Stack>
      </Card>

      <Modal opened={condicionAbierta} onClose={() => setCondicionAbierta(false)} title="Nueva condición" size="lg">
        {condicionAbierta && (
          <CondicionForm
            initialValues={nuevaCondicionInicial(condiciones[0])}
            onCancelar={() => setCondicionAbierta(false)}
            onGuardar={async (condicion) => {
              await nuevaCondicion.mutateAsync({ trabajadorId: id, condicion })
              notifications.show({ color: 'green', message: 'Condición agregada.' })
              setCondicionAbierta(false)
            }}
          />
        )}
      </Modal>
    </Stack>
  )
}
