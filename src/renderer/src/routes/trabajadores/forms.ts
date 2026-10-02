// Form values and schemas for the trabajador screens, plus conversions to the API inputs.
// Forms hold what the inputs hold (numbers may be '', percent as text); the API gets
// validated domain values.

import { formatRatePercent, parseRatePercent } from '@shared/money'
import { isoDateSchema, trabajadorInputSchema } from '@shared/schemas'
import type { Cents, Condicion, CondicionInput, IrpfPctAtribucion, Trabajador, TrabajadorInput } from '@shared/types'
import dayjs from 'dayjs'
import { z } from 'zod'

// ---------------------------------------------------------------- trabajador

export interface TrabajadorFormValues extends Omit<TrabajadorInput, 'numero'> {
  /** NumberInput yields '' when empty. */
  numero: number | string
}

const enteroPositivo = z
  .number({ error: 'Requerido' })
  .int('Debe ser un número entero')
  .positive('Debe ser mayor que 0')

export const trabajadorFormSchema = trabajadorInputSchema.extend({ numero: enteroPositivo })

export const trabajadorVacio = (numero: number | ''): TrabajadorFormValues => ({
  numero,
  ci: '',
  nombre: '',
  cargo: '',
  fechaIngreso: '',
  afiliacionBps: '',
  carpetaBse: '',
  lugarCobro: '',
  lugarTrabajo: '',
  activo: true,
})

export function trabajadorAForm(trabajador: Trabajador): TrabajadorFormValues {
  const datos: TrabajadorFormValues & { id?: number } = { ...trabajador }
  delete datos.id
  return datos
}

/** Call after the schema accepted the values. */
export function formATrabajadorInput(values: TrabajadorFormValues): TrabajadorInput {
  return trabajadorFormSchema.parse(values)
}

/** Next free worker number: one more than the highest in use. */
export function siguienteNumero(trabajadores: readonly Trabajador[]): number {
  return trabajadores.reduce((max, t) => Math.max(max, t.numero), 0) + 1
}

// ---------------------------------------------------------------- condición

export interface CondicionFormValues {
  vigenteDesde: string
  sueldoNominal: Cents | null
  fonasaConyuge: boolean
  fonasaHijos: boolean
  /** Percent text in UY format ("4,5"); empty = no manual rate. */
  fonasaTasaManual: string
  irpfHijos: number | string
  irpfHijosDiscapacidad: number | string
  irpfPctAtribucion: '100' | '50'
  irpfOtrasDeducciones: Cents | null
}

const cantidad = z.number({ error: 'Requerido' }).int('Debe ser un número entero').min(0, 'No puede ser negativo')
const importe = z.number({ error: 'Requerido' }).int().min(0, 'No puede ser negativo')

export const condicionFormSchema = z.object({
  vigenteDesde: isoDateSchema,
  sueldoNominal: importe,
  fonasaConyuge: z.boolean(),
  fonasaHijos: z.boolean(),
  fonasaTasaManual: z.string().refine((texto) => {
    if (texto.trim() === '') return true
    const tasa = parseRatePercent(texto)
    return tasa !== null && Number(tasa) <= 1
  }, 'Porcentaje inválido (entre 0 y 100, ej.: 4,5)'),
  irpfHijos: cantidad,
  irpfHijosDiscapacidad: cantidad,
  irpfPctAtribucion: z.enum(['100', '50']),
  irpfOtrasDeducciones: importe,
})

/**
 * Starting values for "Nueva condición": a copy of the newest condition with an empty
 * start date, so the user only changes what differs. Defaults when there is none.
 */
export function nuevaCondicionInicial(ultima: Condicion | undefined): CondicionFormValues {
  if (!ultima) {
    return {
      vigenteDesde: '',
      sueldoNominal: null,
      fonasaConyuge: false,
      fonasaHijos: false,
      fonasaTasaManual: '',
      irpfHijos: 0,
      irpfHijosDiscapacidad: 0,
      irpfPctAtribucion: '100',
      irpfOtrasDeducciones: 0,
    }
  }
  return {
    vigenteDesde: '',
    sueldoNominal: ultima.sueldoNominal,
    fonasaConyuge: ultima.fonasaConyuge,
    fonasaHijos: ultima.fonasaHijos,
    fonasaTasaManual: ultima.fonasaTasaManual === null ? '' : formatRatePercent(ultima.fonasaTasaManual),
    irpfHijos: ultima.irpfHijos,
    irpfHijosDiscapacidad: ultima.irpfHijosDiscapacidad,
    irpfPctAtribucion: ultima.irpfPctAtribucion === 50 ? '50' : '100',
    irpfOtrasDeducciones: ultima.irpfOtrasDeducciones,
  }
}

/** Call after the schema accepted the values. */
export function formACondicionInput(values: CondicionFormValues): CondicionInput {
  const v = condicionFormSchema.parse(values)
  const tasa = v.fonasaTasaManual.trim() === '' ? null : parseRatePercent(v.fonasaTasaManual)
  return {
    vigenteDesde: v.vigenteDesde,
    sueldoNominal: v.sueldoNominal,
    fonasaConyuge: v.fonasaConyuge,
    fonasaHijos: v.fonasaHijos,
    fonasaTasaManual: tasa,
    irpfHijos: v.irpfHijos,
    irpfHijosDiscapacidad: v.irpfHijosDiscapacidad,
    irpfPctAtribucion: Number(v.irpfPctAtribucion) as IrpfPctAtribucion,
    irpfOtrasDeducciones: v.irpfOtrasDeducciones,
  }
}

// ---------------------------------------------------------------- display

/** "2026-03-01" → "01/03/2026". */
export const formatFecha = (iso: string) => dayjs(iso).format('DD/MM/YYYY')

/**
 * The condition in force on `hoy`: the newest one that already started. Conditions are
 * newest first. Returns undefined if all of them start in the future.
 */
export function condicionVigente(condiciones: readonly Condicion[], hoy: string): Condicion | undefined {
  return condiciones.find((c) => c.vigenteDesde <= hoy)
}
