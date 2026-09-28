import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { Layout } from './Layout'

describe('Layout', () => {
  it('shows every section in the sidebar and marks the current one', () => {
    renderWithProviders(
      [{ path: '/', element: <Layout />, children: [{ path: 'trabajadores', element: <p>contenido</p> }] }],
      '/trabajadores',
    )

    for (const label of ['Liquidaciones', 'Trabajadores', 'Parámetros', 'Empresa', 'Respaldo']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Trabajadores' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })
})
