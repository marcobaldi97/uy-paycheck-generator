import { Box, Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  /** Small line above the title (company, counts, hint). */
  eyebrow?: ReactNode
  /** Badge or other inline element next to the title. */
  badge?: ReactNode
  /** Line under the title. */
  subtitle?: ReactNode
  /** Primary and secondary actions, aligned right. */
  actions?: ReactNode
}

export function PageHeader({ title, eyebrow, badge, subtitle, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" wrap="nowrap" gap="lg">
      <Box>
        {eyebrow && (
          <Text size="sm" c="dimmed" mb={4}>
            {eyebrow}
          </Text>
        )}
        <Group gap="md" wrap="nowrap">
          <Title order={1} fz={40} lh={1.1} style={{ letterSpacing: '-0.01em' }}>
            {title}
          </Title>
          {/* Mantine's Badge clips its label (overflow: hidden), so in this nowrap row it would
              shrink to an ellipsis when the title wraps. Keep it at its natural width. */}
          {badge && (
            <Box style={{ flexShrink: 0 }}>
              {badge}
            </Box>
          )}
        </Group>
        {subtitle && (
          <Text c="dimmed" mt={8}>
            {subtitle}
          </Text>
        )}
      </Box>
      {actions && (
        <Group gap="xs" justify="flex-end">
          {actions}
        </Group>
      )}
    </Group>
  )
}
