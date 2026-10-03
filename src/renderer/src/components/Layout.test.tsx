import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { Layout } from './Layout'

const renderLayout = () =>
  renderWithProviders(
    [{ path: '/', element: <Layout />, children: [{ path: 'trabajadores', element: <p>contenido</p> }] }],
    '/trabajadores',
  )

afterEach(() => localStorage.clear())

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

  it('collapses the sidebar to icons and remembers it', async () => {
    const user = userEvent.setup()
    const { unmount } = renderLayout()

    await user.click(screen.getByRole('button', { name: 'Colapsar menú' }))

    expect(screen.queryByText('Liquidaciones')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Liquidaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false')

    unmount()
    renderLayout()
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expandir menú' }))
    expect(screen.getByText('Liquidaciones')).toBeInTheDocument()
  })
})
