import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  AppError,
  channel,
  type ApiDomain,
  type ApiInput,
  type ApiMethod,
  type ApiOutput,
  type ApiResult,
} from '@shared/api'
import { inputSchemas } from '@shared/schemas'
import { z } from 'zod'

type Handler<D extends ApiDomain, M extends ApiMethod<D>> = (
  input: ApiInput<D, M>,
  event: IpcMainInvokeEvent,
) => ApiOutput<D, M> | Promise<ApiOutput<D, M>>

/**
 * Registers the handler for one API method. The input is validated with
 * `inputSchemas[domain][method]`; AppError becomes `{ ok: false, error }`, anything else INTERNO.
 */
export function handle<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  handler: Handler<D, M>,
): void {
  const schema = (inputSchemas[domain] as Record<string, z.ZodType | undefined>)[method]
  if (!schema) throw new Error(`No input schema for ${channel(domain, method)}`)
  ipcMain.handle(
    channel(domain, method),
    async (event, raw: unknown): Promise<ApiResult<ApiOutput<D, M>>> => {
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDACION',
            message: 'Datos inválidos',
            details: { issues: z.flattenError(parsed.error) },
          },
        }
      }
      try {
        return { ok: true, data: await handler(parsed.data as ApiInput<D, M>, event) }
      } catch (error) {
        if (error instanceof AppError) return { ok: false, error: error.toApiError() }
        console.error(`[ipc] ${channel(domain, method)} failed`, error)
        return { ok: false, error: { code: 'INTERNO', message: 'Error inesperado' } }
      }
    },
  )
}
