import type { Api } from '@shared/api'
import type { Empresa } from '@shared/types'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderUi } from '../../test/render'
import { EmpresaPage } from './index'

const empresa: Empresa = {
  nombre: 'Carmona SRL',
  direccion: 'Av. Italia 1234',
  rut: '211234560018',
  nroMtss: '123456',
  afiliacionBps: '',
  carpetaBse: '',
  grupo: '10',
  subgrupo: '01',
}

function mockApi(obtener: Empresa | null, guardar = vi.fn(async (e: Empresa) => ({ ok: true, data: e }))) {
  window.api = {
    empresa: { obtener: vi.fn().mockResolvedValue({ ok: true, data: obtener }), guardar },
  } as unknown as Api
  return { guardar }
}

afterEach(() => {
  delete (window as { api?: Api }).api
})

describe('EmpresaPage', () => {
  it('starts empty on a fresh DB and validates required fields', async () => {
    const user = userEvent.setup()
    const { guardar } = mockApi(null)
    renderUi(<EmpresaPage />)

    const nombre = await screen.findByLabelText(/Nombre/)
    expect(nombre).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findAllByText('Requerido')).toHaveLength(2)
    expect(guardar).not.toHaveBeenCalled()

    await user.type(nombre, 'Carmona SRL')
    await user.type(screen.getByLabelText(/RUT/), '211234560018')
    await user.type(screen.getByLabelText('Grupo'), '10')
    await user.type(screen.getByLabelText('Afiliación BPS'), '1234567')
    await user.type(screen.getByLabelText('Carpeta BSE'), '98765')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))
    expect(guardar).toHaveBeenCalledWith({
      nombre: 'Carmona SRL',
      direccion: '',
      rut: '211234560018',
      nroMtss: '',
      afiliacionBps: '1234567',
      carpetaBse: '98765',
      grupo: '10',
      subgrupo: '',
    })
  })

  it('loads the saved empresa and saves edits', async () => {
    const user = userEvent.setup()
    const { guardar } = mockApi(empresa)
    renderUi(<EmpresaPage />)

    const direccion = await screen.findByLabelText('Dirección')
    expect(direccion).toHaveValue('Av. Italia 1234')
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Carmona SRL')

    await user.clear(direccion)
    await user.type(direccion, 'Rivera 500')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ ...empresa, direccion: 'Rivera 500' }))
  })

  it('shows the API error when saving fails', async () => {
    const user = userEvent.setup()
    mockApi(
      empresa,
      vi.fn(async () => ({ ok: false, error: { code: 'INTERNO', message: 'Error inesperado' } })) as never,
    )
    renderUi(<EmpresaPage />)

    await user.click(await screen.findByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Error inesperado')).toBeInTheDocument()
    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument()
  })
})
