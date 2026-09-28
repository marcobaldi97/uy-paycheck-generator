import { Button, Group, Modal, Stack, Text } from '@mantine/core'

export interface ConfirmarModalProps {
  opened: boolean
  titulo: string
  mensaje: string
  confirmar: string
  color?: string
  onConfirm: () => void
  onClose: () => void
}

/** Plain confirm dialog (the modals manager isn't needed for two buttons). */
export function ConfirmarModal({ opened, titulo, mensaje, confirmar, color, onConfirm, onClose }: ConfirmarModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={titulo} centered>
      <Stack>
        <Text size="sm">{mensaje}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            color={color}
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {confirmar}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
