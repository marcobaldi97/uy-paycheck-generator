// Zod schemas shared by forms (renderer) and IPC handlers (main).
// `inputSchemas` has one entry per API method; the main IPC helper validates with it.

import { z } from 'zod'
import type { ApiDomain, ApiInput, ApiMethod } from './api'
import type {
  CondicionInput,
  Empresa,
  FranjaIrpf,
  LineaManual,
  NuevaLiquidacionInput,
  Overrides,
  ParametrosVersion,
  ReciboEntradas,
  TrabajadorInput,
} from './types'

// ---------------------------------------------------------------- primitives

export const centsSchema = z.number().int('Debe ser un importe en centésimos enteros')
export const nonNegativeCentsSchema = centsSchema.min(0, 'No puede ser negativo')
export const decimalStringSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Número inválido')
export const rateSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Tasa inválida')
  .refine((v) => Number(v) <= 1, 'La tasa debe estar entre 0 y 1')
export const isoDateSchema = z.iso.date('Fecha inválida')
export const periodoSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período inválido (AAAA-MM)')
export const idSchema = z.number().int().positive()
const requiredText = z.string().trim().min(1, 'Requerido')

// ---------------------------------------------------------------- domain

export const empresaSchema = z.object({
  nombre: requiredText,
  direccion: z.string().trim(),
  rut: requiredText,
  nroMtss: z.string().trim(),
  afiliacionBps: z.string().trim(),
  carpetaBse: z.string().trim(),
  grupo: z.string().trim(),
  subgrupo: z.string().trim(),
}) satisfies z.ZodType<Empresa>

export const trabajadorInputSchema = z.object({
  numero: z.number().int().positive(),
  ci: requiredText,
  nombre: requiredText,
  cargo: z.string().trim(),
  fechaIngreso: isoDateSchema,
  activo: z.boolean(),
}) satisfies z.ZodType<TrabajadorInput>

export const condicionInputSchema = z.object({
  vigenteDesde: isoDateSchema,
  sueldoNominal: nonNegativeCentsSchema,
  fonasaConyuge: z.boolean(),
  fonasaHijos: z.boolean(),
  fonasaTasaManual: rateSchema.nullable(),
  irpfHijos: z.number().int().min(0),
  irpfHijosDiscapacidad: z.number().int().min(0),
  irpfPctAtribucion: z.union([z.literal(100), z.literal(50)]),
  irpfOtrasDeducciones: nonNegativeCentsSchema,
}) satisfies z.ZodType<CondicionInput>

export const franjaIrpfSchema = z.object({
  desdeBpc: decimalStringSchema,
  hastaBpc: decimalStringSchema.nullable(),
  tasa: rateSchema,
}) satisfies z.ZodType<FranjaIrpf>

export const parametrosVersionSchema = z.object({
  vigenteDesde: isoDateSchema,
  bpc: nonNegativeCentsSchema,
  montepio: rateSchema,
  frl: rateSchema,
  topeMontepio: nonNegativeCentsSchema.nullable(),
  fonasaUmbralBpc: decimalStringSchema,
  fonasaBajoSinConyuge: rateSchema,
  fonasaBajoConConyuge: rateSchema,
  fonasaAltoSinCargas: rateSchema,
  fonasaAltoHijos: rateSchema,
  fonasaAltoConyuge: rateSchema,
  fonasaAltoConyugeHijos: rateSchema,
  irpfIncrementoUmbralBpc: decimalStringSchema,
  irpfIncremento: rateSchema,
  irpfDeduccionUmbralBpc: decimalStringSchema,
  irpfTasaDeduccionBaja: rateSchema,
  irpfTasaDeduccionAlta: rateSchema,
  irpfHijoBpcAnual: decimalStringSchema,
  irpfHijoDiscBpcAnual: decimalStringSchema,
  franjas: z.array(franjaIrpfSchema).min(1, 'Se requiere al menos una franja'),
}) satisfies z.ZodType<ParametrosVersion>

export const lineaManualSchema = z.object({
  descripcion: requiredText,
  tipo: z.enum(['haber', 'descuento']),
  cantidad: decimalStringSchema.nullable(),
  valorUnitario: centsSchema.nullable(),
  importe: centsSchema,
  gravadoBps: z.boolean(),
  gravadoIrpf: z.boolean(),
}) satisfies z.ZodType<LineaManual>

export const overridesSchema = z.object({
  montepioTasa: rateSchema.optional(),
  fonasaTasa: rateSchema.optional(),
  frlTasa: rateSchema.optional(),
  irpfImporte: nonNegativeCentsSchema.optional(),
}) satisfies z.ZodType<Overrides>

export const reciboEntradasSchema = z.object({
  diasNoTrabajados: z.number().int().min(0).max(30),
  lineasManuales: z.array(lineaManualSchema),
  overrides: overridesSchema.nullable(),
}) satisfies z.ZodType<ReciboEntradas>

export const nuevaLiquidacionSchema = z.object({
  periodo: periodoSchema,
  fechaCargo: isoDateSchema,
  fechaPago: isoDateSchema,
}) satisfies z.ZodType<NuevaLiquidacionInput>

// ---------------------------------------------------------------- IPC inputs

const noInput = z.undefined()
const byId = z.object({ id: idSchema })

type InputSchemas = {
  [D in ApiDomain]: { [M in ApiMethod<D>]: z.ZodType<ApiInput<D, M>> }
}

export const inputSchemas = {
  empresa: {
    obtener: noInput,
    guardar: empresaSchema,
  },
  trabajadores: {
    listar: z.object({ soloActivos: z.boolean() }),
    obtener: byId,
    crear: trabajadorInputSchema,
    actualizar: z.object({ id: idSchema, datos: trabajadorInputSchema }),
    nuevaCondicion: z.object({ trabajadorId: idSchema, condicion: condicionInputSchema }),
    tasaFonasa: z.object({
      fecha: isoDateSchema,
      sueldoNominal: nonNegativeCentsSchema,
      fonasaConyuge: z.boolean(),
      fonasaHijos: z.boolean(),
    }),
  },
  parametros: {
    listar: noInput,
    nuevaVersion: z.object({ vigenteDesde: isoDateSchema }),
    actualizar: parametrosVersionSchema,
  },
  liquidaciones: {
    listar: noInput,
    obtener: byId,
    crear: nuevaLiquidacionSchema,
    recalcular: byId,
    emitir: byId,
    reabrir: byId,
    obtenerRecibo: byId,
    actualizarRecibo: z.object({ id: idSchema, entradas: reciboEntradasSchema }),
  },
  pdf: {
    datosImpresion: z.object({ liquidacionId: idSchema, reciboId: idSchema.nullable() }),
    listo: noInput,
    exportar: z.object({ liquidacionId: idSchema, modo: z.enum(['unico', 'por_trabajador']) }),
    impresoras: noInput,
    imprimir: z.object({
      liquidacionId: idSchema,
      reciboId: idSchema.nullable(),
      impresora: z.string().min(1).nullable(),
    }),
  },
  respaldo: {
    info: noInput,
    crear: noInput,
  },
} satisfies InputSchemas
