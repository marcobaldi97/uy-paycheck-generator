// One TanStack Query hook per API method. Reads are `useQuery`, writes are `useMutation`
// and invalidate (or update) whatever they change. Errors are ApiRequestError; use
// `errorMessage(error)` from client.ts to show them.

import type { ApiDomain, ApiInput, ApiMethod, ApiOutput } from '@shared/api'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'
import { callOrThrow, type ApiRequestError, type CallArgs } from './client'

// ---------------------------------------------------------------- keys

/** Query keys start with the domain, so `invalidateQueries({ queryKey: [domain] })` hits all of it. */
export const queryKeys = {
  empresa: {
    all: ['empresa'] as const,
    obtener: () => ['empresa', 'obtener'] as const,
  },
  trabajadores: {
    all: ['trabajadores'] as const,
    listar: (soloActivos: boolean) => ['trabajadores', 'listar', { soloActivos }] as const,
    obtener: (id: number) => ['trabajadores', 'obtener', id] as const,
  },
  parametros: {
    all: ['parametros'] as const,
    listar: () => ['parametros', 'listar'] as const,
  },
  liquidaciones: {
    all: ['liquidaciones'] as const,
    listar: () => ['liquidaciones', 'listar'] as const,
    obtener: (id: number) => ['liquidaciones', 'obtener', id] as const,
    obtenerRecibo: (id: number) => ['liquidaciones', 'obtenerRecibo', id] as const,
  },
  pdf: {
    all: ['pdf'] as const,
    datosImpresion: (liquidacionId: number, reciboId: number | null) =>
      ['pdf', 'datosImpresion', { liquidacionId, reciboId }] as const,
    impresoras: () => ['pdf', 'impresoras'] as const,
  },
  respaldo: {
    all: ['respaldo'] as const,
    info: () => ['respaldo', 'info'] as const,
  },
}

// ---------------------------------------------------------------- option types

type QueryOptions<D extends ApiDomain, M extends ApiMethod<D>> = Omit<
  UseQueryOptions<ApiOutput<D, M>, ApiRequestError>,
  'queryKey' | 'queryFn'
>

type MutationOptions<D extends ApiDomain, M extends ApiMethod<D>> = Omit<
  UseMutationOptions<ApiOutput<D, M>, ApiRequestError, ApiInput<D, M>>,
  'mutationFn'
>

type QueryResult<D extends ApiDomain, M extends ApiMethod<D>> = UseQueryResult<ApiOutput<D, M>, ApiRequestError>
type MutationResult<D extends ApiDomain, M extends ApiMethod<D>> = UseMutationResult<
  ApiOutput<D, M>,
  ApiRequestError,
  ApiInput<D, M>
>

function useApiQuery<D extends ApiDomain, M extends ApiMethod<D>>(
  queryKey: readonly unknown[],
  domain: D,
  method: M,
  args: CallArgs<D, M>,
  options?: QueryOptions<D, M>,
): QueryResult<D, M> {
  return useQuery<ApiOutput<D, M>, ApiRequestError>({
    ...options,
    queryKey,
    queryFn: () => callOrThrow(domain, method, ...args),
  })
}

/**
 * Mutation over one API method. `onApplied` runs before the caller's `onSuccess` and
 * updates the cache; the caller's callbacks still run.
 */
function useApiMutation<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  onApplied: (client: QueryClient, data: ApiOutput<D, M>, input: ApiInput<D, M>) => Promise<unknown> | void,
  options?: MutationOptions<D, M>,
): MutationResult<D, M> {
  const client = useQueryClient()
  return useMutation<ApiOutput<D, M>, ApiRequestError, ApiInput<D, M>>({
    ...options,
    mutationFn: (input) =>
      callOrThrow(domain, method, ...((input === undefined ? [] : [input]) as unknown as CallArgs<D, M>)),
    onSuccess: async (data, input, onMutateResult, context) => {
      await onApplied(client, data, input)
      await options?.onSuccess?.(data, input, onMutateResult, context)
    },
  })
}

const invalidate = (client: QueryClient, ...keys: (readonly unknown[])[]) =>
  Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))

// ---------------------------------------------------------------- empresa

export function useEmpresa(options?: QueryOptions<'empresa', 'obtener'>) {
  return useApiQuery(queryKeys.empresa.obtener(), 'empresa', 'obtener', [], options)
}

export function useGuardarEmpresa(options?: MutationOptions<'empresa', 'guardar'>) {
  return useApiMutation(
    'empresa',
    'guardar',
    (client, empresa) => {
      client.setQueryData(queryKeys.empresa.obtener(), empresa)
      // Draft receipts print the current empresa.
      return invalidate(client, queryKeys.liquidaciones.all, queryKeys.pdf.all)
    },
    options,
  )
}

// ---------------------------------------------------------------- trabajadores

export function useTrabajadores(soloActivos: boolean, options?: QueryOptions<'trabajadores', 'listar'>) {
  return useApiQuery(queryKeys.trabajadores.listar(soloActivos), 'trabajadores', 'listar', [{ soloActivos }], options)
}

export function useTrabajador(id: number, options?: QueryOptions<'trabajadores', 'obtener'>) {
  return useApiQuery(queryKeys.trabajadores.obtener(id), 'trabajadores', 'obtener', [{ id }], options)
}

// Worker changes show up in draft liquidaciones (names, snapshots), so those refresh too.
const afterTrabajadorChange = (client: QueryClient) =>
  invalidate(client, queryKeys.trabajadores.all, queryKeys.liquidaciones.all, queryKeys.pdf.all)

export function useCrearTrabajador(options?: MutationOptions<'trabajadores', 'crear'>) {
  return useApiMutation('trabajadores', 'crear', afterTrabajadorChange, options)
}

