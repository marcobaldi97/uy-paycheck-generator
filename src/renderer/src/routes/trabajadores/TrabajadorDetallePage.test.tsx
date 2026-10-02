import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, describe, expect, it } from 'vitest'
import { paths } from '../../paths'
import {
  condicionDePrueba,
  instalarApiFalsa,
  quitarApiFalsa,
  renderTrabajadores,
  trabajadorDePrueba,
} from './testing'

afterEach(quitarApiFalsa)

const futuro = dayjs().add(1, 'year').format('YYYY-MM-DD')

function conCondiciones() {
  return instalarApiFalsa(
    [trabajadorDePrueba(1, { nombre: 'ANA' }), trabajadorDePrueba(2, { numero: 5, nombre: 'BEATRIZ' })],
    [
      condicionDePrueba(11, 1, { vigenteDesde: '2025-01-01', sueldoNominal: 3_000_000 }),
      condicionDePrueba(12, 1, { vigenteDesde: '2025-07-01', sueldoNominal: 3_250_050, fonasaTasaManual: '0.045' }),
      condicionDePrueba(13, 1, { vigenteDesde: futuro, sueldoNominal: 4_000_000 }),
    ],
  )
}

const dialogo = () => screen.findByRole('dialog', { name: 'Nueva condición' })

