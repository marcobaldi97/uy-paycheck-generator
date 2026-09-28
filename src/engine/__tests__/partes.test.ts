import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { fonasaBandaAlta, tasaFonasa } from '../fonasa'
import { irpfBruto, rentaConIncremento, tasaDeduccion } from '../irpf'
import { calcularRedondeo, redondearAPesos } from '../redondeo'
import { franjas, parametros2026 } from './fixtures'

describe('fonasa', () => {
  const sin = { fonasaConyuge: false, fonasaHijos: false }
  it('band threshold is exclusive (> 2,5 BPC)', () => {
    expect(fonasaBandaAlta(1_716_000, parametros2026)).toBe(false)
    expect(fonasaBandaAlta(1_716_001, parametros2026)).toBe(true)
  })
  it('selects the rate from band and flags', () => {
    expect(tasaFonasa(1_000_000, sin, parametros2026)).toBe('0.03')
    expect(tasaFonasa(1_000_000, { fonasaConyuge: true, fonasaHijos: true }, parametros2026)).toBe('0.05')
    expect(tasaFonasa(5_000_000, sin, parametros2026)).toBe('0.045')
    expect(tasaFonasa(5_000_000, { fonasaConyuge: false, fonasaHijos: true }, parametros2026)).toBe('0.06')
    expect(tasaFonasa(5_000_000, { fonasaConyuge: true, fonasaHijos: false }, parametros2026)).toBe('0.065')
    expect(tasaFonasa(5_000_000, { fonasaConyuge: true, fonasaHijos: true }, parametros2026)).toBe('0.08')
  })
})

describe('irpf', () => {
  it('increment only above 10 BPC', () => {
    expect(rentaConIncremento(new Decimal(68_640), parametros2026).aplicado).toBe(false)
    expect(rentaConIncremento(new Decimal(68_640.01), parametros2026).aplicado).toBe(true)
  })
  it('progressive brackets, unordered input', () => {
    const shuffled = [...franjas].reverse()
    expect(irpfBruto(new Decimal(48_048), shuffled, parametros2026.bpc).toNumber()).toBe(0)
    expect(irpfBruto(new Decimal(84_800), shuffled, parametros2026.bpc).toNumber()).toBe(4_483.2)
    // above 115 BPC: top bracket unbounded
    const renta = new Decimal(1_000_000)
    expect(irpfBruto(renta, franjas, parametros2026.bpc).greaterThan(0)).toBe(true)
  })
  it('deduction rate switches above 15 BPC', () => {
    expect(tasaDeduccion(new Decimal(102_960), parametros2026).toString()).toBe('0.14')
    expect(tasaDeduccion(new Decimal(102_960.01), parametros2026).toString()).toBe('0.08')
  })
})

describe('redondeo', () => {
  it('rounds to whole pesos half-up', () => {
    expect(redondearAPesos(2_306_250)).toBe(2_306_300)
    expect(redondearAPesos(2_306_249)).toBe(2_306_200)
    expect(redondearAPesos(-150)).toBe(-200)
  })
  it('redondeo = unrounded − rounded', () => {
    expect(calcularRedondeo(2_306_250)).toEqual({ redondeo: -50, liquido: 2_306_300 })
    expect(calcularRedondeo(2_306_220)).toEqual({ redondeo: 20, liquido: 2_306_200 })
    expect(calcularRedondeo(100)).toEqual({ redondeo: 0, liquido: 100 })
  })
})
