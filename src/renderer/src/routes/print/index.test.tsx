import { screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '@shared/api'
import type { ReciboImpresion } from '@shared/types'
import { recibosDePrueba } from '../../components/Recibo.fixture'
import { paths } from '../../paths'
import { renderWithProviders } from '../../test/render'
import type { FuenteImpresion } from './fuente'
import { PrintPage } from './index'
import classes from './PrintPage.module.css'

function fuenteCon(result: ApiResult<ReciboImpresion[]>) {
  return {
    datosImpresion: vi.fn<FuenteImpresion['datosImpresion']>().mockResolvedValue(result),
    listo: vi.fn<FuenteImpresion['listo']>().mockResolvedValue({ ok: true, data: null }),
  } satisfies FuenteImpresion
}

function renderPrint(fuente: FuenteImpresion, path: string, strict = false) {
  const page = <PrintPage fuente={fuente} />
  return renderWithProviders(
    [{ path: '/print/:liquidacionId/:reciboId?', element: strict ? <StrictMode>{page}</StrictMode> : page }],
    path,
  )
}

describe('PrintPage', () => {
  it('renders one sheet per receipt, each with original and copy, then signals ready once', async () => {
    const fuente = fuenteCon({ ok: true, data: recibosDePrueba(3) })
    renderPrint(fuente, paths.print(7), true)

    const hojas = await screen.findAllByTestId('recibo-hoja')
    expect(hojas).toHaveLength(3)
    expect(hojas.map((h) => h.getAttribute('data-recibo-id'))).toEqual(['1', '2', '3'])
    for (const hoja of hojas) {
      expect(hoja.querySelectorAll('[data-ejemplar]')).toHaveLength(2)
    }
    expect(hojas[2]).toHaveTextContent('Nombre: TRABAJADOR 3')

    expect(fuente.datosImpresion).toHaveBeenCalledWith({ liquidacionId: 7, reciboId: null })
    await waitFor(() => expect(fuente.listo).toHaveBeenCalledTimes(1))
    // Give any stray second signal a chance to happen.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fuente.listo).toHaveBeenCalledTimes(1)
  })

  it('page-breaks after every sheet except the last', async () => {
    const fuente = fuenteCon({ ok: true, data: recibosDePrueba(2) })
    renderPrint(fuente, paths.print(7))

    const hojas = await screen.findAllByTestId('recibo-hoja')
    // `.hoja { break-after: page }`, reset on `:last-child`.
    for (const hoja of hojas) expect(hoja).toHaveClass(classes.hoja!)
    expect(hojas[0]!.parentElement).toBe(hojas[1]!.parentElement)
    expect(hojas[1]!.nextElementSibling).toBeNull()
  })

  it('asks for a single receipt when reciboId is in the route', async () => {
    const fuente = fuenteCon({ ok: true, data: recibosDePrueba(1) })
    renderPrint(fuente, paths.print(7, 12))

    expect(await screen.findAllByTestId('recibo-hoja')).toHaveLength(1)
    expect(fuente.datosImpresion).toHaveBeenCalledWith({ liquidacionId: 7, reciboId: 12 })
    await waitFor(() => expect(fuente.listo).toHaveBeenCalledTimes(1))
  })

  it('shows the error and does not signal ready when loading fails', async () => {
    const fuente = fuenteCon({ ok: false, error: { code: 'NO_ENCONTRADO', message: 'Liquidación no encontrada' } })
    renderPrint(fuente, paths.print(99))

    expect(await screen.findByRole('alert')).toHaveTextContent('Liquidación no encontrada')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fuente.listo).not.toHaveBeenCalled()
  })

  it('rejects an invalid id without calling the API', () => {
    const fuente = fuenteCon({ ok: true, data: [] })
    renderPrint(fuente, '/print/abc')

    expect(screen.getByText('Ruta de impresión inválida.')).toBeInTheDocument()
    expect(fuente.datosImpresion).not.toHaveBeenCalled()
  })

  it('signals ready for a liquidación without receipts', async () => {
    const fuente = fuenteCon({ ok: true, data: [] })
    renderPrint(fuente, paths.print(7))

    expect(await screen.findByText('La liquidación no tiene recibos.')).toBeInTheDocument()
    await waitFor(() => expect(fuente.listo).toHaveBeenCalledTimes(1))
  })
})
