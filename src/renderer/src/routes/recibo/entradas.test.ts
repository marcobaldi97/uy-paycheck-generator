import { describe, expect, it } from 'vitest'
import { conOverride, formatCantidad, parseCantidad, tieneOverride } from './entradas'

describe('conOverride', () => {
  it('adds, replaces and removes one key without mutating', () => {
    const a = conOverride(null, 'fonasaTasa', '0.06')
    expect(a).toEqual({ fonasaTasa: '0.06' })
    const b = conOverride(a, 'irpfImporte', 0)
    expect(b).toEqual({ fonasaTasa: '0.06', irpfImporte: 0 })
    expect(tieneOverride(b, 'irpfImporte')).toBe(true)
    expect(conOverride(b, 'fonasaTasa', undefined)).toEqual({ irpfImporte: 0 })
    expect(a).toEqual({ fonasaTasa: '0.06' })
  })

  it('returns null when no override remains', () => {
    expect(conOverride({ frlTasa: '0.001' }, 'frlTasa', undefined)).toBeNull()
    expect(conOverride(null, 'frlTasa', undefined)).toBeNull()
    expect(tieneOverride(null, 'frlTasa')).toBe(false)
  })
})

describe('cantidad', () => {
  it('parses UY or dot decimals, empty as null, rejects junk', () => {
    expect(parseCantidad('2,5')).toBe('2.5')
    expect(parseCantidad(' 3 ')).toBe('3')
    expect(parseCantidad('')).toBeNull()
    expect(parseCantidad('2,')).toBeUndefined()
    expect(parseCantidad('abc')).toBeUndefined()
    expect(formatCantidad('2.5')).toBe('2,5')
    expect(formatCantidad(null)).toBe('')
  })
})
