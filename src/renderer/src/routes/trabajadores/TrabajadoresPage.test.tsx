import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { instalarApiFalsa, quitarApiFalsa, renderTrabajadores, trabajadorDePrueba } from './testing'

afterEach(quitarApiFalsa)

describe('TrabajadoresPage', () => {
  it('lists active workers by number and shows inactive ones when the filter is off', async () => {
    const { api } = instalarApiFalsa([
      trabajadorDePrueba(2, { numero: 20, nombre: 'BEATRIZ' }),
      trabajadorDePrueba(1, { numero: 10, nombre: 'ANA' }),
      trabajadorDePrueba(3, { numero: 30, nombre: 'CARLOS', activo: false }),
    ])
    renderTrabajadores()

    await screen.findByText('ANA')
    expect(api.listar).toHaveBeenCalledWith({ soloActivos: true })
    let filas = screen.getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('cell')[1]?.textContent)).toEqual(['ANA', 'BEATRIZ'])
    expect(screen.queryByText('CARLOS')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Solo activos' }))
    await screen.findByText('CARLOS')
    expect(api.listar).toHaveBeenLastCalledWith({ soloActivos: false })
    filas = screen.getAllByRole('row').slice(1)
    expect(filas).toHaveLength(3)
    expect(within(filas[2]!).getByText('Inactivo')).toBeInTheDocument()
  })

  it('opens the detail when a row is clicked', async () => {
    instalarApiFalsa([trabajadorDePrueba(7, { nombre: 'ANA' })])
    renderTrabajadores()

    await userEvent.click(await screen.findByText('Administrativo'))
    expect(await screen.findByRole('heading', { name: '7 · ANA' })).toBeInTheDocument()
  })

  it('links to the create form', async () => {
    instalarApiFalsa()
    renderTrabajadores()

    expect(await screen.findByText('No hay trabajadores activos.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Nuevo trabajador' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo trabajador' })).toBeInTheDocument()
  })

  it('shows API errors', async () => {
    const { api } = instalarApiFalsa()
    api.listar.mockResolvedValueOnce({ ok: false, error: { code: 'INTERNO', message: 'Falló la base.' } } as never)
    renderTrabajadores()

    expect(await screen.findByText('Falló la base.')).toBeInTheDocument()
  })
})
