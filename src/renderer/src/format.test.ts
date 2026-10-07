import { describe, expect, it } from 'vitest'
import { formatCantidad, formatCi, formatDecimal, formatFecha, formatPeriodo, parseId } from './format'

describe('formatPeriodo', () => {
  it('shows a period as MM/YYYY', () => {
    expect(formatPeriodo('2026-01')).toBe('01/2026')
    expect(formatPeriodo('2024-12')).toBe('12/2024')
  })
})

describe('formatFecha', () => {
  it('shows an ISO date as DD/MM/YYYY', () => {
    expect(formatFecha('2026-12-31')).toBe('31/12/2026')
    expect(formatFecha('2027-07-01')).toBe('01/07/2027')
    expect(formatFecha('2024-02-29')).toBe('29/02/2024')
  })

  it('leaves anything else unchanged', () => {
    expect(formatFecha('')).toBe('')
    expect(formatFecha('2026-01')).toBe('2026-01')
  })
})

describe('formatCi', () => {
  it('formats the C.I. as X.XXX.XXX-X', () => {
    expect(formatCi('51681437')).toBe('5.168.143-7')
    expect(formatCi('5.168.143-7')).toBe('5.168.143-7')
    expect(formatCi('5168143 7')).toBe('5.168.143-7')
    expect(formatCi('1234567')).toBe('123.456-7')
    expect(formatCi('AB123')).toBe('AB123')
  })
})

describe('formatDecimal', () => {
  it('uses a decimal comma and shows null as empty', () => {
    expect(formatDecimal('2.5')).toBe('2,5')
    expect(formatDecimal('3')).toBe('3')
    expect(formatDecimal(null)).toBe('')
  })
})

describe('formatCantidad', () => {
  it('shows rate lines as a percent and other quantities with a decimal comma', () => {
    expect(formatCantidad({ codigo: 'FONASA', cantidad: '0.045' })).toBe('4,5%')
    expect(formatCantidad({ codigo: 'MONTEPIO', cantidad: '0.15' })).toBe('15%')
    expect(formatCantidad({ codigo: 'FRL', cantidad: '0.00125' })).toBe('0,125%')
    expect(formatCantidad({ codigo: 'DIAS_NO_TRABAJADOS', cantidad: '3' })).toBe('3')
    expect(formatCantidad({ codigo: null, cantidad: '1.5' })).toBe('1,5')
    expect(formatCantidad({ codigo: 'SUELDO', cantidad: null })).toBe('')
  })
})

describe('parseId', () => {
  it('accepts positive integers', () => {
    expect(parseId('1')).toBe(1)
    expect(parseId('42')).toBe(42)
  })

  it('rejects anything else', () => {
    for (const value of [undefined, '', '0', '-1', '1.5', 'abc', '1e3', ' 1', '99999999999999999999']) {
      expect(parseId(value)).toBeNull()
    }
  })
})
