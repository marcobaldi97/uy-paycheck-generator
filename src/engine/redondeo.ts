// Rounding helpers for the engine. Line amounts are cents (half-up); the net pay is rounded to whole pesos.

import Decimal from 'decimal.js'
import { toCents } from '@shared/money'
import type { Cents } from '@shared/types'

export { toCents }

/** Rounds cents to whole pesos, half-up (away from zero on .50). */
export function redondearAPesos(cents: Cents): Cents {
  return new Decimal(cents).dividedBy(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(100).toNumber()
}

/**
 * Redondeo line amount: unrounded líquido − rounded líquido, in cents.
 * It is a descuento, so a negative value raises the líquido.
 */
export function calcularRedondeo(liquidoSinRedondear: Cents): { redondeo: Cents; liquido: Cents } {
  const liquido = redondearAPesos(liquidoSinRedondear)
  return { redondeo: liquidoSinRedondear - liquido, liquido }
}
