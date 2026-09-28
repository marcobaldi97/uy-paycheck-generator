import type { Api } from '@shared/api'
import type { RespaldoInfo, ResultadoRespaldo } from '@shared/types'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderUi } from '../../test/render'
import { RespaldoPage } from './index'

const ubicacionDb = 'C:\\Users\\x\\AppData\\Roaming\\recibos\\recibos.db'

function mockApi(infos: RespaldoInfo[], crear: ReturnType<typeof vi.fn>) {
  const info = vi.fn()
  for (const i of infos) info.mockResolvedValueOnce({ ok: true, data: i })
  info.mockResolvedValue({ ok: true, data: infos[infos.length - 1] })
  window.api = { respaldo: { info, crear } } as unknown as Api
  return { info }
}

const resultado = (data: ResultadoRespaldo) => vi.fn().mockResolvedValue({ ok: true, data })

afterEach(() => {
  delete (window as { api?: Api }).api
})

describe('RespaldoPage', () => {
  it('shows "Nunca" and the DB location before the first backup', async () => {
    mockApi([{ ultimoRespaldo: null, ubicacionDb }], resultado({ cancelado: true, archivo: null }))
    renderUi(<RespaldoPage />)

    expect(await screen.findByTestId('ultimo-respaldo')).toHaveTextContent('Nunca')
    expect(screen.getByText(ubicacionDb)).toBeInTheDocument()
  })

  it('creates a backup, shows the file and refreshes the last backup date in local time', async () => {
    const user = userEvent.setup()
    const iso = '2026-09-28T14:05:00.000Z'
    const archivo = 'D:\\Respaldos\\recibos-2026-09-28-110500.db'
    const crear = resultado({ cancelado: false, archivo })
    const { info } = mockApi(
      [
        { ultimoRespaldo: null, ubicacionDb },
        { ultimoRespaldo: iso, ubicacionDb },
      ],
      crear,
    )
    renderUi(<RespaldoPage />)

    await screen.findByText('Nunca')
    await user.click(screen.getByRole('button', { name: 'Crear respaldo' }))

    expect(await screen.findByText(archivo)).toBeInTheDocument()
    expect(screen.getByText('Respaldo creado')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('ultimo-respaldo')).toHaveTextContent(dayjs(iso).format('DD/MM/YYYY HH:mm')),
    )
    expect(crear).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledTimes(2)
  })

  it('shows nothing when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    const crear = resultado({ cancelado: true, archivo: null })
    mockApi([{ ultimoRespaldo: null, ubicacionDb }], crear)
    renderUi(<RespaldoPage />)

    await user.click(await screen.findByRole('button', { name: 'Crear respaldo' }))
    await waitFor(() => expect(crear).toHaveBeenCalled())
    expect(screen.queryByText('Respaldo creado')).not.toBeInTheDocument()
    expect(screen.queryByText('No se pudo crear el respaldo')).not.toBeInTheDocument()
  })

  it('shows the error message from main', async () => {
    const user = userEvent.setup()
    const crear = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'NO_ENCONTRADO', message: 'La carpeta elegida no existe' },
    })
    mockApi([{ ultimoRespaldo: null, ubicacionDb }], crear)
    renderUi(<RespaldoPage />)

    await user.click(await screen.findByRole('button', { name: 'Crear respaldo' }))
    expect(await screen.findByText('La carpeta elegida no existe')).toBeInTheDocument()
  })
})
