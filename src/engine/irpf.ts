// IRPF (category II, monthly withholding) from rent, brackets and deductions.

import Decimal from 'decimal.js'
import { fromCents } from '@shared/money'
import type { Cents, FranjaIrpf, IrpfPctAtribucion, Parametros } from '@shared/types'
import { toCents } from './redondeo'

export interface IrpfDeduccionesInput {
  /** Actual montepío, FONASA and FRL line amounts. */
  montepio: Cents
  fonasa: Cents
  frl: Cents
  irpfHijos: number
  irpfHijosDiscapacidad: number
  irpfPctAtribucion: IrpfPctAtribucion
  irpfOtrasDeducciones: Cents
}

export interface IrpfDetalle {
  /** Sum of IRPF-taxed haberes, in pesos. */
  renta: Decimal
  /** Renta after the increment (equal to `renta` when not applied). */
  rentaIncrementada: Decimal
  incrementoAplicado: boolean
  bruto: Decimal
  deducciones: Decimal
  tasaDeduccion: Decimal
  /** max(0, bruto − deducciones × tasa), rounded to cents. */
  importe: Cents
}

/** Applies the increment when renta > `irpfIncrementoUmbralBpc` × BPC. */
export function rentaConIncremento(renta: Decimal, parametros: Parametros): { renta: Decimal; aplicado: boolean } {
  const bpc = fromCents(parametros.bpc)
  const umbral = new Decimal(parametros.irpfIncrementoUmbralBpc).times(bpc)
  if (!renta.greaterThan(umbral)) return { renta, aplicado: false }
  return { renta: renta.times(new Decimal(1).plus(parametros.irpfIncremento)), aplicado: true }
}

/** Progressive tax over the brackets (limits in BPC). */
export function irpfBruto(renta: Decimal, franjas: FranjaIrpf[], bpcCents: Cents): Decimal {
  const bpc = fromCents(bpcCents)
  const ordenadas = [...franjas].sort((a, b) => new Decimal(a.desdeBpc).comparedTo(b.desdeBpc))
  let total = new Decimal(0)
  for (const franja of ordenadas) {
    const desde = new Decimal(franja.desdeBpc).times(bpc)
    if (!renta.greaterThan(desde)) continue
    const hasta = franja.hastaBpc === null ? renta : Decimal.min(renta, new Decimal(franja.hastaBpc).times(bpc))
    if (hasta.lessThanOrEqualTo(desde)) continue
    total = total.plus(hasta.minus(desde).times(franja.tasa))
  }
  return total
}

/** Monthly deductions: contributions + children (annual BPC / 12, by attribution %) + other. */
export function irpfDeducciones(input: IrpfDeduccionesInput, parametros: Parametros): Decimal {
  const bpc = fromCents(parametros.bpc)
  const hijos = new Decimal(input.irpfHijos).times(parametros.irpfHijoBpcAnual).times(bpc).dividedBy(12)
  const hijosDisc = new Decimal(input.irpfHijosDiscapacidad)
    .times(parametros.irpfHijoDiscBpcAnual)
    .times(bpc)
    .dividedBy(12)
  const porHijos = hijos.plus(hijosDisc).times(input.irpfPctAtribucion).dividedBy(100)
  return fromCents(input.montepio)
    .plus(fromCents(input.fonasa))
    .plus(fromCents(input.frl))
    .plus(porHijos)
    .plus(fromCents(input.irpfOtrasDeducciones))
}

/** Deduction rate: low rate when renta (after increment) ≤ `irpfDeduccionUmbralBpc` × BPC. */
export function tasaDeduccion(rentaIncrementada: Decimal, parametros: Parametros): Decimal {
  const umbral = new Decimal(parametros.irpfDeduccionUmbralBpc).times(fromCents(parametros.bpc))
  return new Decimal(
    rentaIncrementada.lessThanOrEqualTo(umbral) ? parametros.irpfTasaDeduccionBaja : parametros.irpfTasaDeduccionAlta,
  )
}

export function calcularIrpf(
  rentaCents: Cents,
  deduccionesInput: IrpfDeduccionesInput,
  parametros: Parametros,
  franjas: FranjaIrpf[],
): IrpfDetalle {
  const renta = fromCents(rentaCents)
  const { renta: rentaIncrementada, aplicado } = rentaConIncremento(renta, parametros)
  const bruto = irpfBruto(rentaIncrementada, franjas, parametros.bpc)
  const deducciones = irpfDeducciones(deduccionesInput, parametros)
  const tasa = tasaDeduccion(rentaIncrementada, parametros)
  const neto = Decimal.max(0, bruto.minus(deducciones.times(tasa)))
  return {
    renta,
    rentaIncrementada,
    incrementoAplicado: aplicado,
    bruto,
    deducciones,
    tasaDeduccion: tasa,
    importe: toCents(neto),
  }
}
