import type { RespaldoInfo, ResultadoRespaldo } from '@shared/types'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { err, instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { renderUi } from '../../test/render'
import { RespaldoPage } from './index'

const ubicacionDb = 'C:\\Users\\x\\AppData\\Roaming\\recibos\\recibos.db'

/** `info` answers each of `infos` in turn, then keeps answering the last one. */
function mockApi(infos: RespaldoInfo[], crear: Mock) {
  const info = vi.fn()
  for (const i of infos) info.mockResolvedValueOnce(ok(i))
  info.mockResolvedValue(ok(infos[infos.length - 1]))
  return instalarApi({ respaldo: { info, crear } }).respaldo
}

const resultado = (data: ResultadoRespaldo) => vi.fn().mockResolvedValue(ok(data))

afterEach(quitarApi)

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
    const crear = vi.fn().mockResolvedValue(err('NO_ENCONTRADO', 'La carpeta elegida no existe'))
    mockApi([{ ultimoRespaldo: null, ubicacionDb }], crear)
    renderUi(<RespaldoPage />)

    await user.click(await screen.findByRole('button', { name: 'Crear respaldo' }))
    expect(await screen.findByText('La carpeta elegida no existe')).toBeInTheDocument()
  })
})
