// Pure paycheck computation: conditions + parameters + receipt inputs → printed lines and totals.
// Every legal value comes from `parametros` and `franjas`; nothing here is hardcoded law.

import Decimal from 'decimal.js'
import { importeLineaManual } from '@shared/conceptos'
import { fromCents } from '@shared/money'
import type {
  Cents,
  CodigoConcepto,
  Condicion,
  FranjaIrpf,
  Linea,
  LineaManual,
  Overrides,
  Parametros,
  Rate,
  ReciboTotales,
  ValoresCalculados,
} from '@shared/types'
import { tasaFonasa } from './fonasa'
import { calcularIrpf, type IrpfDetalle } from './irpf'
import { calcularRedondeo, toCents } from './redondeo'

export type CondicionesCalculo = Pick<
  Condicion,
  | 'sueldoNominal'
  | 'fonasaConyuge'
  | 'fonasaHijos'
  | 'fonasaTasaManual'
  | 'irpfHijos'
  | 'irpfHijosDiscapacidad'
  | 'irpfPctAtribucion'
  | 'irpfOtrasDeducciones'
>

export interface CalcularReciboInput {
  condiciones: CondicionesCalculo
  parametros: Parametros
  franjas: FranjaIrpf[]
  diasNoTrabajados: number
  lineasManuales: LineaManual[]
  overrides?: Overrides | null
  /** Printed descriptions for the auto lines (from `conceptos`); defaults below. */
  descripciones?: Partial<Record<CodigoConcepto, string>>
}

export interface CalcularReciboResultado extends ReciboTotales {
  /** Ordered: haberes (auto, manual), descuentos (auto, manual), redondeo (a haber). `orden` is 1-based. */
  lineas: Linea[]
  /** Values without receipt overrides, for the editor's "restaurar". */
  valoresCalculados: ValoresCalculados
  /** IRPF breakdown with the effective rates (before `irpfImporte` override). */
  irpf: IrpfDetalle
}

export const DESCRIPCIONES_DEFAULT: Record<CodigoConcepto, string> = {
  SUELDO: 'Sueldo Mensual',
  DIAS_NO_TRABAJADOS: 'Días no trabajados',
  MONTEPIO: 'Montepío',
  FONASA: 'FONASA',
  FRL: 'FRL',
  IRPF: 'IRPF',
  REDONDEO: 'Redondeo',
}

const DIAS_MES = 30

type LineaSinOrden = Omit<Linea, 'orden'>

/**
 * Computes one receipt.
 *
 * - `imponibleIrpf` is the IRPF-taxed haberes minus montepío, FONASA and FRL, and 0 when no IRPF
 *   is withheld (as printed on the receipt; the IRPF itself is computed from the full taxed amount).
 * - Line `cantidad` holds days for días no trabajados and the applied rate (e.g. "0.15")
 *   for montepío, FONASA and FRL, whose `valorUnitario` is the base amount.
 * - A manual line with both `cantidad` and `valorUnitario` is worth their product (half-up to
 *   cents), whatever its typed `importe`.
 * - IRPF and redondeo lines are omitted when their amount is 0.
 */
