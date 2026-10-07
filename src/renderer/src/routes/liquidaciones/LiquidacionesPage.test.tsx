import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paths } from '../../paths'
import { renderWithProviders } from '../../test/render'
import { LiquidacionesPage } from './index'
import { err, instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { resumenes } from './testApi'

function renderLista() {
  return renderWithProviders(
    [
      { path: '/liquidaciones', element: <LiquidacionesPage /> },
      { path: '/liquidaciones/:liquidacionId', element: <p>detalle abierto</p> },
      { path: '/trabajadores/:trabajadorId', element: <p>trabajador abierto</p> },
    ],
    paths.liquidaciones(),
  )
}

afterEach(quitarApi)

describe('LiquidacionesPage', () => {
  it('lists periods with estado, receipt count and total líquido', async () => {
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(ok(resumenes)) } })
    renderLista()

    const filas = await screen.findAllByTestId('liquidacion-fila')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent('Agosto 2024')
    expect(filas[0]).toHaveTextContent('05/09/2024')
    expect(filas[0]).toHaveTextContent('Borrador')
    expect(filas[0]).toHaveTextContent('54.321,10')
    expect(filas[1]).toHaveTextContent('Julio 2024')
    expect(filas[1]).toHaveTextContent('Emitida')
    expect(within(filas[1]!).getByText('1')).toBeInTheDocument()

    await userEvent.click(within(filas[0]!).getByRole('link', { name: 'Agosto 2024' }))
    expect(await screen.findByText('detalle abierto')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(ok([])) } })
    renderLista()
    expect(await screen.findByText(/Todavía no hay liquidaciones/)).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(err('INTERNO', 'Falló la base')) } })
    renderLista()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la base')
  })

  it('creates the next period with default dates and opens it', async () => {
    const crear = vi.fn().mockResolvedValue(
      ok({ id: 3, periodo: '2024-09', fechaCargo: '2024-09-30', fechaPago: '2024-09-30', estado: 'borrador' }),
    )
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(ok(resumenes)), crear } })
    renderLista()

    await userEvent.click(await screen.findByRole('button', { name: 'Nueva liquidación' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))

    expect(crear).toHaveBeenCalledWith({ periodo: '2024-09', fechaCargo: '2024-09-30', fechaPago: '2024-09-30' })
    expect(await screen.findByText('detalle abierto')).toBeInTheDocument()
  })

  it('shows the blocked-creation message naming the workers without conditions', async () => {
    const crear = vi.fn().mockResolvedValue(
      err(
        'TRABAJADOR_SIN_CONDICIONES',
        'Sin condiciones vigentes al 30/09/2024: ANA PÉREZ, JUAN GÓMEZ',
        {
          trabajadores: [
            { id: 1, nombre: 'ANA PÉREZ' },
            { id: 2, nombre: 'JUAN GÓMEZ' },
          ],
          periodo: '2024-09',
        },
      ),
    )
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(ok(resumenes)), crear } })
    renderLista()

    await userEvent.click(await screen.findByRole('button', { name: 'Nueva liquidación' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))

    const alerta = await within(dialog).findByRole('alert')
    expect(alerta).toHaveTextContent('No se puede crear la liquidación de Septiembre 2024')
    expect(alerta).toHaveTextContent('Sin condiciones vigentes al 30/09/2024: ANA PÉREZ, JUAN GÓMEZ')
    const link = within(alerta).getByRole('link', { name: 'Agregar condiciones a JUAN GÓMEZ' })
    expect(link).toHaveAttribute('href', paths.trabajador(2))
    // Still on the list: nothing was created.
    expect(screen.queryByText('detalle abierto')).not.toBeInTheDocument()
  })

  it('shows the blocked-creation message when no parameters apply', async () => {
    const crear = vi
      .fn()
      .mockResolvedValue(
        err('SIN_PARAMETROS', 'No hay parámetros vigentes al 30/09/2024', { periodo: '2024-09', fecha: '2024-09-30' }),
      )
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(ok(resumenes)), crear } })
    renderLista()

    await userEvent.click(await screen.findByRole('button', { name: 'Nueva liquidación' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))

    const alerta = await within(dialog).findByRole('alert')
    expect(alerta).toHaveTextContent('No hay parámetros vigentes al 30/09/2024')
    expect(within(alerta).getByRole('link', { name: 'Ir a Parámetros' })).toHaveAttribute('href', paths.parametros())
  })

  it('shows LIQUIDACION_EXISTENTE and keeps the modal open', async () => {
    const crear = vi.fn().mockResolvedValue(err('LIQUIDACION_EXISTENTE', 'Ya existe una liquidación para 09/2024'))
    instalarApi({ liquidaciones: { listar: vi.fn().mockResolvedValue(ok(resumenes)), crear } })
    renderLista()

    await userEvent.click(await screen.findByRole('button', { name: 'Nueva liquidación' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Crear' }))

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Ya existe una liquidación'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
