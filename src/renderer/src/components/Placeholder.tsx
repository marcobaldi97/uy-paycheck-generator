import { Stack, Text, Title } from '@mantine/core'

/** Stand-in screen used by T0 until the owning task implements the route. */
export function Placeholder({ title, task }: { title: string; task: string }) {
  return (
    <Stack gap="xs">
      <Title order={2}>{title}</Title>
      <Text c="dimmed">Pendiente ({task}).</Text>
    </Stack>
  )
}
