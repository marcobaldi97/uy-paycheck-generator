import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { err, instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { renderTrabajadores, trabajadorDePrueba } from './testing'

afterEach(quitarApi)

describe('TrabajadoresPage', () => {
  it('lists active workers in API order and shows inactive ones when the filter is off', async () => {
    const ana = trabajadorDePrueba(1, { numero: 10, nombre: 'ANA' })
    const beatriz = trabajadorDePrueba(2, { numero: 20, nombre: 'BEATRIZ' })
    const carlos = trabajadorDePrueba(3, { numero: 30, nombre: 'CARLOS', activo: false })
    const { trabajadores: api } = instalarApi({
      trabajadores: {
        listar: vi.fn().mockResolvedValue(ok([ana, beatriz, carlos])).mockResolvedValueOnce(ok([ana, beatriz])),
      },
    })
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
    const ana = trabajadorDePrueba(7, { nombre: 'ANA' })
    instalarApi({
      trabajadores: {
        listar: vi.fn().mockResolvedValue(ok([ana])),
        obtener: vi.fn().mockResolvedValue(ok({ trabajador: ana, condiciones: [] })),
      },
    })
    renderTrabajadores()

    await userEvent.click(await screen.findByText('Administrativo'))
    expect(await screen.findByRole('heading', { name: '7 · ANA' })).toBeInTheDocument()
  })

  it('links to the create form', async () => {
    instalarApi({ trabajadores: { listar: vi.fn().mockResolvedValue(ok([])) } })
    renderTrabajadores()

    expect(await screen.findByText('No hay trabajadores activos.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Nuevo trabajador' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo trabajador' })).toBeInTheDocument()
  })

  it('shows API errors', async () => {
    instalarApi({ trabajadores: { listar: vi.fn().mockResolvedValue(err('INTERNO', 'Falló la base.')) } })
    renderTrabajadores()

    expect(await screen.findByText('Falló la base.')).toBeInTheDocument()
  })
})
