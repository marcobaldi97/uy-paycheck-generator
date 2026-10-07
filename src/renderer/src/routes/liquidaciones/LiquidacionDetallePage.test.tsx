import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paths } from '../../paths'
import { renderWithProviders } from '../../test/render'
import { LiquidacionDetallePage } from './index'
import { recibosDePrueba } from '../../components/Recibo.fixture'
import { err, instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { detalle } from './testApi'

function renderDetalle(path = paths.liquidacion(2)) {
  return renderWithProviders(
    [
      { path: '/liquidaciones/:liquidacionId', element: <LiquidacionDetallePage /> },
      { path: '/liquidaciones/:liquidacionId/recibos/:reciboId', element: <p>editor abierto</p> },
    ],
    path,
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const boton = (name: string) => screen.getByRole('button', { name })

const opcion = (name: string) => screen.findByRole('menuitem', { name })
const abrirImprimir = async () => {
  await userEvent.click(boton('Exportar o imprimir'))
  await userEvent.click(await opcion('Imprimir…'))
}

/** Mantine keeps modals and menus mounted during their exit transition. */
const sinDialogo = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

afterEach(quitarApi)

describe('LiquidacionDetallePage', () => {
  it('shows one row per worker and a totals footer', async () => {
    const obtener = vi.fn().mockResolvedValue(ok(detalle()))
    instalarApi({ liquidaciones: { obtener } })
    renderDetalle()

    const filas = await screen.findAllByTestId('recibo-fila')
    expect(obtener).toHaveBeenCalledWith({ id: 2 })
    expect(screen.getByRole('heading', { name: 'Liquidación Agosto 2024' })).toBeInTheDocument()
    expect(screen.getByText(/Fecha de cargo 31\/08\/2024 · Fecha de pago 05\/09\/2024/)).toBeInTheDocument()
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent('ANA PÉREZ')
    expect(filas[0]).toHaveTextContent('30.000,00')
    expect(filas[0]).toHaveTextContent('6.000,00')
    expect(filas[0]).toHaveTextContent('24.000,00')
    expect(filas[0]).not.toHaveTextContent('Ajustes manuales')
    expect(filas[1]).toHaveTextContent('Ajustes manuales')

    const totales = screen.getByTestId('totales-fila')
    expect(totales).toHaveTextContent('68.000,00')
    expect(totales).toHaveTextContent('13.678,90')
    expect(totales).toHaveTextContent('54.321,10')

    const link = within(filas[1]!).getByRole('link', { name: 'JUAN GÓMEZ' })
    expect(link).toHaveAttribute('href', paths.recibo(2, 11))
    await userEvent.click(link)
    expect(await screen.findByText('editor abierto')).toBeInTheDocument()
  })

  it('shows NO_ENCONTRADO and rejects a malformed id without calling the API', async () => {
    const obtener = vi.fn().mockResolvedValue(err('NO_ENCONTRADO', 'Liquidación no encontrada'))
    instalarApi({ liquidaciones: { obtener } })
    const { unmount } = renderDetalle(paths.liquidacion(99))
    expect(await screen.findByRole('alert')).toHaveTextContent('Liquidación no encontrada')
    unmount()

    obtener.mockClear()
    renderDetalle('/liquidaciones/abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('Liquidación no encontrada')
    expect(obtener).not.toHaveBeenCalled()
  })

  it('recalculates a draft and shows the fresh numbers', async () => {
    const recalculado = detalle()
    recalculado.recibos[0]!.liquido = 2_500_000
    const recalcular = vi.fn().mockResolvedValue(ok(recalculado))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())), recalcular } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Recalcular'))

    expect(recalcular).toHaveBeenCalledWith({ id: 2 })
    expect(await screen.findByRole('status')).toHaveTextContent('Liquidación recalculada.')
    expect(screen.getAllByTestId('recibo-fila')[0]).toHaveTextContent('25.000,00')
  })

  it('emits after confirming, then offers Reabrir instead of Recalcular and Emitir', async () => {
    const emitir = vi.fn().mockResolvedValue(ok(detalle('emitida')))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())), emitir } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Emitir'))
    const dialog = await screen.findByRole('dialog', { name: 'Emitir liquidación' })
    expect(emitir).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Emitir' }))

    expect(emitir).toHaveBeenCalledWith({ id: 2 })
    expect(await screen.findByRole('status')).toHaveTextContent('Liquidación emitida.')
    await sinDialogo()
    expect(screen.getByText('Emitida')).toBeInTheDocument()
    expect(boton('Reabrir')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recalcular' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Emitir' })).not.toBeInTheDocument()
  })

  it('shows the CONFLICTO message when emitir fails (no empresa)', async () => {
    const emitir = vi
      .fn()
      .mockResolvedValue(err('CONFLICTO', 'Guardá los datos de la empresa antes de emitir la liquidación'))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())), emitir } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Emitir'))
    const dialog = await screen.findByRole('dialog', { name: 'Emitir liquidación' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Emitir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Guardá los datos de la empresa')
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('refetches when a write hits an already-emitida liquidación', async () => {
    const obtener = vi.fn().mockResolvedValueOnce(ok(detalle())).mockResolvedValue(ok(detalle('emitida')))
    const recalcular = vi.fn().mockResolvedValue(err('LIQUIDACION_EMITIDA', 'La liquidación ya fue emitida'))
    instalarApi({ liquidaciones: { obtener, recalcular } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Recalcular'))

    expect(await screen.findByRole('alert')).toHaveTextContent('La liquidación ya fue emitida')
    expect(await screen.findByRole('button', { name: 'Reabrir' })).toBeInTheDocument()
    expect(obtener).toHaveBeenCalledTimes(2)
  })

  it('reopens an emitida only after confirming', async () => {
    const reabrir = vi.fn().mockResolvedValue(ok(detalle('borrador')))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle('emitida'))), reabrir } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    expect(screen.getByText(/los recibos no se pueden modificar/)).toBeInTheDocument()

    await userEvent.click(boton('Reabrir'))
    let dialog = await screen.findByRole('dialog', { name: 'Reabrir liquidación' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await sinDialogo()
    expect(reabrir).not.toHaveBeenCalled()

    await userEvent.click(boton('Reabrir'))
    dialog = await screen.findByRole('dialog', { name: 'Reabrir liquidación' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reabrir' }))

    expect(reabrir).toHaveBeenCalledWith({ id: 2 })
    expect(await screen.findByRole('button', { name: 'Recalcular' })).toBeInTheDocument()
    expect(screen.getByText('Borrador')).toBeInTheDocument()
  })

  it('exports a single PDF, disabling actions while it runs', async () => {
    const pendiente = deferred<unknown>()
    const exportar = vi.fn().mockReturnValue(pendiente.promise)
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { exportar } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Exportar o imprimir'))
    await userEvent.click(await opcion('Un solo archivo'))

    expect(exportar).toHaveBeenCalledWith({ liquidacionId: 2, modo: 'unico' })
    await waitFor(() => expect(boton('Recalcular')).toBeDisabled())
    expect(boton('Emitir')).toBeDisabled()
    expect(screen.getByText(/Generando PDF/)).toBeInTheDocument()

    pendiente.resolve(ok({ cancelado: false, archivos: ['C:\\Recibos\\Agosto.pdf'] }))
    expect(await screen.findByRole('status')).toHaveTextContent('PDF guardado en C:\\Recibos\\Agosto.pdf')
    expect(boton('Recalcular')).toBeEnabled()
  })

  it('exports one PDF per worker', async () => {
    const exportar = vi.fn().mockResolvedValue(
      ok({
        cancelado: false,
        archivos: ['C:\\Recibos\\ANA PÉREZ--05-09-2024.pdf', 'C:\\Recibos\\JUAN GÓMEZ--05-09-2024.pdf'],
      }),
    )
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { exportar } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Exportar o imprimir'))
    await userEvent.click(await opcion('Un archivo por trabajador'))

    expect(exportar).toHaveBeenCalledWith({ liquidacionId: 2, modo: 'por_trabajador' })
    expect(await screen.findByRole('status')).toHaveTextContent('Se guardaron 2 archivos PDF en C:\\Recibos')
  })

  it('reopens the export menu with a single click after an export', async () => {
    const exportar = vi.fn().mockResolvedValue(ok({ cancelado: false, archivos: ['C:\\Recibos\\Agosto.pdf'] }))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { exportar } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Exportar o imprimir'))
    await userEvent.click(await opcion('Un solo archivo'))
    expect(await screen.findByRole('status')).toHaveTextContent('PDF guardado')
    expect(boton('Exportar o imprimir')).toHaveAttribute('aria-expanded', 'false')

    // One click opens it again.
    await userEvent.click(boton('Exportar o imprimir'))
    expect(boton('Exportar o imprimir')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(await opcion('Un archivo por trabajador'))
    await waitFor(() => expect(exportar).toHaveBeenLastCalledWith({ liquidacionId: 2, modo: 'por_trabajador' }))
  })

  it('says nothing when the save dialog is cancelled', async () => {
    const exportar = vi.fn().mockResolvedValue(ok({ cancelado: true, archivos: [] }))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { exportar } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Exportar o imprimir'))
    await userEvent.click(await opcion('Un solo archivo'))

    await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(boton('Exportar o imprimir')).toBeEnabled())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows CONFLICTO from export', async () => {
    const exportar = vi.fn().mockResolvedValue(err('CONFLICTO', 'La liquidación no tiene recibos'))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { exportar } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Exportar o imprimir'))
    await userEvent.click(await opcion('Un solo archivo'))

    expect(await screen.findByRole('alert')).toHaveTextContent('La liquidación no tiene recibos')
  })

  it('previews every receipt before exporting from the preview', async () => {
    const datosImpresion = vi.fn().mockResolvedValue(ok(recibosDePrueba(2)))
    const exportar = vi.fn().mockResolvedValue(ok({ cancelado: false, archivos: ['C:\\Recibos\\Agosto.pdf'] }))
    instalarApi({
      liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) },
      pdf: { datosImpresion, exportar },
    })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Vista previa'))

    const dialogo = await screen.findByRole('dialog', { name: 'Vista previa · Liquidación Agosto 2024' })
    expect(await within(dialogo).findByRole('region', { name: 'Recibo de TRABAJADOR 1' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('region', { name: 'Recibo de TRABAJADOR 2' })).toBeInTheDocument()
    expect(datosImpresion).toHaveBeenCalledWith({ liquidacionId: 2, reciboId: null })
    expect(exportar).not.toHaveBeenCalled()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Exportar PDF' }))
    await userEvent.click(await opcion('Un archivo por trabajador'))

    expect(exportar).toHaveBeenCalledWith({ liquidacionId: 2, modo: 'por_trabajador' })
    await sinDialogo()
    expect(await screen.findByRole('status')).toHaveTextContent('PDF guardado')
  })

  it('shows an error in the preview when the receipts cannot be loaded', async () => {
    const datosImpresion = vi.fn().mockResolvedValue(err('INTERNO', 'Falló la base de datos'))
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { datosImpresion } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Vista previa'))

    const dialogo = await screen.findByRole('dialog')
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Falló la base de datos')
    expect(within(dialogo).getByRole('button', { name: 'Exportar PDF' })).toBeDisabled()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }))
    await sinDialogo()
  })

  it('prints to the default printer, or through the system dialog', async () => {
    const imprimir = vi.fn().mockResolvedValue(ok(null))
    const impresoras = vi.fn().mockResolvedValue(
      ok([
        { nombre: 'HP LaserJet', predeterminada: true },
        { nombre: 'PDF', predeterminada: false },
      ]),
    )
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) }, pdf: { imprimir, impresoras } })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await abrirImprimir()
    let dialog = await screen.findByRole('dialog', { name: 'Imprimir recibos' })
    const select = await within(dialog).findByRole('combobox', { name: 'Impresora' })
    expect(select).toHaveValue('HP LaserJet')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Imprimir' }))

    expect(imprimir).toHaveBeenCalledWith({ liquidacionId: 2, reciboId: null, impresora: 'HP LaserJet' })
    expect(await screen.findByRole('status')).toHaveTextContent('Recibos enviados a HP LaserJet.')
    await sinDialogo()

    await abrirImprimir()
    dialog = await screen.findByRole('dialog', { name: 'Imprimir recibos' })
    await userEvent.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Impresora' }),
      'Elegir en el diálogo de impresión de Windows',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Imprimir' }))
    expect(imprimir).toHaveBeenLastCalledWith({ liquidacionId: 2, reciboId: null, impresora: null })
  })

  it("prints one worker's receipt from its row", async () => {
    const imprimir = vi.fn().mockResolvedValue(ok(null))
    instalarApi({
      liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) },
      pdf: { imprimir, impresoras: vi.fn().mockResolvedValue(ok([{ nombre: 'HP LaserJet', predeterminada: true }])) },
    })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await userEvent.click(boton('Imprimir recibo de JUAN GÓMEZ'))
    const dialog = await screen.findByRole('dialog', { name: 'Imprimir recibo' })
    expect(dialog).toHaveTextContent('Se imprimirá el recibo de JUAN GÓMEZ')
    await within(dialog).findByRole('combobox', { name: 'Impresora' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Imprimir' }))

    expect(imprimir).toHaveBeenCalledWith({ liquidacionId: 2, reciboId: 11, impresora: 'HP LaserJet' })
    expect(await screen.findByRole('status')).toHaveTextContent('Recibo enviado a HP LaserJet.')
  })

  it('shows print errors', async () => {
    const imprimir = vi.fn().mockResolvedValue(err('NO_ENCONTRADO', 'Impresora no encontrada: PDF'))
    instalarApi({
      liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) },
      pdf: { imprimir, impresoras: vi.fn().mockResolvedValue(ok([{ nombre: 'PDF', predeterminada: false }])) },
    })
    renderDetalle()

    await screen.findAllByTestId('recibo-fila')
    await abrirImprimir()
    const dialog = await screen.findByRole('dialog', { name: 'Imprimir recibos' })
    await within(dialog).findByRole('combobox', { name: 'Impresora' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Imprimir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Impresora no encontrada: PDF')
  })

  it('disables Emitir and the export/print menu when there are no receipts', async () => {
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle('borrador', false))) } })
    renderDetalle()

    expect(await screen.findByText('Esta liquidación no tiene recibos.')).toBeInTheDocument()
    expect(boton('Recalcular')).toBeEnabled()
    expect(boton('Emitir')).toBeDisabled()
    expect(boton('Exportar o imprimir')).toBeDisabled()
  })
})
