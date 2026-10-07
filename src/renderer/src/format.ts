// Display formatting shared by the screens and the receipt template, plus route id parsing.
// Pure string work: no number on screen is computed here.

import { esTasa } from '@shared/conceptos'
import { formatRatePercent } from '@shared/money'
import type { DecimalString, IsoDate, Linea, Periodo } from '@shared/types'

/** "2024-08" → "08/2024". */
export function formatPeriodo(periodo: Periodo): string {
  const [anio, mes] = periodo.split('-')
  return mes && anio ? `${mes}/${anio}` : periodo
}

/** "2024-09-01" → "01/09/2024"; anything that isn't `YYYY-MM-DD` unchanged. */
export function formatFecha(fecha: IsoDate): string {
  const [anio, mes, dia] = fecha.split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha
}

/** "51681437" → "5.168.143-7" (7 digits → "123.456-7"); anything else unchanged. */
export function formatCi(ci: string): string {
  const digitos = ci.replace(/\D/g, '')
  if (digitos.length !== 7 && digitos.length !== 8) return ci
  const cuerpo = digitos.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${digitos.slice(-1)}`
}

/** "2.5" → "2,5"; null → "". */
export function formatDecimal(value: DecimalString | null): string {
  return value === null ? '' : value.replace('.', ',')
}

/** A line's `cantidad`: rates (montepío, FONASA, FRL) as "15%" / "0,125%"; days and other quantities as "2" / "1,5". */
export function formatCantidad(linea: Pick<Linea, 'codigo' | 'cantidad'>): string {
  if (linea.cantidad === null) return ''
  return esTasa(linea.codigo) ? `${formatRatePercent(linea.cantidad)}%` : formatDecimal(linea.cantidad)
}

/** A route param as a positive integer id; null for anything else ("abc", "0", "1.5", too large). */
export function parseId(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
