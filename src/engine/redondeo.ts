// Rounding helpers for the engine. Line amounts are cents (half-up); the net pay is rounded up to whole pesos.

import Decimal from 'decimal.js'
import { toCents } from '@shared/money'
import type { Cents } from '@shared/types'

export { toCents }

/** Rounds cents up to the next whole peso (toward +∞), so the worker is never paid less. */
export function redondearAPesos(cents: Cents): Cents {
  return new Decimal(cents).dividedBy(100).toDecimalPlaces(0, Decimal.ROUND_CEIL).times(100).toNumber()
}

/**
 * Redondeo line amount: rounded líquido − unrounded líquido, in cents.
 * It is a haber and never negative: it can only raise the líquido.
 */
export function calcularRedondeo(liquidoSinRedondear: Cents): { redondeo: Cents; liquido: Cents } {
  const liquido = redondearAPesos(liquidoSinRedondear)
  return { redondeo: liquido - liquidoSinRedondear, liquido }
}