describe('TrabajadorDetallePage', () => {
  it('shows the identity form and the conditions history, newest first', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador(1))

    expect(await screen.findByRole('heading', { name: '1 · ANA' })).toBeInTheDocument()
    expect(api.obtener).toHaveBeenCalledWith({ id: 1 })
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('ANA')
    expect(screen.getByLabelText(/Fecha de ingreso/)).toHaveValue('2020-01-15')

    const filas = screen.getAllByTestId('condicion-fila')
    expect(filas).toHaveLength(3)
    expect(filas[0]).toHaveTextContent('40.000,00')
    expect(filas[0]).toHaveTextContent('Futura')
    expect(filas[1]).toHaveTextContent('01/07/2025')
    expect(filas[1]).toHaveTextContent('32.500,50')
    expect(filas[1]).toHaveTextContent('4,5%')
    expect(filas[1]).toHaveTextContent('Vigente')
    expect(filas[2]).not.toHaveTextContent('Vigente')
  })

  it('saves identity changes', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador(1))

    const guardar = await screen.findByRole('button', { name: 'Guardar' })
    expect(guardar).toBeDisabled()
    const cargo = screen.getByLabelText('Cargo')
    await userEvent.clear(cargo)
    await userEvent.type(cargo, 'Gerente')
    await userEvent.click(screen.getByLabelText('Activo'))
    await userEvent.click(guardar)

    await waitFor(() => expect(api.actualizar).toHaveBeenCalledTimes(1))
    expect(api.actualizar).toHaveBeenCalledWith({
      id: 1,
      datos: expect.objectContaining({ numero: 1, nombre: 'ANA', cargo: 'Gerente', activo: false }),
    })
    await waitFor(() => expect(guardar).toBeDisabled())
  })

  it('shows a duplicate worker number on the Nº field', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador(1))

    const numero = await screen.findByLabelText(/Nº/)
    await userEvent.clear(numero)
    await userEvent.type(numero, '5')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Ya existe un trabajador con el número 5.')).toBeInTheDocument()
    expect(api.actualizar).toHaveBeenCalledTimes(1)
  })

  it('validates required identity fields before calling the API', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador(1))

    await userEvent.clear(await screen.findByLabelText(/Nombre/))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Requerido')).toBeInTheDocument()
    expect(api.actualizar).not.toHaveBeenCalled()
  })

  it('adds a new condition prefilled from the newest one and requires a start date', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador(1))

    await userEvent.click(await screen.findByRole('button', { name: 'Nueva condición' }))
    const modal = within(await dialogo())
    expect(modal.getByLabelText(/Vigente desde/)).toHaveValue('')
    expect(modal.getByLabelText(/Sueldo nominal/)).toHaveValue('40.000,00')
    expect(modal.getByLabelText('Hijos a cargo')).toBeChecked()

    await userEvent.click(modal.getByRole('button', { name: 'Guardar condición' }))
    expect(await modal.findByText('Fecha inválida')).toBeInTheDocument()
    expect(api.nuevaCondicion).not.toHaveBeenCalled()

    fireEvent.change(modal.getByLabelText(/Vigente desde/), { target: { value: '2026-03-01' } })
    const sueldo = modal.getByLabelText(/Sueldo nominal/)
    await userEvent.clear(sueldo)
    await userEvent.type(sueldo, '35.000,00')
    await userEvent.type(modal.getByLabelText(/Tasa FONASA manual/), '6,375')
    await userEvent.click(modal.getByRole('radio', { name: '50%' }))
    await userEvent.click(modal.getByRole('button', { name: 'Guardar condición' }))

    await waitFor(() => expect(api.nuevaCondicion).toHaveBeenCalledTimes(1))
    expect(api.nuevaCondicion).toHaveBeenCalledWith({
      trabajadorId: 1,
      condicion: {
        vigenteDesde: '2026-03-01',
        sueldoNominal: 3_500_000,
        fonasaConyuge: false,
        fonasaHijos: true,
        fonasaTasaManual: '0.06375',
        irpfHijos: 1,
        irpfHijosDiscapacidad: 0,
        irpfPctAtribucion: 50,
        irpfOtrasDeducciones: 0,
      },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByTestId('condicion-fila')).toHaveLength(4))
    expect(screen.getAllByTestId('condicion-fila')[1]).toHaveTextContent('01/03/2026')
  })

  it('shows the conflict message when the start date already exists', async () => {
    conCondiciones()
    renderTrabajadores(paths.trabajador(1))

    await userEvent.click(await screen.findByRole('button', { name: 'Nueva condición' }))
    const modal = within(await dialogo())
    fireEvent.change(modal.getByLabelText(/Vigente desde/), { target: { value: '2025-07-01' } })
    await userEvent.click(modal.getByRole('button', { name: 'Guardar condición' }))

    expect(await modal.findByText('Ya existe una condición vigente desde esa fecha.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('creates a worker, then moves to its detail to add the first condition', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador('nuevo'))

    const numero = await screen.findByLabelText(/Nº/)
    expect(numero).toHaveValue('6')
    await userEvent.type(screen.getByLabelText(/Nombre/), 'CARLOS')
    await userEvent.type(screen.getByLabelText(/C\.I\./), '2.222.222-2')
    fireEvent.change(screen.getByLabelText(/Fecha de ingreso/), { target: { value: '2026-09-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Crear trabajador' }))

    expect(await screen.findByRole('heading', { name: '6 · CARLOS' })).toBeInTheDocument()
    expect(api.crear).toHaveBeenCalledWith(
      expect.objectContaining({ numero: 6, nombre: 'CARLOS', ci: '2.222.222-2', fechaIngreso: '2026-09-01', activo: true }),
    )
    expect(screen.getByText(/Sin condiciones registradas/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Nueva condición' }))
    const modal = within(await dialogo())
    expect(modal.getByLabelText(/Sueldo nominal/)).toHaveValue('')
    await userEvent.click(modal.getByRole('button', { name: 'Guardar condición' }))
    expect(await modal.findByText('Requerido')).toBeInTheDocument()
  })

  it('suggests cargos of existing workers, active or not, when creating one', async () => {
    const { api } = instalarApiFalsa([
      trabajadorDePrueba(1, { cargo: 'Administrativo' }),
      trabajadorDePrueba(2, { cargo: 'Gerente de ventas', activo: false }),
      trabajadorDePrueba(3, { cargo: '' }),
    ])
    renderTrabajadores(paths.trabajador('nuevo'))

    const cargo = await screen.findByLabelText('Cargo')
    await userEvent.click(cargo)
    expect(await screen.findByRole('option', { name: 'Administrativo' })).toBeInTheDocument()
    await userEvent.type(cargo, 'ger')
    expect(screen.queryByRole('option', { name: 'Administrativo' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('option', { name: 'Gerente de ventas' }))
    expect(cargo).toHaveValue('Gerente de ventas')

    await userEvent.type(screen.getByLabelText(/Nombre/), 'CARLOS')
    await userEvent.type(screen.getByLabelText(/C\.I\./), '2.222.222-2')
    fireEvent.change(screen.getByLabelText(/Fecha de ingreso/), { target: { value: '2026-09-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Crear trabajador' }))

    await waitFor(() => expect(api.crear).toHaveBeenCalledTimes(1))
    expect(api.crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'CARLOS', cargo: 'Gerente de ventas' }))
  })

  it('shows not found for unknown or malformed ids', async () => {
    const { api } = conCondiciones()
    renderTrabajadores(paths.trabajador(99))
    expect(await screen.findByText('Trabajador no encontrado')).toBeInTheDocument()
    expect(api.obtener).toHaveBeenCalledWith({ id: 99 })
  })

  it('does not call the API for a malformed id', async () => {
    const { api } = conCondiciones()
    renderTrabajadores('/trabajadores/abc')
    expect(await screen.findByText('Trabajador no encontrado')).toBeInTheDocument()
    expect(api.obtener).not.toHaveBeenCalled()
  })
})
