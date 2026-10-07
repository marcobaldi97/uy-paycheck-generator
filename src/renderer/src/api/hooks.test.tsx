import { API_METHODS, type ApiDomain, type ApiMethod } from '@shared/api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { err, instalarApi, ok, quitarApi, type FakeApi } from '../test/fakeApi'
import { ApiRequestError } from './client'
import * as hooks from './hooks'
import { queryKeys } from './hooks'

// Compile-time check that every API method has a hook (and nothing else is listed).
const hookByMethod = {
  empresa: { obtener: hooks.useEmpresa, guardar: hooks.useGuardarEmpresa },
  trabajadores: {
    listar: hooks.useTrabajadores,
    obtener: hooks.useTrabajador,
    crear: hooks.useCrearTrabajador,
    actualizar: hooks.useActualizarTrabajador,
    nuevaCondicion: hooks.useNuevaCondicion,
    tasaFonasa: hooks.useTasaFonasa,
  },
  parametros: {
    listar: hooks.useParametros,
    nuevaVersion: hooks.useNuevaVersionParametros,
    actualizar: hooks.useActualizarParametros,
  },
  liquidaciones: {
    listar: hooks.useLiquidaciones,
    obtener: hooks.useLiquidacion,
    crear: hooks.useCrearLiquidacion,
    recalcular: hooks.useRecalcularLiquidacion,
    emitir: hooks.useEmitirLiquidacion,
    reabrir: hooks.useReabrirLiquidacion,
    obtenerRecibo: hooks.useRecibo,
    actualizarRecibo: hooks.useActualizarRecibo,
  },
  pdf: {
    datosImpresion: hooks.useDatosImpresion,
    listo: hooks.usePdfListo,
    exportar: hooks.useExportarPdf,
    impresoras: hooks.useImpresoras,
    imprimir: hooks.useImprimir,
  },
  respaldo: { info: hooks.useRespaldoInfo, crear: hooks.useCrearRespaldo },
} satisfies { [D in ApiDomain]: { [M in ApiMethod<D>]: (...args: never[]) => unknown } }

function setup(api: FakeApi) {
  instalarApi(api)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

/** A mock IPC method that answers `data`. */
const responde = <T,>(data: T) => vi.fn().mockResolvedValue(ok(data))

afterEach(quitarApi)

describe('hooks', () => {
  it('has one hook per API method', () => {
    for (const [domain, methods] of Object.entries(API_METHODS)) {
      const mapped = hookByMethod[domain as ApiDomain] as Record<string, unknown>
      expect(Object.keys(mapped).sort()).toEqual(Object.keys(methods).sort())
      for (const hook of Object.values(mapped)) expect(typeof hook).toBe('function')
    }
  })

  it('queries pass their input and cache by key', async () => {
    const listar = responde([{ id: 1 }])
    const { client, wrapper } = setup({ trabajadores: { listar } })

    const { result } = renderHook(() => hooks.useTrabajadores(true), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(listar).toHaveBeenCalledWith({ soloActivos: true })
    expect(result.current.data).toEqual([{ id: 1 }])
    expect(client.getQueryData(queryKeys.trabajadores.listar(true))).toEqual([{ id: 1 }])
  })

  it('query errors are ApiRequestError with the domain code', async () => {
    const { wrapper } = setup({ liquidaciones: { obtener: vi.fn().mockResolvedValue(err('NO_ENCONTRADO', 'No existe.')) } })

    const { result } = renderHook(() => hooks.useLiquidacion(9), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(ApiRequestError)
    expect(result.current.error?.code).toBe('NO_ENCONTRADO')
    expect(result.current.error?.message).toBe('No existe.')
  })

  it('mutation errors reach onError and do not invalidate', async () => {
    const { client, wrapper } = setup({
      liquidaciones: { crear: vi.fn().mockResolvedValue(err('LIQUIDACION_EXISTENTE', 'Ya existe.')) },
    })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const onError = vi.fn()

    const { result } = renderHook(() => hooks.useCrearLiquidacion({ onError }), { wrapper })
    await act(() =>
      result.current
        .mutateAsync({ periodo: '2026-01', fechaCargo: '2026-01-31', fechaPago: '2026-02-05' } as never)
        .catch(() => undefined),
    )

    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: 'LIQUIDACION_EXISTENTE' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('saving a worker refetches worker queries', async () => {
    const listar = responde([])
    const crear = responde({ id: 2 })
    const { wrapper } = setup({ trabajadores: { listar, crear } })
    const onSuccess = vi.fn()

    const { result } = renderHook(
      () => ({ lista: hooks.useTrabajadores(false), crear: hooks.useCrearTrabajador({ onSuccess }) }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    expect(listar).toHaveBeenCalledTimes(1)

    await act(() => result.current.crear.mutateAsync({ nombre: 'Ana' } as never))

    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2))
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(onSuccess.mock.calls[0]?.[0]).toEqual({ id: 2 })
  })

  it('void mutations are called without arguments', async () => {
    const listo = responde(null)
    const { wrapper } = setup({ pdf: { listo } })

    const { result } = renderHook(() => hooks.usePdfListo(), { wrapper })
    await act(() => result.current.mutateAsync())

    expect(listo).toHaveBeenCalledWith()
  })

  it('emitir stores the returned detail and invalidates the rest of liquidaciones', async () => {
    const detalle = { liquidacion: { id: 3, estado: 'emitida' }, recibos: [], totales: {} }
    const emitir = responde(detalle)
    const { client, wrapper } = setup({ liquidaciones: { emitir } })
    client.setQueryData(queryKeys.liquidaciones.listar(), [])
    client.setQueryData(queryKeys.liquidaciones.obtener(3), { stale: true })

    const { result } = renderHook(() => hooks.useEmitirLiquidacion(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 3 }))

    expect(client.getQueryData(queryKeys.liquidaciones.obtener(3))).toEqual(detalle)
    expect(client.getQueryState(queryKeys.liquidaciones.obtener(3))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.liquidaciones.listar())?.isInvalidated).toBe(true)
  })

  it('actualizarRecibo stores the recibo and invalidates its liquidación and the list', async () => {
    const recibo = { id: 7, liquidacionId: 3 }
    const { client, wrapper } = setup({ liquidaciones: { actualizarRecibo: responde(recibo) } })
    client.setQueryData(queryKeys.liquidaciones.listar(), [])
    client.setQueryData(queryKeys.liquidaciones.obtener(3), {})
    client.setQueryData(queryKeys.liquidaciones.obtener(4), {})

    const { result } = renderHook(() => hooks.useActualizarRecibo(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 7, entradas: {} as never }))

    expect(client.getQueryData(queryKeys.liquidaciones.obtenerRecibo(7))).toEqual(recibo)
    expect(client.getQueryState(queryKeys.liquidaciones.obtenerRecibo(7))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.liquidaciones.obtener(3))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.liquidaciones.obtener(4))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.liquidaciones.listar())?.isInvalidated).toBe(true)
  })

  it('crearRespaldo invalidates respaldo info', async () => {
    const { client, wrapper } = setup({ respaldo: { crear: responde({ ruta: 'x' }) } })
    client.setQueryData(queryKeys.respaldo.info(), {})

    const { result } = renderHook(() => hooks.useCrearRespaldo(), { wrapper })
    await act(() => result.current.mutateAsync())

    expect(client.getQueryState(queryKeys.respaldo.info())?.isInvalidated).toBe(true)
  })
})
