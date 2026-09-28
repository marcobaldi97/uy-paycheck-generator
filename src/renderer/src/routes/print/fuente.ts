// Data source for the print route. Kept as an injectable interface so tests (and the editor
// preview, if needed) can supply receipts without Electron.
//
// TODO(T13): switch the default to the typed client in `src/renderer/src/api/client.ts` (T3)
// once it is merged; it did not exist when T4 was written.

import type { ApiResult } from '@shared/api'
import type { ReciboImpresion } from '@shared/types'

export interface FuenteImpresion {
  datosImpresion(input: { liquidacionId: number; reciboId: number | null }): Promise<ApiResult<ReciboImpresion[]>>
  listo(): Promise<ApiResult<null>>
}

export const fuenteWindowApi: FuenteImpresion = {
  datosImpresion: (input) => window.api.pdf.datosImpresion(input),
  listo: () => window.api.pdf.listo(),
}
