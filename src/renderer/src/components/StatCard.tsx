import { Paper, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Highlighted card (the figure the page is about). */
  destacada?: boolean
  testId?: string
}

export function StatCard({ label, value, destacada = false, testId }: StatCardProps) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="lg"
      bg={destacada ? 'forest.0' : undefined}
      style={destacada ? { borderColor: 'var(--mantine-color-forest-1)' } : undefined}
    >
      <Text size="sm" c={destacada ? 'forest.7' : 'dimmed'} fw={destacada ? 500 : 400}>
        {label}
      </Text>
      <Text ff="var(--mantine-font-family-headings)" fz={30} lh={1.1} mt={8} data-testid={testId}>
        {value}
      </Text>
    </Paper>
  )
}
