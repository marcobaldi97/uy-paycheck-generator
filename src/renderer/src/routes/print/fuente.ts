// Data source for the print route. Kept as an injectable interface so tests can supply
// receipts without Electron. The default goes through the typed client (`api/client.ts`),
// which also turns a missing bridge or a rejected IPC call into an `INTERNO` result.
//
// The print route doesn't use the TanStack hooks here: it must call `listo` exactly once,
// and tests inject this interface directly.

import type { ApiResult } from '@shared/api'
import type { ReciboImpresion } from '@shared/types'
import { call } from '../../api/client'

export interface FuenteImpresion {
  datosImpresion(input: { liquidacionId: number; reciboId: number | null }): Promise<ApiResult<ReciboImpresion[]>>
  listo(): Promise<ApiResult<null>>
}

export const fuenteWindowApi: FuenteImpresion = {
  datosImpresion: (input) => call('pdf', 'datosImpresion', input),
  listo: () => call('pdf', 'listo'),
}
