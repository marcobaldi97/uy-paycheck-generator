import { parametrosVersionSchema } from '@shared/schemas'
import { describe, expect, it } from 'vitest'
import { version2026 } from './fixture'
import {
  parametrosFormSchema,
  parseDecimalText,
  parseFechaUy,
  toFormValues,
  toVersion,
} from './form'

describe('parametros form model', () => {
  it('shows rates as percent and BPC multiples in UY format', () => {
    const values = toFormValues(version2026)
    expect(values.montepio).toBe('15')
    expect(values.frl).toBe('0,125')
    expect(values.fonasaAltoSinCargas).toBe('4,5')
    expect(values.fonasaUmbralBpc).toBe('2,5')
    expect(values.bpc).toBe(686400)
    expect(values.franjas[7]).toEqual({ desdeBpc: '115', hastaBpc: '', tasa: '36' })
  })

  it('round-trips a version exactly', () => {
    const back = toVersion(version2026.vigenteDesde, toFormValues(version2026))
    expect(back).toEqual(version2026)
    expect(parametrosVersionSchema.safeParse(back).success).toBe(true)
  })

  it('validates percents, decimals and required money', () => {
    const values = { ...toFormValues(version2026), bpc: null, montepio: '150', fonasaUmbralBpc: 'x' }
    const result = parametrosFormSchema.safeParse(values)
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['bpc', 'montepio', 'fonasaUmbralBpc']))
  })

  it('requires at least one franja and validates each cell', () => {
    const empty = parametrosFormSchema.safeParse({ ...toFormValues(version2026), franjas: [] })
    expect(empty.error?.issues[0]?.message).toBe('Se requiere al menos una franja')
    const bad = parametrosFormSchema.safeParse({
      ...toFormValues(version2026),
      franjas: [{ desdeBpc: '0', hastaBpc: 'abc', tasa: '' }],
    })
    expect(bad.error?.issues.map((i) => i.path.join('.'))).toEqual(['franjas.0.hastaBpc', 'franjas.0.tasa'])
  })

  it('parses decimal text', () => {
    expect(parseDecimalText('2,5')).toBe('2.5')
    expect(parseDecimalText(' 7.50 ')).toBe('7.5')
    expect(parseDecimalText('007')).toBe('7')
    expect(parseDecimalText('0')).toBe('0')
    expect(parseDecimalText('-1')).toBeNull()
    expect(parseDecimalText('')).toBeNull()
  })

  it('parses dates as typed', () => {
    expect(parseFechaUy('1/7/2027')).toBe('2027-07-01')
    expect(parseFechaUy('31/02/2027')).toBeNull()
    expect(parseFechaUy('2027-07-01')).toBeNull()
  })
})
