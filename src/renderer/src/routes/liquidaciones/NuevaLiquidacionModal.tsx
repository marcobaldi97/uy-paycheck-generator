// "Nueva liquidación": period, fecha de cargo, fecha de pago. When main refuses to create it
// (no parameters, no active workers, a worker without conditions, period taken) the reason
// is shown in the modal with a link to the screen that fixes it.

import { Alert, Anchor, Button, Group, List, Modal, Stack, Text } from '@mantine/core'
import { DatePickerInput, MonthPickerInput } from '@mantine/dates'
import { fechaResolucion } from '@shared/periodo'
import type { IsoDate, Periodo } from '@shared/types'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage, isApiErrorCode, type ApiRequestError } from '../../api/client'
import { useCrearLiquidacion } from '../../api/hooks'
import { paths } from '../../paths'
import { nombrePeriodo } from './formato'

export interface NuevaLiquidacionModalProps {
  opened: boolean
  onClose: () => void
  /** Initial period; fecha de cargo and fecha de pago default to its last day. */
  periodoInicial: Periodo
}

export function NuevaLiquidacionModal({ opened, onClose, periodoInicial }: NuevaLiquidacionModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Nueva liquidación" size="md">
      {/* Mounted only while open, so every opening starts from fresh defaults. */}
      {opened && <NuevaLiquidacionForm periodoInicial={periodoInicial} onCancel={onClose} />}
    </Modal>
  )
}

function NuevaLiquidacionForm({ periodoInicial, onCancel }: { periodoInicial: Periodo; onCancel: () => void }) {
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState<Periodo | null>(periodoInicial)
  const [fechaCargo, setFechaCargo] = useState<IsoDate | null>(fechaResolucion(periodoInicial))
  const [fechaPago, setFechaPago] = useState<IsoDate | null>(fechaResolucion(periodoInicial))
  const [intentado, setIntentado] = useState(false)

  const crear = useCrearLiquidacion({
    onSuccess: (liquidacion) => navigate(paths.liquidacion(liquidacion.id)),
  })

  const cambiarPeriodo = (valor: string | null) => {
    const nuevo = valor ? valor.slice(0, 7) : null
    setPeriodo(nuevo)
    if (nuevo) {
      setFechaCargo(fechaResolucion(nuevo))
      setFechaPago(fechaResolucion(nuevo))
    }
    crear.reset()
  }

  const requerido = (valor: string | null) => (intentado && !valor ? 'Requerido' : undefined)

  const enviar = (event: FormEvent) => {
    event.preventDefault()
    setIntentado(true)
    if (!periodo || !fechaCargo || !fechaPago) return
    crear.mutate({ periodo, fechaCargo, fechaPago })
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Stack>
        <MonthPickerInput
          label="Período"
          value={periodo ? `${periodo}-01` : null}
          onChange={cambiarPeriodo}
          valueFormat="MM/YYYY"
          error={requerido(periodo)}
          required
        />
        <DatePickerInput
          label="Fecha de cargo"
          value={fechaCargo}
          onChange={(valor) => {
            setFechaCargo(valor)
            crear.reset()
          }}
          valueFormat="DD/MM/YYYY"
          error={requerido(fechaCargo)}
          required
        />
        <DatePickerInput
          label="Fecha de pago"
          value={fechaPago}
          onChange={(valor) => {
            setFechaPago(valor)
            crear.reset()
          }}
          valueFormat="DD/MM/YYYY"
          error={requerido(fechaPago)}
          required
        />

        {crear.error && <CreacionBloqueada error={crear.error} periodo={periodo} />}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={crear.isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={crear.isPending}>
            Crear
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

interface TrabajadorNombrado {
  id: number
  nombre: string
}

function trabajadoresDe(error: ApiRequestError): TrabajadorNombrado[] {
  const lista = error.details?.['trabajadores']
  if (!Array.isArray(lista)) return []
  return lista.filter(
    (t): t is TrabajadorNombrado =>
      typeof t === 'object' && t !== null && typeof t.id === 'number' && typeof t.nombre === 'string',
  )
}

function CreacionBloqueada({ error, periodo }: { error: ApiRequestError; periodo: Periodo | null }) {
  const trabajadores = isApiErrorCode(error, 'TRABAJADOR_SIN_CONDICIONES') ? trabajadoresDe(error) : []
  const titulo =
    periodo !== null
      ? `No se puede crear la liquidación de ${nombrePeriodo(periodo)}`
      : 'No se puede crear la liquidación'

  return (
    <Alert color="red" title={titulo} role="alert">
      <Stack gap="xs">
        <Text size="sm">{errorMessage(error)}</Text>
        {trabajadores.length > 0 && (
          <List size="sm">
            {trabajadores.map((t) => (
              <List.Item key={t.id}>
                <Anchor component={Link} to={paths.trabajador(t.id)} size="sm">
                  Agregar condiciones a {t.nombre}
                </Anchor>
              </List.Item>
            ))}
          </List>
        )}
        {isApiErrorCode(error, 'SIN_PARAMETROS') && (
          <Anchor component={Link} to={paths.parametros()} size="sm">
            Ir a Parámetros
          </Anchor>
        )}
        {isApiErrorCode(error, 'SIN_TRABAJADORES_ACTIVOS') && (
          <Anchor component={Link} to={paths.trabajadores()} size="sm">
            Ir a Trabajadores
          </Anchor>
        )}
      </Stack>
    </Alert>
  )
}
