// Cents helpers and Uruguayan number format ("30.000,00": dot for thousands, comma for decimals).

import Decimal from 'decimal.js'
import type { Cents, Rate } from './types'

const MONEY_PATTERN = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/

/** Parses "30.000,00", "30000", "-1.234,5" into cents. Returns null for anything else. */
export function parseMoney(text: string): Cents | null {
  const match = MONEY_PATTERN.exec(text.trim())
  if (!match) return null
  const [, sign, integer = '', fraction = ''] = match
  const cents = Number(integer.replaceAll('.', '')) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return sign && cents !== 0 ? -cents : cents
}

/** Formats cents as "30.000,00". */
export function formatMoney(cents: Cents): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const integer = Math.trunc(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fraction = (abs % 100).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${integer},${fraction}`
}

/** Rounds a peso amount to integer cents, half-up (away from zero on .5). */
export function toCents(pesos: Decimal.Value): Cents {
  return new Decimal(pesos).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

/** Cents to an exact peso Decimal. */
export function fromCents(cents: Cents): Decimal {
  return new Decimal(cents).dividedBy(100)
}

/** "0.045" → "4,5" (percent, UY format, trailing zeros trimmed). */
export function formatRatePercent(rate: Rate): string {
  return new Decimal(rate).times(100).toString().replace('.', ',')
}

/** "4,5" or "4.5" → "0.045". Returns null for anything that isn't a plain number. */
export function parseRatePercent(text: string): Rate | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return new Decimal(normalized).dividedBy(100).toString()
}

/** Like `parseRatePercent`, but also null above 100 %: a contribution or tax rate as typed by the user. */
export function parseTasaPercent(text: string): Rate | null {
  const rate = parseRatePercent(text)
  return rate !== null && new Decimal(rate).lessThanOrEqualTo(1) ? rate : null
}