export function useActualizarTrabajador(options?: MutationOptions<'trabajadores', 'actualizar'>) {
  return useApiMutation('trabajadores', 'actualizar', afterTrabajadorChange, options)
}

export function useNuevaCondicion(options?: MutationOptions<'trabajadores', 'nuevaCondicion'>) {
  return useApiMutation('trabajadores', 'nuevaCondicion', afterTrabajadorChange, options)
}

// ---------------------------------------------------------------- parametros

export function useParametros(options?: QueryOptions<'parametros', 'listar'>) {
  return useApiQuery(queryKeys.parametros.listar(), 'parametros', 'listar', [], options)
}

export function useNuevaVersionParametros(options?: MutationOptions<'parametros', 'nuevaVersion'>) {
  return useApiMutation('parametros', 'nuevaVersion', (client) => invalidate(client, queryKeys.parametros.all), options)
}

export function useActualizarParametros(options?: MutationOptions<'parametros', 'actualizar'>) {
  return useApiMutation('parametros', 'actualizar', (client) => invalidate(client, queryKeys.parametros.all), options)
}

// ---------------------------------------------------------------- liquidaciones

export function useLiquidaciones(options?: QueryOptions<'liquidaciones', 'listar'>) {
  return useApiQuery(queryKeys.liquidaciones.listar(), 'liquidaciones', 'listar', [], options)
}

export function useLiquidacion(id: number, options?: QueryOptions<'liquidaciones', 'obtener'>) {
  return useApiQuery(queryKeys.liquidaciones.obtener(id), 'liquidaciones', 'obtener', [{ id }], options)
}

export function useRecibo(id: number, options?: QueryOptions<'liquidaciones', 'obtenerRecibo'>) {
  return useApiQuery(queryKeys.liquidaciones.obtenerRecibo(id), 'liquidaciones', 'obtenerRecibo', [{ id }], options)
}

export function useCrearLiquidacion(options?: MutationOptions<'liquidaciones', 'crear'>) {
  return useApiMutation(
    'liquidaciones',
    'crear',
    (client) => invalidate(client, queryKeys.liquidaciones.listar()),
    options,
  )
}

/** recalcular, emitir and reabrir return the fresh detail; everything under it may have changed. */
const afterLiquidacionChange = (client: QueryClient, detalle: ApiOutput<'liquidaciones', 'obtener'>) => {
  const key = queryKeys.liquidaciones.obtener(detalle.liquidacion.id)
  client.setQueryData(key, detalle)
  return Promise.all([
    client.invalidateQueries({
      queryKey: queryKeys.liquidaciones.all,
      predicate: (query) => !sameKey(query.queryKey, key),
    }),
    invalidate(client, queryKeys.pdf.all),
  ])
}

export function useRecalcularLiquidacion(options?: MutationOptions<'liquidaciones', 'recalcular'>) {
  return useApiMutation('liquidaciones', 'recalcular', afterLiquidacionChange, options)
}

export function useEmitirLiquidacion(options?: MutationOptions<'liquidaciones', 'emitir'>) {
  return useApiMutation('liquidaciones', 'emitir', afterLiquidacionChange, options)
}

export function useReabrirLiquidacion(options?: MutationOptions<'liquidaciones', 'reabrir'>) {
  return useApiMutation('liquidaciones', 'reabrir', afterLiquidacionChange, options)
}

/**
 * Stores the returned recibo directly (no refetch, so autosave doesn't fight the editor)
 * and refreshes the parent liquidación, the list totals and print data.
 */
export function useActualizarRecibo(options?: MutationOptions<'liquidaciones', 'actualizarRecibo'>) {
  return useApiMutation(
    'liquidaciones',
    'actualizarRecibo',
    (client, recibo) => {
      client.setQueryData(queryKeys.liquidaciones.obtenerRecibo(recibo.id), recibo)
      return invalidate(
        client,
        queryKeys.liquidaciones.obtener(recibo.liquidacionId),
        queryKeys.liquidaciones.listar(),
        queryKeys.pdf.all,
      )
    },
    options,
  )
}

// ---------------------------------------------------------------- pdf

export function useDatosImpresion(
  liquidacionId: number,
  reciboId: number | null,
  options?: QueryOptions<'pdf', 'datosImpresion'>,
) {
  return useApiQuery(
    queryKeys.pdf.datosImpresion(liquidacionId, reciboId),
    'pdf',
    'datosImpresion',
    [{ liquidacionId, reciboId }],
    options,
  )
}

export function useImpresoras(options?: QueryOptions<'pdf', 'impresoras'>) {
  return useApiQuery(queryKeys.pdf.impresoras(), 'pdf', 'impresoras', [], options)
}

const noCacheChange = () => undefined

/** Signals main that the print route finished rendering. Call `mutate()` with no argument. */
export function usePdfListo(options?: MutationOptions<'pdf', 'listo'>) {
  return useApiMutation('pdf', 'listo', noCacheChange, options)
}

export function useExportarPdf(options?: MutationOptions<'pdf', 'exportar'>) {
  return useApiMutation('pdf', 'exportar', noCacheChange, options)
}

export function useImprimir(options?: MutationOptions<'pdf', 'imprimir'>) {
  return useApiMutation('pdf', 'imprimir', noCacheChange, options)
}

// ---------------------------------------------------------------- respaldo

export function useRespaldoInfo(options?: QueryOptions<'respaldo', 'info'>) {
  return useApiQuery(queryKeys.respaldo.info(), 'respaldo', 'info', [], options)
}

export function useCrearRespaldo(options?: MutationOptions<'respaldo', 'crear'>) {
  return useApiMutation('respaldo', 'crear', (client) => invalidate(client, queryKeys.respaldo.all), options)
}

// ---------------------------------------------------------------- helpers

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((part, i) => part === b[i])
}
