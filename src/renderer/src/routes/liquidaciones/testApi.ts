// Test helpers: fake window.api and sample data for the liquidaciones screens.

import type { Api, ApiResult, ErrorCode } from '@shared/api'
import type { LiquidacionDetalle, LiquidacionResumen } from '@shared/types'
import { vi } from 'vitest'

export const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
export const err = (code: ErrorCode, message: string, details?: Record<string, unknown>): ApiResult<never> => ({
  ok: false,
  error: details === undefined ? { code, message } : { code, message, details },
})

type FakeApi = Record<string, Record<string, ReturnType<typeof vi.fn>>>

/** Installs `window.api` with the given methods; any other method resolves to INTERNO. */
export function installApi(methods: FakeApi): FakeApi {
  const api = new Proxy(methods, {
    get: (target, domain: string) =>
      new Proxy(target[domain] ?? {}, {
        get: (fns, method: string) =>
          fns[method] ?? vi.fn().mockResolvedValue(err('INTERNO', `sin mock: ${domain}.${method}`)),
      }),
  })
  window.api = api as unknown as Api
  return methods
}

export function removeApi(): void {
  delete (window as { api?: Api }).api
}

export const resumenes: LiquidacionResumen[] = [
  {
    id: 2,
    periodo: '2024-08',
    fechaCargo: '2024-08-31',
    fechaPago: '2024-09-05',
    estado: 'borrador',
    cantidadRecibos: 2,
    totalLiquido: 5_432_110,
  },
  {
    id: 1,
    periodo: '2024-07',
    fechaCargo: '2024-07-31',
    fechaPago: '2024-08-05',
    estado: 'emitida',
    cantidadRecibos: 1,
    totalLiquido: 2_500_000,
  },
]

export function detalle(estado: 'borrador' | 'emitida' = 'borrador', recibos = true): LiquidacionDetalle {
  return {
    liquidacion: { id: 2, periodo: '2024-08', fechaCargo: '2024-08-31', fechaPago: '2024-09-05', estado },
    recibos: recibos
      ? [
          {
            id: 10,
            trabajadorId: 1,
            trabajadorNombre: 'ANA PÉREZ',
            totalHaberes: 3_000_000,
            totalDescuentos: 600_000,
            liquido: 2_400_000,
            tieneOverrides: false,
          },
          {
            id: 11,
            trabajadorId: 2,
            trabajadorNombre: 'JUAN GÓMEZ',
            totalHaberes: 3_800_000,
            totalDescuentos: 767_890,
            liquido: 3_032_110,
            tieneOverrides: true,
          },
        ]
      : [],
    totales: recibos
      ? { totalHaberes: 6_800_000, totalDescuentos: 1_367_890, liquido: 5_432_110 }
      : { totalHaberes: 0, totalDescuentos: 0, liquido: 0 },
  }
}
