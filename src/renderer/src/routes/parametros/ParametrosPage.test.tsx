import type { Api, ApiResult } from '@shared/api'
import type { ParametrosVersion } from '@shared/types'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderUi } from '../../test/render'
import { version2026 } from './fixture'
import { ParametrosPage } from './index'

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data })

/** In-memory parametros backend that behaves like main (newest first, copy on nuevaVersion). */
function mockApi(initial: ParametrosVersion[] = [version2026]) {
  let versions = structuredClone(initial)
  const listar = vi.fn(async () => ok(structuredClone(versions)))
  const nuevaVersion = vi.fn(async ({ vigenteDesde }: { vigenteDesde: string }) => {
    if (versions.some((v) => v.vigenteDesde === vigenteDesde)) {
      return { ok: false, error: { code: 'CONFLICTO', message: 'Ya existe una versión con esa fecha' } }
    }
    const copy = { ...structuredClone(versions[0]!), vigenteDesde }
    versions = [copy, ...versions].sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde))
    return ok(copy)
  })
  const actualizar = vi.fn(async (version: ParametrosVersion): Promise<ApiResult<ParametrosVersion>> => {
    versions = versions.map((v) => (v.vigenteDesde === version.vigenteDesde ? version : v))
    return ok(version)
  })
  window.api = { parametros: { listar, nuevaVersion, actualizar } } as unknown as Api
  return { listar, nuevaVersion, actualizar }
}

afterEach(() => {
  delete (window as { api?: Api }).api
})

const franjasTable = () => screen.getByRole('table', { name: 'Franjas de IRPF' })

