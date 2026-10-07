// Period rules shared by main and the renderer.

import dayjs from 'dayjs'
import type { IsoDate, Periodo } from './types'

/**
 * The date that resolves a period: its last day. Conditions and parameters in force on this
 * date apply to the whole month, so a version starting mid-month (a worker hired on the 15th)
 * applies to it. Also the default fecha de cargo and fecha de pago of a new liquidación.
 */
export function fechaResolucion(periodo: Periodo): IsoDate {
  return dayjs(`${periodo}-01`).endOf('month').format('YYYY-MM-DD')
}
