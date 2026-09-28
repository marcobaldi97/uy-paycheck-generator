// Display and date helpers for the liquidaciones screens.

import type { IsoDate, Periodo } from '@shared/types'
import dayjs from 'dayjs'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** "2024-08" → "Agosto 2024". */
export function nombrePeriodo(periodo: Periodo): string {
  const [anio, mes] = periodo.split('-')
  const nombre = MESES[Number(mes) - 1]
  return anio && nombre ? `${nombre} ${anio}` : periodo
}

/** "2024-02" → "2024-02-29". */
export function ultimoDiaDelPeriodo(periodo: Periodo): IsoDate {
  return dayjs(`${periodo}-01`).endOf('month').format('YYYY-MM-DD')
}

/** "2024-12" → "2025-01". */
export function periodoSiguiente(periodo: Periodo): Periodo {
  return dayjs(`${periodo}-01`).add(1, 'month').format('YYYY-MM')
}

/** Period suggested for a new liquidación: the month after the newest one, or the current month. */
export function periodoSugerido(periodos: Periodo[], hoy: Date = new Date()): Periodo {
  const ultimo = [...periodos].sort().at(-1)
  return ultimo ? periodoSiguiente(ultimo) : dayjs(hoy).format('YYYY-MM')
}
