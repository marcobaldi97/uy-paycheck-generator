// Test adapter for `window.api`: installs only the methods a test provides, type-checked against
// ApiSpec. Any other method resolves to INTERNO, so a test notices an unexpected call.
//
//   const api = instalarApi({ trabajadores: { listar: vi.fn().mockResolvedValue(ok([])) } })
//   afterEach(quitarApi)

import type { Api, ApiDomain, ApiResult, ErrorCode } from '@shared/api'
import { vi } from 'vitest'

export type FakeApi = { [D in ApiDomain]?: Partial<Api[D]> }

export const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })

export const err = (code: ErrorCode, message: string, details?: Record<string, unknown>): ApiResult<never> => ({
  ok: false,
  error: details === undefined ? { code, message } : { code, message, details },
})

/** Installs `window.api` and returns `metodos` as given, so tests keep their mock types. */
export function instalarApi<T extends FakeApi>(metodos: T): T {
  const porDominio = metodos as Record<string, Record<string, unknown> | undefined>
  window.api = new Proxy({} as Api, {
    get: (_target, domain: string) =>
      new Proxy(
        {},
        {
          get: (_fns, method: string) =>
            porDominio[domain]?.[method] ??
            vi.fn().mockResolvedValue(err('INTERNO', `sin mock: ${domain}.${method}`)),
        },
      ),
  })
  return metodos
}

export function quitarApi(): void {
  delete (window as { api?: Api }).api
}