export function calcularRecibo(input: CalcularReciboInput): CalcularReciboResultado {
  const { condiciones, parametros, franjas, lineasManuales } = input
  const overrides = input.overrides ?? {}
  const desc = (codigo: CodigoConcepto): string => input.descripciones?.[codigo] ?? DESCRIPCIONES_DEFAULT[codigo]
  const auto = (codigo: CodigoConcepto, tipo: Linea['tipo'], importe: Cents, extra?: Partial<LineaSinOrden>): LineaSinOrden => ({
    codigo,
    descripcion: desc(codigo),
    cantidad: null,
    valorUnitario: null,
    importe,
    tipo,
    origen: 'auto',
    override: false,
    ...extra,
  })

  // 1. Haberes
  const haberes: { linea: LineaSinOrden; gravadoBps: boolean; gravadoIrpf: boolean }[] = []
  const nominal = condiciones.sueldoNominal
  haberes.push({ linea: auto('SUELDO', 'haber', nominal), gravadoBps: true, gravadoIrpf: true })

  if (input.diasNoTrabajados !== 0) {
    const valorDia = fromCents(nominal).dividedBy(DIAS_MES)
    const importe = -toCents(valorDia.times(input.diasNoTrabajados))
    haberes.push({
      linea: auto('DIAS_NO_TRABAJADOS', 'haber', importe, {
        cantidad: new Decimal(input.diasNoTrabajados).toString(),
        valorUnitario: toCents(valorDia),
      }),
      gravadoBps: true,
      gravadoIrpf: true,
    })
  }

  const manualLinea = (m: LineaManual): LineaSinOrden => ({
    codigo: null,
    descripcion: m.descripcion,
    cantidad: m.cantidad,
    valorUnitario: m.valorUnitario,
    importe: importeLineaManual(m),
    tipo: m.tipo,
    origen: 'manual',
    override: false,
  })
  for (const m of lineasManuales) {
    if (m.tipo === 'haber') haberes.push({ linea: manualLinea(m), gravadoBps: m.gravadoBps, gravadoIrpf: m.gravadoIrpf })
  }

  // 2. Imponibles
  const imponibleBps = sum(haberes.filter((h) => h.gravadoBps).map((h) => h.linea.importe))
  const rentaIrpf = sum(haberes.filter((h) => h.gravadoIrpf).map((h) => h.linea.importe))

  // 3. Montepío and FRL
  const baseMontepio =
    parametros.topeMontepio === null ? imponibleBps : Math.min(imponibleBps, parametros.topeMontepio)
  const montepioTasa = overrides.montepioTasa ?? parametros.montepio
  const montepio = aporte(baseMontepio, montepioTasa)
  const frlTasa = overrides.frlTasa ?? parametros.frl
  const frl = aporte(imponibleBps, frlTasa)

  // 4. FONASA: receipt override → worker manual rate → computed
  const fonasaCalculada = condiciones.fonasaTasaManual ?? tasaFonasa(imponibleBps, condiciones, parametros)
  const fonasaTasa = overrides.fonasaTasa ?? fonasaCalculada
  const fonasa = aporte(imponibleBps, fonasaTasa)

  // 5. IRPF, with the effective contribution amounts as deductions
  const irpf = calcularIrpf(
    rentaIrpf,
    {
      montepio,
      fonasa,
      frl,
      irpfHijos: condiciones.irpfHijos,
      irpfHijosDiscapacidad: condiciones.irpfHijosDiscapacidad,
      irpfPctAtribucion: condiciones.irpfPctAtribucion,
      irpfOtrasDeducciones: condiciones.irpfOtrasDeducciones,
    },
    parametros,
    franjas,
  )
  const irpfImporte = overrides.irpfImporte ?? irpf.importe
  const imponibleIrpf = irpfImporte > 0 ? Math.max(0, rentaIrpf - montepio - fonasa - frl) : 0

  const descuentos: LineaSinOrden[] = [
    auto('MONTEPIO', 'descuento', montepio, {
      cantidad: montepioTasa,
      valorUnitario: baseMontepio,
      override: overrides.montepioTasa !== undefined,
    }),
    auto('FONASA', 'descuento', fonasa, {
      cantidad: fonasaTasa,
      valorUnitario: imponibleBps,
      override: overrides.fonasaTasa !== undefined,
    }),
    auto('FRL', 'descuento', frl, {
      cantidad: frlTasa,
      valorUnitario: imponibleBps,
      override: overrides.frlTasa !== undefined,
    }),
  ]
  if (irpfImporte !== 0) {
    descuentos.push(auto('IRPF', 'descuento', irpfImporte, { override: overrides.irpfImporte !== undefined }))
  }
  for (const m of lineasManuales) {
    if (m.tipo === 'descuento') descuentos.push(manualLinea(m))
  }

  // 6. Redondeo up to whole pesos, as a haber (never taxed)
  const haberesSinRedondeo = sum(haberes.map((h) => h.linea.importe))
  const totalDescuentos = sum(descuentos.map((l) => l.importe))
  const { redondeo, liquido } = calcularRedondeo(haberesSinRedondeo - totalDescuentos)
  const redondeoLineas = redondeo === 0 ? [] : [auto('REDONDEO', 'haber', redondeo)]

  const lineas: Linea[] = [...haberes.map((h) => h.linea), ...descuentos, ...redondeoLineas].map((l, i) => ({
    ...l,
    orden: i + 1,
  }))

  return {
    lineas,
    imponibleBps,
    imponibleIrpf,
    totalHaberes: haberesSinRedondeo + redondeo,
    totalDescuentos,
    liquido,
    valoresCalculados: {
      montepioTasa: parametros.montepio,
      fonasaTasa: fonasaCalculada,
      frlTasa: parametros.frl,
      irpfImporte: irpf.importe,
    },
    irpf,
  }
}

function aporte(base: Cents, tasa: Rate): Cents {
  return toCents(fromCents(base).times(tasa))
}

function sum(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0)
}
