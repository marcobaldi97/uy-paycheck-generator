// Printer choice for "Imprimir". A named printer prints silently; the system option opens
// Windows' print dialog from main.

import { Alert, Button, Group, Loader, Modal, NativeSelect, Stack, Text } from '@mantine/core'
import type { Impresora } from '@shared/types'
import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { useImpresoras } from '../../api/hooks'

/** Select value for "use the system dialog" (impresora: null). */
export const DIALOGO_SISTEMA = '__dialogo_sistema__'

export interface ImprimirModalProps {
  opened: boolean
  cantidadRecibos: number
  imprimiendo: boolean
  onImprimir: (impresora: string | null) => void
  onClose: () => void
}

export function ImprimirModal({ opened, cantidadRecibos, imprimiendo, onImprimir, onClose }: ImprimirModalProps) {
  return (
    <Modal opened={opened} onClose={imprimiendo ? () => {} : onClose} title="Imprimir recibos" centered>
      {opened && (
        <ImprimirForm
          cantidadRecibos={cantidadRecibos}
          imprimiendo={imprimiendo}
          onImprimir={onImprimir}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}

function porDefecto(impresoras: Impresora[]): string {
  return (impresoras.find((i) => i.predeterminada) ?? impresoras[0])?.nombre ?? DIALOGO_SISTEMA
}

function ImprimirForm({
  cantidadRecibos,
  imprimiendo,
  onImprimir,
  onCancel,
}: Omit<ImprimirModalProps, 'opened' | 'onClose'> & { onCancel: () => void }) {
  const impresoras = useImpresoras()
  // null until the user picks something; then their choice wins over the default.
  const [elegida, setElegida] = useState<string | null>(null)
  const seleccion = elegida ?? (impresoras.data ? porDefecto(impresoras.data) : DIALOGO_SISTEMA)

  const opciones = [
    ...(impresoras.data ?? []).map((i) => ({
      value: i.nombre,
      label: i.predeterminada ? `${i.nombre} (predeterminada)` : i.nombre,
    })),
    { value: DIALOGO_SISTEMA, label: 'Elegir en el diálogo de impresión de Windows' },
  ]

  return (
    <Stack>
      <Text size="sm">
        Se imprimirán {cantidadRecibos} {cantidadRecibos === 1 ? 'recibo' : 'recibos'} (original y copia en cada
        hoja).
      </Text>
      {impresoras.isPending ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Buscando impresoras…
          </Text>
        </Group>
      ) : (
        <NativeSelect
          label="Impresora"
          data={opciones}
          value={seleccion}
          onChange={(event) => setElegida(event.currentTarget.value)}
          disabled={imprimiendo}
        />
      )}
      {impresoras.isError && (
        <Alert color="yellow" role="alert">
          No se pudo obtener la lista de impresoras ({errorMessage(impresoras.error)}). Podés elegir la impresora en
          el diálogo de Windows.
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={imprimiendo}>
          Cancelar
        </Button>
        <Button
          onClick={() => onImprimir(seleccion === DIALOGO_SISTEMA ? null : seleccion)}
          loading={imprimiendo}
          disabled={impresoras.isPending}
        >
          Imprimir
        </Button>
      </Group>
    </Stack>
  )
}
