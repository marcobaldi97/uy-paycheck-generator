import { describe, expect, it } from 'vitest'
import type { CodigoConcepto, LineaManual } from '@shared/types'
import { calcularRecibo, type CalcularReciboInput, type CalcularReciboResultado } from '../calcular'
import { condiciones, franjas, parametros2024, parametros2026 } from './fixtures'

function calcular(input: Partial<CalcularReciboInput> & Pick<CalcularReciboInput, 'condiciones'>): CalcularReciboResultado {
  return calcularRecibo({
    parametros: parametros2026,
    franjas,
    diasNoTrabajados: 0,
    lineasManuales: [],
    ...input,
  })
}

function linea(r: CalcularReciboResultado, codigo: CodigoConcepto) {
  return r.lineas.find((l) => l.codigo === codigo)
}

function importe(r: CalcularReciboResultado, codigo: CodigoConcepto): number | undefined {
  return linea(r, codigo)?.importe
}

describe('calcularRecibo', () => {
  it('1: 08/2024, 30000, FONASA 8%', () => {
    const r = calcular({
      parametros: parametros2024,
      condiciones: condiciones({ sueldoNominal: 3_000_000, fonasaConyuge: true, fonasaHijos: true }),
    })
    expect(importe(r, 'SUELDO')).toBe(3_000_000)
    expect(importe(r, 'MONTEPIO')).toBe(450_000)
    expect(importe(r, 'FONASA')).toBe(240_000)
    expect(importe(r, 'FRL')).toBe(3_750)
    expect(linea(r, 'IRPF')).toBeUndefined()
    expect(importe(r, 'REDONDEO')).toBe(-50)
    expect(r.liquido).toBe(2_306_300)
    expect(r.totalHaberes).toBe(3_000_000)
    expect(r.totalDescuentos).toBe(693_700)
    expect(r.imponibleBps).toBe(3_000_000)
    expect(r.imponibleIrpf).toBe(3_000_000)
    expect(r.lineas.map((l) => l.codigo)).toEqual(['SUELDO', 'MONTEPIO', 'FONASA', 'FRL', 'REDONDEO'])
    expect(r.lineas.map((l) => l.orden)).toEqual([1, 2, 3, 4, 5])
    expect(linea(r, 'FONASA')).toMatchObject({ cantidad: '0.08', valorUnitario: 3_000_000, override: false })
  })

  it('2: 2026, 15000, spouse, no children → FONASA 5%', () => {
    const r = calcular({ condiciones: condiciones({ sueldoNominal: 1_500_000, fonasaConyuge: true }) })
    expect(linea(r, 'FONASA')?.cantidad).toBe('0.05')
    expect(importe(r, 'FONASA')).toBe(75_000)
    expect(r.valoresCalculados.fonasaTasa).toBe('0.05')
  })

  it('3: 2026, 80000, no dependents', () => {
    const r = calcular({ condiciones: condiciones({ sueldoNominal: 8_000_000 }) })
    expect(r.irpf.rentaIncrementada.toNumber()).toBe(84_800)
    expect(r.irpf.bruto.toNumber()).toBe(4_483.2)
    expect(r.irpf.deducciones.toNumber()).toBe(15_700)
    expect(r.irpf.tasaDeduccion.toString()).toBe('0.14')
    expect(importe(r, 'MONTEPIO')).toBe(1_200_000)
    expect(importe(r, 'FONASA')).toBe(360_000)
    expect(importe(r, 'FRL')).toBe(10_000)
    expect(importe(r, 'IRPF')).toBe(228_520)
    expect(importe(r, 'REDONDEO')).toBe(-20)
    expect(r.liquido).toBe(6_201_500)
    expect(r.totalHaberes - r.totalDescuentos).toBe(r.liquido)
  })

  it('4: 2026, 120000, FONASA 8%, 2 children at 100%', () => {
    const r = calcular({
      condiciones: condiciones({
        sueldoNominal: 12_000_000,
        fonasaConyuge: true,
        fonasaHijos: true,
        irpfHijos: 2,
      }),
    })
    expect(r.irpf.rentaIncrementada.toNumber()).toBe(127_200)
    expect(r.irpf.bruto.toNumber()).toBe(13_024.8)
    expect(r.irpf.deducciones.toNumber()).toBe(50_630)
    expect(r.irpf.tasaDeduccion.toString()).toBe('0.08')
    expect(importe(r, 'FONASA')).toBe(960_000)
    expect(importe(r, 'IRPF')).toBe(897_440)
    expect(r.liquido).toBe(8_327_600)
  })

  it('4b: 50% attribution halves the child deduction', () => {
    const r = calcular({
      condiciones: condiciones({ sueldoNominal: 12_000_000, irpfHijos: 2, irpfPctAtribucion: 50 }),
    })
    // montepío 18000 + FONASA 4,5% 5400 + FRL 150 + 22880 × 50%
    expect(r.irpf.deducciones.toNumber()).toBe(18_000 + 5_400 + 150 + 11_440)
  })

  it('5: bruto < deducciones × tasa → IRPF 0, line omitted', () => {
    const r = calcular({ condiciones: condiciones({ sueldoNominal: 6_000_000, irpfHijos: 2 }) })
    expect(r.irpf.bruto.greaterThan(0)).toBe(true)
    expect(r.irpf.importe).toBe(0)
    expect(linea(r, 'IRPF')).toBeUndefined()
    expect(r.valoresCalculados.irpfImporte).toBe(0)
  })

  it('6: just above 10 BPC, días no trabajados bring it below → no increment', () => {
    const sinDias = calcular({ condiciones: condiciones({ sueldoNominal: 7_000_000 }) })
    expect(sinDias.irpf.incrementoAplicado).toBe(true)

    const r = calcular({ condiciones: condiciones({ sueldoNominal: 7_000_000 }), diasNoTrabajados: 2 })
    const dias = linea(r, 'DIAS_NO_TRABAJADOS')
    expect(dias).toMatchObject({ tipo: 'haber', cantidad: '2', valorUnitario: 233_333, importe: -466_667 })
    expect(r.imponibleIrpf).toBe(6_533_333)
    expect(r.imponibleBps).toBe(6_533_333)
    expect(r.irpf.incrementoAplicado).toBe(false)
    expect(r.irpf.rentaIncrementada.toNumber()).toBe(65_333.33)
    expect(r.totalHaberes).toBe(6_533_333)
  })

  it('7: FONASA override changes the FONASA line and IRPF deductions', () => {
    const cond = condiciones({ sueldoNominal: 8_000_000 })
    const r = calcular({ condiciones: cond, overrides: { fonasaTasa: '0.08' } })
    expect(linea(r, 'FONASA')).toMatchObject({ importe: 640_000, cantidad: '0.08', override: true })
    expect(r.irpf.deducciones.toNumber()).toBe(18_500)
    expect(importe(r, 'IRPF')).toBe(189_320)
    expect(r.valoresCalculados.fonasaTasa).toBe('0.045')
    expect(r.valoresCalculados.irpfImporte).toBe(189_320)
  })

  it('8: IRPF override replaces the amount, other lines unchanged', () => {
    const cond = condiciones({ sueldoNominal: 8_000_000 })
    const normal = calcular({ condiciones: cond })
    const r = calcular({ condiciones: cond, overrides: { irpfImporte: 100_000 } })
    expect(linea(r, 'IRPF')).toMatchObject({ importe: 100_000, override: true })
    for (const codigo of ['SUELDO', 'MONTEPIO', 'FONASA', 'FRL'] as const) {
      expect(linea(r, codigo)).toEqual(linea(normal, codigo))
    }
    expect(r.valoresCalculados.irpfImporte).toBe(228_520)
    expect(r.liquido).toBe(6_330_000)
    expect(linea(r, 'REDONDEO')).toBeUndefined()
  })

  it('9: receipt override wins over the worker FONASA rate', () => {
    const cond = condiciones({ sueldoNominal: 8_000_000, fonasaTasaManual: '0.06' })
    const soloTrabajador = calcular({ condiciones: cond })
    expect(linea(soloTrabajador, 'FONASA')).toMatchObject({ cantidad: '0.06', override: false })

    const r = calcular({ condiciones: cond, overrides: { fonasaTasa: '0.08' } })
    expect(linea(r, 'FONASA')).toMatchObject({ cantidad: '0.08', importe: 640_000, override: true })
    expect(r.valoresCalculados.fonasaTasa).toBe('0.06')
  })

  it('montepío and FRL overrides and tope', () => {
    const r = calcular({
      condiciones: condiciones({ sueldoNominal: 8_000_000 }),
      parametros: { ...parametros2026, topeMontepio: 5_000_000 },
      overrides: { frlTasa: '0' },
    })
    expect(linea(r, 'MONTEPIO')).toMatchObject({ importe: 750_000, valorUnitario: 5_000_000, override: false })
    expect(linea(r, 'FRL')).toMatchObject({ importe: 0, override: true })
    expect(r.valoresCalculados.frlTasa).toBe('0.00125')

    const m = calcular({ condiciones: condiciones({ sueldoNominal: 8_000_000 }), overrides: { montepioTasa: '0.1' } })
    expect(linea(m, 'MONTEPIO')).toMatchObject({ importe: 800_000, override: true })
    expect(m.valoresCalculados.montepioTasa).toBe('0.15')
  })

  it('manual lines: haberes follow their gravado flags, descuentos are subtracted', () => {
    const manuales: LineaManual[] = [
      { descripcion: 'Viático', tipo: 'haber', cantidad: null, valorUnitario: null, importe: 500_000, gravadoBps: false, gravadoIrpf: false },
      { descripcion: 'Horas extra', tipo: 'haber', cantidad: '4', valorUnitario: 25_000, importe: 100_000, gravadoBps: true, gravadoIrpf: true },
      { descripcion: 'Adelanto', tipo: 'descuento', cantidad: null, valorUnitario: null, importe: 300_000, gravadoBps: false, gravadoIrpf: false },
    ]
    const r = calcular({
      condiciones: condiciones({ sueldoNominal: 3_000_000 }),
      lineasManuales: manuales,
      descripciones: { SUELDO: 'Sueldo' },
    })
    expect(r.imponibleBps).toBe(3_100_000)
    expect(r.imponibleIrpf).toBe(3_100_000)
    expect(r.totalHaberes).toBe(3_600_000)
    expect(r.lineas.map((l) => l.descripcion)).toEqual([
      'Sueldo',
      'Viático',
      'Horas extra',
      'Montepío',
      'FONASA',
      'FRL',
      'Adelanto',
      'Redondeo',
    ])
    expect(r.lineas.filter((l) => l.origen === 'manual')).toHaveLength(3)
    // 36000 − 4650 − 1395 (4,5%) − 38,75 − 3000 = 26916,25 → 26916
    expect(importe(r, 'REDONDEO')).toBe(25)
    expect(r.liquido).toBe(2_691_600)
    expect(r.totalHaberes - r.totalDescuentos).toBe(r.liquido)
  })
})
