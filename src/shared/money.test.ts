import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatRatePercent,
  fromCents,
  parseMoney,
  parseRatePercent,
  toCents,
} from './money'

describe('parseMoney / formatMoney', () => {
  it('round-trips "30.000,00" and 3000000 cents', () => {
    expect(parseMoney('30.000,00')).toBe(3_000_000)
    expect(formatMoney(3_000_000)).toBe('30.000,00')
  })

  it.each([
    ['30000', 3_000_000],
    ['30.000', 3_000_000],
    ['30000,5', 3_000_050],
    ['1.234.567,89', 123_456_789],
    ['0,01', 1],
    ['-0,50', -50],
    ['-0', 0],
    ['  37,50 ', 3_750],
  ])('parses %s', (text, cents) => {
    expect(parseMoney(text)).toBe(cents)
  })

  it.each(['', 'abc', '30,000.00', '30.00', '1.2345', '12,345', '1,,0', '--1'])(
    'rejects %j',
    (text) => {
      expect(parseMoney(text)).toBeNull()
    },
  )

  it.each([
    [0, '0,00'],
    [1, '0,01'],
    [-50, '-0,50'],
    [99_999_999, '999.999,99'],
    [123_456_789, '1.234.567,89'],
  ])('formats %i as %s', (cents, text) => {
    expect(formatMoney(cents)).toBe(text)
    expect(parseMoney(text)).toBe(cents)
  })
})

describe('toCents / fromCents', () => {
  it('rounds half-up', () => {
    expect(toCents('37.5')).toBe(3_750)
    expect(toCents('0.005')).toBe(1)
    expect(toCents('0.0049')).toBe(0)
    expect(toCents('-0.005')).toBe(-1)
  })

  it('converts back exactly', () => {
    expect(fromCents(3_750).toString()).toBe('37.5')
  })
})

describe('rate percent', () => {
  it('formats and parses', () => {
    expect(formatRatePercent('0.045')).toBe('4,5')
    expect(formatRatePercent('0.00125')).toBe('0,125')
    expect(parseRatePercent('4,5')).toBe('0.045')
    expect(parseRatePercent('15')).toBe('0.15')
    expect(parseRatePercent('x')).toBeNull()
  })
})
