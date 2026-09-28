// Form model for a parameter version: rates as percent text ("4,5"), BPC multiples as
// UY decimal text ("2,5"), money as cents. Converts to and from ParametrosVersion.

import { formatRatePercent, parseRatePercent } from '@shared/money'
import { isoDateSchema } from '@shared/schemas'
import type { Cents, DecimalString, IsoDate, Parametros, ParametrosVersion, Rate } from '@shared/types'
import dayjs from 'dayjs'
import { z } from 'zod'

/** Scalar fields edited as a percent. */
export const RATE_FIELDS = [
  'montepio',
  'frl',
  'fonasaBajoSinConyuge',
  'fonasaBajoConConyuge',
  'fonasaAltoSinCargas',
  'fonasaAltoHijos',
  'fonasaAltoConyuge',
  'fonasaAltoConyugeHijos',
  'irpfIncremento',
  'irpfTasaDeduccionBaja',
  'irpfTasaDeduccionAlta',
] as const satisfies readonly (keyof Parametros)[]

/** Scalar fields edited as a BPC multiple (decimal). */
export const BPC_FIELDS = [
  'fonasaUmbralBpc',
  'irpfIncrementoUmbralBpc',
  'irpfDeduccionUmbralBpc',
  'irpfHijoBpcAnual',
  'irpfHijoDiscBpcAnual',
] as const satisfies readonly (keyof Parametros)[]

type RateField = (typeof RATE_FIELDS)[number]
type BpcField = (typeof BPC_FIELDS)[number]

export interface FranjaFormValues {
  desdeBpc: string
  /** Empty text = no upper bound. */
  hastaBpc: string
  tasa: string
}

export type ParametrosFormValues = { [K in RateField | BpcField]: string } & {
  bpc: Cents | null
  topeMontepio: Cents | null
  franjas: FranjaFormValues[]
}

// ---------------------------------------------------------------- text helpers

/** "2026-01-01" → "01/01/2026". */
export const formatFecha = (date: IsoDate) => dayjs(date).format('DD/MM/YYYY')

/** Parses "DD/MM/YYYY" (as typed) into "YYYY-MM-DD"; null if it isn't a real date. */
export function parseFechaUy(text: string): IsoDate | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null
  const [, d = '', m = '', y = ''] = match
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  return isoDateSchema.safeParse(iso).success ? iso : null
}

/** "2,5" or "2.5" → "2.5". Null for anything that isn't a non-negative plain number. */
export function parseDecimalText(text: string): DecimalString | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  // Drop redundant zeros ("7.50" → "7.5", "007" → "7") without going through floats.
  const [integer = '0', fraction = ''] = normalized.split('.')
  const int = integer.replace(/^0+(?=\d)/, '')
  const frac = fraction.replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int
}

/** "2.5" → "2,5". */
export function formatDecimalText(value: DecimalString): string {
  return value.replace('.', ',')
}

const isPercent = (text: string) => {
  const rate = parseRatePercent(text)
  return rate !== null && Number(rate) <= 1
}

// ---------------------------------------------------------------- schema

const percentText = z.string().refine(isPercent, 'Porcentaje inválido (0 a 100)')
const bpcText = z.string().refine((t) => parseDecimalText(t) !== null, 'Número inválido')
const optionalBpcText = z.string().refine((t) => t.trim() === '' || parseDecimalText(t) !== null, 'Número inválido')

export const parametrosFormSchema = z.object({
  bpc: z.number({ error: 'Requerido' }).int().min(0, 'No puede ser negativo'),
  topeMontepio: z.number().int().min(0, 'No puede ser negativo').nullable(),
  ...Object.fromEntries(RATE_FIELDS.map((f) => [f, percentText])),
  ...Object.fromEntries(BPC_FIELDS.map((f) => [f, bpcText])),
  franjas: z
    .array(z.object({ desdeBpc: bpcText, hastaBpc: optionalBpcText, tasa: percentText }))
    .min(1, 'Se requiere al menos una franja'),
})

// ---------------------------------------------------------------- conversion

export function toFormValues(version: ParametrosVersion): ParametrosFormValues {
  const values = {
    bpc: version.bpc,
    topeMontepio: version.topeMontepio,
    franjas: version.franjas.map((f) => ({
      desdeBpc: formatDecimalText(f.desdeBpc),
      hastaBpc: f.hastaBpc === null ? '' : formatDecimalText(f.hastaBpc),
      tasa: formatRatePercent(f.tasa),
    })),
  } as ParametrosFormValues
  for (const field of RATE_FIELDS) values[field] = formatRatePercent(version[field])
  for (const field of BPC_FIELDS) values[field] = formatDecimalText(version[field])
  return values
}

/** Expects values that passed `parametrosFormSchema`; throws otherwise. */
export function toVersion(vigenteDesde: IsoDate, values: ParametrosFormValues): ParametrosVersion {
  if (values.bpc === null) throw new Error('bpc is required')
  const version = {
    vigenteDesde,
    bpc: values.bpc,
    topeMontepio: values.topeMontepio,
    franjas: values.franjas.map((f) => ({
      desdeBpc: decimal(f.desdeBpc),
      hastaBpc: f.hastaBpc.trim() === '' ? null : decimal(f.hastaBpc),
      tasa: rate(f.tasa),
    })),
  } as ParametrosVersion
  for (const field of RATE_FIELDS) version[field] = rate(values[field])
  for (const field of BPC_FIELDS) version[field] = decimal(values[field])
  return version
}

function rate(text: string): Rate {
  const value = parseRatePercent(text)
  if (value === null) throw new Error(`Invalid percent: ${text}`)
  return value
}

function decimal(text: string): DecimalString {
  const value = parseDecimalText(text)
  if (value === null) throw new Error(`Invalid decimal: ${text}`)
  return value
}
