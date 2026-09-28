import type { Api, ApiResult } from '@shared/api'
import type { Linea, ReciboDetalle, ReciboEntradas } from '@shared/types'
import { configure, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reciboCarmona } from '../../components/Recibo.fixture'
import { paths } from '../../paths'
import { renderWithProviders } from '../../test/render'
import { ReciboEditorPage } from './index'

const ENTRADAS_VACIAS: ReciboEntradas = { diasNoTrabajados: 0, lineasManuales: [], overrides: null }

function detalle(overrides: Partial<ReciboDetalle> = {}): ReciboDetalle {
  const base: ReciboDetalle = {
    id: 5,
    liquidacionId: 3,
    trabajadorId: 1,
    estado: 'borrador',
    entradas: ENTRADAS_VACIAS,
    valoresCalculados: { montepioTasa: '0.15', fonasaTasa: '0.08', frlTasa: '0.00125', irpfImporte: 0 },
    lineas: reciboCarmona.lineas.map((l) => ({ ...l, override: false })),
    totales: reciboCarmona.totales,
    impresion: { ...reciboCarmona, reciboId: 5 },
  }
  return { ...base, ...overrides }
}

/** What main would answer: the given entradas, FONASA line marked when overridden, a new líquido. */
function respuesta(entradas: ReciboEntradas, liquido = 2_000_000, estado: ReciboDetalle['estado'] = 'borrador') {
  const base = detalle()
  const lineas: Linea[] = base.lineas.map((l) =>
    l.codigo === 'FONASA' && entradas.overrides?.fonasaTasa
      ? { ...l, cantidad: entradas.overrides.fonasaTasa, override: true }
      : l,
  )
  const totales = { ...base.totales, liquido }
  return detalle({ entradas, lineas, totales, estado, impresion: { ...base.impresion, lineas, totales } })
}

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data })

function setup(inicial: ReciboDetalle | ApiResult<ReciboDetalle> = detalle(), autosaveMs = 20) {
  const obtenerRecibo = vi.fn().mockResolvedValue('ok' in inicial ? inicial : ok(inicial))
  const actualizarRecibo = vi
    .fn()
    .mockImplementation(({ entradas }: { entradas: ReciboEntradas }) => Promise.resolve(ok(respuesta(entradas))))
  window.api = { liquidaciones: { obtenerRecibo, actualizarRecibo } } as unknown as Api
  const user = userEvent.setup()
  renderWithProviders(
    [
      { path: '/liquidaciones/:liquidacionId/recibos/:reciboId', element: <ReciboEditorPage autosaveMs={autosaveMs} /> },
      { path: '/liquidaciones/:liquidacionId', element: <p>Detalle de liquidación</p> },
    ],
    paths.recibo(3, 5),
  )
  return { obtenerRecibo, actualizarRecibo, user }
}

const guardadas = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map(([input]) => (input as { entradas: ReciboEntradas }).entradas)

// Autosave round trips are slower than the 1 s default on a cold, loaded test run.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  delete (window as { api?: Api }).api
})

