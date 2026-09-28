// Typed wrapper over window.api. Screens use the hooks in hooks.ts; this file is the only
// place in the renderer that touches window.api.

import type {
  ApiDomain,
  ApiError,
  ApiInput,
  ApiMethod,
  ApiOutput,
  ApiResult,
  ErrorCode,
} from '@shared/api'

type AnyMethod = (input?: unknown) => Promise<ApiResult<unknown>>

/** Arguments after (domain, method): none for `void` inputs, one otherwise. */
export type CallArgs<D extends ApiDomain, M extends ApiMethod<D>> = [ApiInput<D, M>] extends [void]
  ? []
  : [input: ApiInput<D, M>]

/**
 * Calls `window.api.<domain>.<method>(input)` and always resolves to an ApiResult.
 * A rejected IPC call or a malformed response (bridge missing, main crashed) becomes
 * an `INTERNO` error instead of a rejection.
 */
export async function call<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  ...args: CallArgs<D, M>
): Promise<ApiResult<ApiOutput<D, M>>> {
  try {
    const fn = (window.api?.[domain] as Record<string, AnyMethod> | undefined)?.[method]
    if (typeof fn !== 'function') {
      return failure('INTERNO', 'No se pudo comunicar con la aplicación.', { domain, method })
    }
    const result = await fn(...args)
    if (!isApiResult(result)) {
      return failure('INTERNO', 'Respuesta inesperada de la aplicación.', { domain, method })
    }
    return result as ApiResult<ApiOutput<D, M>>
  } catch (cause) {
    return failure('INTERNO', 'Ocurrió un error inesperado.', {
      domain,
      method,
      cause: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/** Error thrown by `callOrThrow` (and so by every query and mutation in hooks.ts). */
export class ApiRequestError extends Error {
  readonly code: ErrorCode
  readonly details: Record<string, unknown> | undefined

  constructor(readonly apiError: ApiError) {
    super(apiError.message)
    this.name = 'ApiRequestError'
    this.code = apiError.code
    this.details = apiError.details
  }
}

/** Like `call`, but returns the data or throws an ApiRequestError. For TanStack Query. */
export async function callOrThrow<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  ...args: CallArgs<D, M>
): Promise<ApiOutput<D, M>> {
  return unwrap(await call(domain, method, ...args))
}

export function unwrap<T>(result: ApiResult<T>): T {
  if (result.ok) return result.data
  throw new ApiRequestError(result.error)
}

/** The ApiError behind any thrown value; unknown errors become INTERNO. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiRequestError) return error.apiError
  return {
    code: 'INTERNO',
    message: 'Ocurrió un error inesperado.',
    details: { cause: error instanceof Error ? error.message : String(error) },
  }
}

/** User-facing Spanish message for any thrown value. */
export function errorMessage(error: unknown): string {
  return toApiError(error).message
}

export function isApiErrorCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiRequestError && error.code === code
}

function failure(code: ErrorCode, message: string, details?: Record<string, unknown>): ApiResult<never> {
  return { ok: false, error: details === undefined ? { code, message } : { code, message, details } }
}

function isApiResult(value: unknown): value is ApiResult<unknown> {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false
  if (value.ok === true) return 'data' in value
  if (value.ok === false) {
    const error = (value as { error?: unknown }).error
    return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
  }
  return false
}
