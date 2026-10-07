import { Button } from '@mantine/core'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EstadoBadge } from '../routes/liquidaciones/EstadoBadge'
import { renderUi } from '../test/render'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('keeps the badge at its natural width next to a long title', () => {
    renderUi(
      <PageHeader
        title="Liquidación Octubre 2026"
        badge={<EstadoBadge estado="borrador" />}
        actions={<Button>Emitir</Button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Liquidación Octubre 2026' })).toBeInTheDocument()
    const badge = screen.getByText('Borrador').closest('.mantine-Badge-root')
    expect(badge?.parentElement).toHaveStyle({ flexShrink: '0' })
  })
})