describe('ParametrosPage', () => {
  it('opens the latest version with its values and brackets', async () => {
    mockApi()
    renderUi(<ParametrosPage />)

    expect(await screen.findByRole('heading', { name: 'Vigente desde 01/01/2026' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Valor BPC/)).toHaveValue('6.864,00')
    expect(screen.getByLabelText('Montepío')).toHaveValue('15')
    expect(screen.getByLabelText('FRL')).toHaveValue('0,125')
    expect(screen.getByLabelText('Umbral de franja')).toHaveValue('2,5')
    expect(within(franjasTable()).getAllByRole('row')).toHaveLength(9) // header + 8
    expect(screen.getByLabelText('Hasta franja 8')).toHaveValue('')
    expect(screen.getByLabelText('Tasa franja 8')).toHaveValue('36')
  })

  it('edits scalars and brackets and saves the version through actualizar', async () => {
    const user = userEvent.setup()
    const { actualizar } = mockApi()
    renderUi(<ParametrosPage />)

    const bpc = await screen.findByLabelText(/Valor BPC/)
    await user.clear(bpc)
    await user.type(bpc, '7.000,00')
    const fonasa = screen.getByLabelText('Sobre el umbral, sin cargas')
    await user.clear(fonasa)
    await user.type(fonasa, '4,75')

    // Changing a bracket's upper bound moves the next one's lower bound.
    const hasta1 = screen.getByLabelText('Hasta franja 1')
    await user.clear(hasta1)
    await user.type(hasta1, '7,5')
    expect(screen.getByLabelText('Desde franja 2')).toHaveValue('7,5')

    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1))
    const expected = structuredClone(version2026)
    expected.bpc = 700000
    expected.fonasaAltoSinCargas = '0.0475'
    expected.franjas[0]!.hastaBpc = '7.5'
    expected.franjas[1]!.desdeBpc = '7.5'
    expect(actualizar).toHaveBeenCalledWith(expected)
  })

  it('adds and removes brackets', async () => {
    const user = userEvent.setup()
    const { actualizar } = mockApi()
    renderUi(<ParametrosPage />)

    await screen.findByLabelText('Tasa franja 8')
    await user.click(screen.getByRole('button', { name: 'Eliminar franja 8' }))
    await user.clear(screen.getByLabelText('Hasta franja 7'))
    await user.click(screen.getByRole('button', { name: 'Agregar franja' }))
    expect(screen.getByLabelText('Desde franja 8')).toHaveValue('')
    await user.type(screen.getByLabelText('Desde franja 8'), '115')
    await user.type(screen.getByLabelText('Hasta franja 7'), '115')
    await user.type(screen.getByLabelText('Tasa franja 8'), '40')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1))
    const sent = actualizar.mock.calls[0]![0]
    expect(sent.franjas).toHaveLength(8)
    expect(sent.franjas[7]).toEqual({ desdeBpc: '115', hastaBpc: null, tasa: '0.4' })
  })

  it('blocks invalid values before calling the API', async () => {
    const user = userEvent.setup()
    const { actualizar } = mockApi()
    renderUi(<ParametrosPage />)

    const montepio = await screen.findByLabelText('Montepío')
    await user.clear(montepio)
    await user.type(montepio, 'quince')
    await user.clear(screen.getByLabelText('Tasa franja 3'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findAllByText('Porcentaje inválido (0 a 100)')).toHaveLength(2)
    expect(actualizar).not.toHaveBeenCalled()
  })

  it('shows the franjas validation error from main next to the brackets table', async () => {
    const user = userEvent.setup()
    const { actualizar } = mockApi()
    actualizar.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'VALIDACION',
        message: 'Las franjas deben ser contiguas (franja 1 termina en 6)',
        details: { campo: 'franjas' },
      },
    })
    renderUi(<ParametrosPage />)

    await user.click(await screen.findByRole('button', { name: 'Guardar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Las franjas deben ser contiguas (franja 1 termina en 6)')
    // Rendered right after the table, inside the brackets section.
    expect(franjasTable().closest('.mantine-Paper-root')).toContainElement(alert)
    expect(screen.queryByText('No se pudo guardar')).not.toBeInTheDocument()
  })

  it('creates a new version prefilled from the latest and opens it for editing', async () => {
    const user = userEvent.setup()
    const { nuevaVersion, actualizar } = mockApi()
    renderUi(<ParametrosPage />)

    await screen.findByRole('heading', { name: 'Vigente desde 01/01/2026' })
    await user.click(screen.getByRole('button', { name: 'Nueva versión' }))
    const dialog = await screen.findByRole('dialog')

    // Existing date is rejected before calling main.
    await user.type(within(dialog).getByLabelText(/Vigente desde/), '01/01/2026')
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }))
    expect(await within(dialog).findByText('Ya existe una versión con esa fecha')).toBeInTheDocument()
    expect(nuevaVersion).not.toHaveBeenCalled()

    const input = within(dialog).getByLabelText(/Vigente desde/)
    await user.clear(input)
    await user.type(input, '01/07/2026')
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }))

    await waitFor(() => expect(nuevaVersion).toHaveBeenCalledWith({ vigenteDesde: '2026-07-01' }))
    expect(await screen.findByRole('heading', { name: 'Vigente desde 01/07/2026' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText(/Valor BPC/)).toHaveValue('6.864,00')
    expect(screen.getByRole('button', { name: /01\/07\/2026/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /01\/01\/2026/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith({ ...version2026, vigenteDesde: '2026-07-01' }))
  })

  it('shows CONFLICTO from main in the dialog', async () => {
    const user = userEvent.setup()
    const { nuevaVersion } = mockApi()
    nuevaVersion.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONFLICTO', message: 'Ya existe una versión de parámetros con esa fecha' },
    })
    renderUi(<ParametrosPage />)

    await user.click(await screen.findByRole('button', { name: 'Nueva versión' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Vigente desde/), '01/03/2026')
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }))

    expect(await within(dialog).findByText('Ya existe una versión de parámetros con esa fecha')).toBeInTheDocument()
  })

  it('lets the user pick an older version', async () => {
    const user = userEvent.setup()
    const v2025 = { ...version2026, vigenteDesde: '2025-01-01', bpc: 624400 }
    mockApi([version2026, v2025])
    renderUi(<ParametrosPage />)

    await user.click(await screen.findByRole('button', { name: /01\/01\/2025/ }))
    expect(await screen.findByRole('heading', { name: 'Vigente desde 01/01/2025' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Valor BPC/)).toHaveValue('6.244,00')
  })
})