describe('ReciboEditorPage', { timeout: 15_000 }, () => {
  it('loads the recibo, lists computed lines and shows the preview with original and copy', async () => {
    const { obtenerRecibo } = setup()

    expect(await screen.findByRole('heading', { name: 'CARMONA, Juan' })).toBeInTheDocument()
    expect(obtenerRecibo).toHaveBeenCalledWith({ id: 5 })
    expect(screen.getByText('Recibo del período 08/2024')).toBeInTheDocument()

    const fonasa = screen.getByTestId('linea-auto-FONASA')
    expect(fonasa).toHaveTextContent('8 %')
    expect(fonasa).toHaveTextContent('2.400,00')
    expect(fonasa).toHaveTextContent('Calculado: 8 %')
    // IRPF is 0 and omitted by main, but it still gets an override control.
    expect(screen.getByLabelText('Ajuste IRPF')).toBeInTheDocument()

    const hoja = within(screen.getByRole('region', { name: 'Vista previa del recibo' })).getByTestId('recibo-hoja')
    expect(hoja.querySelectorAll('[data-ejemplar]')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Volver a la liquidación/ })).toHaveAttribute('href', paths.liquidacion(3))
  })

  it('autosaves días no trabajados and shows the recomputed totals from main', async () => {
    const { actualizarRecibo, user } = setup()
    const dias = await screen.findByLabelText('Días no trabajados')

    await user.clear(dias)
    await user.type(dias, '2')

    await waitFor(() => expect(actualizarRecibo).toHaveBeenCalled())
    expect(actualizarRecibo).toHaveBeenLastCalledWith({ id: 5, entradas: { ...ENTRADAS_VACIAS, diasNoTrabajados: 2 } })
    await waitFor(() => expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Cambios guardados'))
    expect(screen.getByTestId('total-Líquido')).toHaveTextContent('20.000,00')
  })

  it('debounces bursts of edits into a single save of the latest value', async () => {
    const { actualizarRecibo, user } = setup(detalle(), 300)
    const input = await screen.findByLabelText('Ajuste FONASA')

    await user.type(input, '6,5')
    expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Cambios sin guardar')

    await waitFor(() => expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Cambios guardados'))
    expect(guardadas(actualizarRecibo)).toEqual([{ ...ENTRADAS_VACIAS, overrides: { fonasaTasa: '0.065' } }])
  })

  it('marks an overridden line and restaurar removes the override', async () => {
    const { actualizarRecibo, user } = setup()
    await user.type(await screen.findByLabelText('Ajuste FONASA'), '6')

    await waitFor(() => expect(actualizarRecibo).toHaveBeenCalledWith({ id: 5, entradas: { ...ENTRADAS_VACIAS, overrides: { fonasaTasa: '0.06' } } }))
    const fonasa = screen.getByTestId('linea-auto-FONASA')
    await waitFor(() => expect(fonasa).toHaveTextContent('6 %'))
    expect(within(fonasa).getByText('Modificado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restaurar FONASA' }))

    await waitFor(() => expect(actualizarRecibo).toHaveBeenLastCalledWith({ id: 5, entradas: ENTRADAS_VACIAS }))
    await waitFor(() => expect(within(screen.getByTestId('linea-auto-FONASA')).queryByText('Modificado')).toBeNull())
    expect(screen.getByLabelText('Ajuste FONASA')).toHaveValue('')
  })

  it('restaurar keeps the other overrides', async () => {
    const entradas: ReciboEntradas = { ...ENTRADAS_VACIAS, overrides: { fonasaTasa: '0.06', irpfImporte: 50_000 } }
    const { actualizarRecibo, user } = setup(respuesta(entradas))

    expect(await screen.findByLabelText('Ajuste IRPF')).toHaveValue('500,00')
    expect(screen.getByLabelText('Ajuste FONASA')).toHaveValue('6')
    await user.click(screen.getByRole('button', { name: 'Restaurar IRPF' }))

    await waitFor(() =>
      expect(actualizarRecibo).toHaveBeenCalledWith({ id: 5, entradas: { ...ENTRADAS_VACIAS, overrides: { fonasaTasa: '0.06' } } }),
    )
    expect(screen.queryByRole('button', { name: 'Restaurar IRPF' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Restaurar FONASA' })).toBeInTheDocument()
  })

  it('adds a manual line, saves it once it has a description, and removes it', async () => {
    const { actualizarRecibo, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Agregar línea' }))

    // A new line has no description yet: not saved, and the user is told why.
    expect(await screen.findByRole('alert')).toHaveTextContent('Línea manual 1: falta la descripción')
    expect(actualizarRecibo).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Descripción línea 1'), 'Horas extra')
    await user.type(screen.getByLabelText('Cantidad línea 1'), '2,5')
    await user.clear(screen.getByLabelText('Importe línea 1'))
    await user.type(screen.getByLabelText('Importe línea 1'), '1.500,00')
    await user.click(screen.getByLabelText('Gravado IRPF'))

    await waitFor(() =>
      expect(actualizarRecibo).toHaveBeenLastCalledWith({
        id: 5,
        entradas: {
          ...ENTRADAS_VACIAS,
          lineasManuales: [
            {
              descripcion: 'Horas extra',
              tipo: 'haber',
              cantidad: '2.5',
              valorUnitario: null,
              importe: 150_000,
              gravadoBps: true,
              gravadoIrpf: false,
            },
          ],
        },
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Quitar línea 1' }))
    await waitFor(() => expect(actualizarRecibo).toHaveBeenLastCalledWith({ id: 5, entradas: ENTRADAS_VACIAS }))
    expect(screen.getByText('Sin líneas manuales.')).toBeInTheDocument()
  })

  it('is read-only when the liquidación is emitida', async () => {
    const entradas: ReciboEntradas = {
      diasNoTrabajados: 1,
      lineasManuales: [
        { descripcion: 'Bono', tipo: 'haber', cantidad: null, valorUnitario: null, importe: 10_000, gravadoBps: true, gravadoIrpf: true },
      ],
      overrides: { fonasaTasa: '0.06' },
    }
    const { actualizarRecibo } = setup(respuesta(entradas, 2_000_000, 'emitida'))

    expect(await screen.findByText('Emitida · solo lectura')).toBeInTheDocument()
    expect(screen.getByLabelText('Días no trabajados')).toBeDisabled()
    expect(screen.getByLabelText('Descripción línea 1')).toBeDisabled()
    expect(screen.getByLabelText('Importe línea 1')).toBeDisabled()
    expect(screen.getByLabelText('Ajuste FONASA')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Agregar línea' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Restaurar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Quitar línea/ })).toBeNull()
    // The override is still marked, and the preview still renders.
    expect(within(screen.getByTestId('linea-auto-FONASA')).getByText('Modificado')).toBeInTheDocument()
    expect(screen.getByTestId('recibo-hoja')).toBeInTheDocument()
    expect(actualizarRecibo).not.toHaveBeenCalled()
  })

  it('switches to read-only when a save is rejected because the liquidación was emitida', async () => {
    const { obtenerRecibo, actualizarRecibo, user } = setup()
    actualizarRecibo.mockResolvedValue({
      ok: false,
      error: { code: 'LIQUIDACION_EMITIDA', message: 'La liquidación está emitida' },
    })
    obtenerRecibo.mockResolvedValue(ok(detalle({ estado: 'emitida' })))

    await user.type(await screen.findByLabelText('Ajuste FRL'), '1')

    expect(await screen.findByText('Emitida · solo lectura')).toBeInTheDocument()
    expect(obtenerRecibo).toHaveBeenCalledTimes(2)
    // Shows the stored values, not the rejected edit.
    expect(screen.getByLabelText('Ajuste FRL')).toHaveValue('')
    expect(screen.getByLabelText('Ajuste FRL')).toBeDisabled()
  })

  it('shows other save errors and keeps the edit', async () => {
    const { actualizarRecibo, user } = setup()
    actualizarRecibo.mockResolvedValue({ ok: false, error: { code: 'INTERNO', message: 'Falló el guardado' } })

    await user.type(await screen.findByLabelText('Ajuste Montepío'), '10')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el guardado')
    expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Error al guardar')
    expect(screen.getByLabelText('Ajuste Montepío')).toHaveValue('10')
  })

  it('rejects an out-of-range rate without saving it', async () => {
    const { actualizarRecibo, user } = setup()
    await user.type(await screen.findByLabelText('Ajuste FONASA'), '150')

    expect(await screen.findByText('Tasa inválida (0 a 100)')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('estado-guardado')).toHaveTextContent('Cambios guardados'))
    expect(guardadas(actualizarRecibo).at(-1)?.overrides).toEqual({ fonasaTasa: '0.15' })
  })

  it('shows the load error', async () => {
    setup({ ok: false, error: { code: 'NO_ENCONTRADO', message: 'Recibo no encontrado' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Recibo no encontrado')
  })

  it('rejects an invalid id without calling the API', () => {
    const obtenerRecibo = vi.fn()
    window.api = { liquidaciones: { obtenerRecibo } } as unknown as Api
    renderWithProviders(
      [{ path: '/liquidaciones/:liquidacionId/recibos/:reciboId', element: <ReciboEditorPage /> }],
      '/liquidaciones/3/recibos/abc',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('La dirección no corresponde a un recibo.')
    expect(obtenerRecibo).not.toHaveBeenCalled()
  })
})
