import type { ReciboDetalle, ReciboEntradas } from '@shared/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reciboCarmona } from '../../components/Recibo.fixture'
import { instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { useReciboDraft } from './useReciboDraft'

const ENTRADAS_VACIAS: ReciboEntradas = { diasNoTrabajados: 0, lineasManuales: [], overrides: null }

function detalle(cambios: Partial<ReciboDetalle> = {}): ReciboDetalle {
  return {
    id: 5,
    liquidacionId: 3,
    trabajadorId: 1,
    estado: 'borrador',
    entradas: ENTRADAS_VACIAS,
    valoresCalculados: { montepioTasa: '0.15', fonasaTasa: '0.08', frlTasa: '0.00125', irpfImporte: 0 },
    lineas: reciboCarmona.lineas.map((l) => ({ ...l, override: false })),
    totales: reciboCarmona.totales,
    impresion: { ...reciboCarmona, reciboId: 5 },
    ...cambios,
  }
}

function setup(inicial: ReciboDetalle, autosaveMs = 20) {
  const { actualizarRecibo } = instalarApi({
    liquidaciones: { actualizarRecibo: vi.fn().mockResolvedValue(ok(inicial)) },
  }).liquidaciones
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(({ d }: { d: ReciboDetalle }) => useReciboDraft(d, { autosaveMs }), {
    wrapper,
    initialProps: { d: inicial },
  })
  return { actualizarRecibo, ...hook }
}

afterEach(quitarApi)

describe('useReciboDraft', () => {
  it('keeps edits in the draft and saves only the latest one after the debounce', async () => {
    const { result, actualizarRecibo } = setup(detalle(), 50)

    act(() => result.current.editar({ ...ENTRADAS_VACIAS, diasNoTrabajados: 1 }))
    act(() => result.current.setOverride('fonasaTasa', '0.06'))

    expect(result.current.entradas).toEqual({ diasNoTrabajados: 1, lineasManuales: [], overrides: { fonasaTasa: '0.06' } })
    expect(result.current.estado).toEqual({ tipo: 'pendiente' })
    expect(actualizarRecibo).not.toHaveBeenCalled()

    await waitFor(() => expect(result.current.estado).toEqual({ tipo: 'guardado' }))
    expect(actualizarRecibo).toHaveBeenCalledOnce()
    expect(actualizarRecibo).toHaveBeenCalledWith({
      id: 5,
      entradas: { diasNoTrabajados: 1, lineasManuales: [], overrides: { fonasaTasa: '0.06' } },
    })
  })

  it('removing the last override leaves overrides null', () => {
    const { result } = setup(detalle({ entradas: { ...ENTRADAS_VACIAS, overrides: { frlTasa: '0.001' } } }), 10_000)

    act(() => result.current.setOverride('frlTasa', undefined))

    expect(result.current.entradas.overrides).toBeNull()
  })

  it('is read-only while emitida: shows the stored entradas and ignores edits', async () => {
    const guardadas: ReciboEntradas = { ...ENTRADAS_VACIAS, diasNoTrabajados: 3 }
    const { result, actualizarRecibo } = setup(detalle({ estado: 'emitida', entradas: guardadas }))

    expect(result.current.soloLectura).toBe(true)
    act(() => result.current.editar({ ...guardadas, diasNoTrabajados: 7 }))
    act(() => result.current.setOverride('fonasaTasa', '0.06'))

    expect(result.current.entradas).toEqual(guardadas)
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(actualizarRecibo).not.toHaveBeenCalled()
  })

  it('after reabrir starts again from the stored entradas, not the earlier draft', () => {
    const guardadas: ReciboEntradas = { ...ENTRADAS_VACIAS, diasNoTrabajados: 1 }
    // A long debounce: the edit below stays in the draft, unsaved.
    const { result, rerender } = setup(detalle({ entradas: guardadas }), 10_000)

    act(() => result.current.editar({ ...guardadas, diasNoTrabajados: 9 }))
    expect(result.current.entradas.diasNoTrabajados).toBe(9)

    rerender({ d: detalle({ estado: 'emitida', entradas: guardadas }) })
    expect(result.current.soloLectura).toBe(true)
    expect(result.current.entradas).toEqual(guardadas)

    rerender({ d: detalle({ estado: 'borrador', entradas: guardadas }) })
    expect(result.current.soloLectura).toBe(false)
    expect(result.current.entradas).toEqual(guardadas)
  })
})
