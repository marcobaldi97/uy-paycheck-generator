// "Vista previa": every receipt of the liquidación exactly as the PDF renders it (same data from
// main and the same template as the print route), with the export options at hand.

import { Alert, Button, Center, Group, Loader, Menu, Modal, Stack, Text } from '@mantine/core'
import type { ModoExportacion } from '@shared/types'
import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { useDatosImpresion } from '../../api/hooks'
import { ReciboPreview } from '../../components/ReciboPreview'

export interface VistaPreviaModalProps {
  opened: boolean
  liquidacionId: number
  titulo: string
  onExportar: (modo: ModoExportacion) => void
  onClose: () => void
}

export function VistaPreviaModal({ opened, liquidacionId, titulo, onExportar, onClose }: VistaPreviaModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={titulo} size="calc(210mm + 4rem)" centered>
      {opened && <Contenido liquidacionId={liquidacionId} onExportar={onExportar} onCancel={onClose} />}
    </Modal>
  )
}

function Contenido({
  liquidacionId,
  onExportar,
  onCancel,
}: Pick<VistaPreviaModalProps, 'liquidacionId' | 'onExportar'> & { onCancel: () => void }) {
  const datos = useDatosImpresion(liquidacionId, null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const recibos = datos.data ?? []

  let cuerpo
  if (datos.isPending) {
    cuerpo = (
      <Center py="xl">
        <Loader aria-label="Cargando vista previa" />
      </Center>
    )
  } else if (datos.isError) {
    cuerpo = (
      <Alert color="red" role="alert" title="No se pudo generar la vista previa">
        {errorMessage(datos.error)}
      </Alert>
    )
  } else if (recibos.length === 0) {
    cuerpo = <Text c="dimmed">La liquidación no tiene recibos.</Text>
  } else {
    cuerpo = (
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          {recibos.length} {recibos.length === 1 ? 'recibo' : 'recibos'}, una hoja A4 por trabajador (original y
          copia).
        </Text>
        {recibos.map((recibo) => (
          <Stack key={recibo.reciboId} gap={4}>
            <Text fw={600} size="sm">
              {recibo.trabajador.nombre}
            </Text>
            <ReciboPreview datos={recibo} etiqueta={`Recibo de ${recibo.trabajador.nombre}`} />
          </Stack>
        ))}
      </Stack>
    )
  }

  return (
    <Stack>
      {cuerpo}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cerrar
        </Button>
        <Menu position="top-end" opened={menuAbierto} onChange={setMenuAbierto}>
          <Menu.Target>
            <Button disabled={recibos.length === 0}>Exportar PDF</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => onExportar('unico')}>Un solo archivo</Menu.Item>
            <Menu.Item onClick={() => onExportar('por_trabajador')}>Un archivo por trabajador</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Stack>
  )
}
