// IPC contract between main and renderer. CONTRACT: frozen after T0.
//
// Every method takes zero or one argument and resolves to an ApiResult; it never rejects
// for domain errors. Channel names are `${domain}:${method}`. Inputs are validated in main
// with the matching schema in `schemas.ts`.

import type {
  Cents,
  Condicion,
  CondicionInput,
  Empresa,
  Impresora,
  IsoDate,
  Liquidacion,
  LiquidacionDetalle,
  LiquidacionResumen,
  ModoExportacion,
  NuevaLiquidacionInput,
  ParametrosVersion,
  ReciboDetalle,
  ReciboEntradas,
  ReciboImpresion,
  RespaldoInfo,
  ResultadoExportacion,
  ResultadoRespaldo,
  TasaFonasaPreview,
  Trabajador,
  TrabajadorDetalle,
  TrabajadorInput,
} from './types'

// ---------------------------------------------------------------- results and errors

export type ErrorCode =
  | 'VALIDACION'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'SIN_PARAMETROS'
  | 'SIN_TRABAJADORES_ACTIVOS'
  | 'TRABAJADOR_SIN_CONDICIONES'
  | 'LIQUIDACION_EXISTENTE'
  | 'LIQUIDACION_EMITIDA'
  | 'INTERNO'

export interface ApiError {
  code: ErrorCode
  /** User-facing message, in Spanish. */
  message: string
  /** Extra data, e.g. `{ trabajadores: [{ id, nombre }] }` for TRABAJADOR_SIN_CONDICIONES. */
  details?: Record<string, unknown>
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

/** Throw from main services; the IPC layer turns it into `{ ok: false, error }`. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }

  toApiError(): ApiError {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details }
  }
}

// ---------------------------------------------------------------- spec

type Id = { id: number }

/** Input and output of every IPC method, by domain. `void` input = no argument. */
export interface ApiSpec {
  empresa: {
    obtener: { input: void; output: Empresa | null }
    guardar: { input: Empresa; output: Empresa }
  }
  trabajadores: {
    listar: { input: { soloActivos: boolean }; output: Trabajador[] }
    obtener: { input: Id; output: TrabajadorDetalle }
    crear: { input: TrabajadorInput; output: Trabajador }
    actualizar: { input: { id: number; datos: TrabajadorInput }; output: Trabajador }
    /** Adds a new version; never edits existing rows. */
    nuevaCondicion: { input: { trabajadorId: number; condicion: CondicionInput }; output: Condicion }
    /** Preview for the condición form; the receipt uses the month's imponible instead of the sueldo. */
    tasaFonasa: {
      input: { fecha: IsoDate; sueldoNominal: Cents; fonasaConyuge: boolean; fonasaHijos: boolean }
      output: TasaFonasaPreview
    }
  }
  parametros: {
    /** Newest first. */
    listar: { input: void; output: ParametrosVersion[] }
    /** Duplicates the latest version with a new vigenteDesde. */
    nuevaVersion: { input: { vigenteDesde: string }; output: ParametrosVersion }
    /** Replaces the version identified by vigenteDesde, franjas included. */
    actualizar: { input: ParametrosVersion; output: ParametrosVersion }
  }
  liquidaciones: {
    /** Newest period first. */
    listar: { input: void; output: LiquidacionResumen[] }
    obtener: { input: Id; output: LiquidacionDetalle }
    /** Fails with SIN_PARAMETROS, SIN_TRABAJADORES_ACTIVOS, TRABAJADOR_SIN_CONDICIONES or LIQUIDACION_EXISTENTE. */
    crear: { input: NuevaLiquidacionInput; output: Liquidacion }
    /** Draft only. Re-resolves conditions and parameters; keeps entradas and overrides. */
    recalcular: { input: Id; output: LiquidacionDetalle }
    /** Snapshots empresa and trabajador on every recibo. */
    emitir: { input: Id; output: LiquidacionDetalle }
    reabrir: { input: Id; output: LiquidacionDetalle }
    obtenerRecibo: { input: Id; output: ReciboDetalle }
    /** Draft only (LIQUIDACION_EMITIDA otherwise). Recomputes and returns the recibo. */
    actualizarRecibo: { input: { id: number; entradas: ReciboEntradas }; output: ReciboDetalle }
  }
  pdf: {
    /** Data for the print route. All recibos of the liquidación, or one. */
    datosImpresion: { input: { liquidacionId: number; reciboId: number | null }; output: ReciboImpresion[] }
    /** Called by the print route once every receipt is rendered. */
    listo: { input: void; output: null }
    /** Opens a save dialog in main. */
    exportar: { input: { liquidacionId: number; modo: ModoExportacion }; output: ResultadoExportacion }
    impresoras: { input: void; output: Impresora[] }
    /** impresora null = system dialog. */
    imprimir: {
      input: { liquidacionId: number; reciboId: number | null; impresora: string | null }
      output: null
    }
  }
  respaldo: {
    info: { input: void; output: RespaldoInfo }
    /** Opens a folder dialog in main. */
    crear: { input: void; output: ResultadoRespaldo }
  }
}

export type ApiDomain = keyof ApiSpec
export type ApiMethod<D extends ApiDomain> = keyof ApiSpec[D] & string
export type ApiInput<D extends ApiDomain, M extends ApiMethod<D>> = ApiSpec[D][M] extends {
  input: infer I
}
  ? I
  : never
export type ApiOutput<D extends ApiDomain, M extends ApiMethod<D>> = ApiSpec[D][M] extends {
  output: infer O
}
  ? O
  : never

type ApiFunction<I, O> = [I] extends [void]
  ? () => Promise<ApiResult<O>>
  : (input: I) => Promise<ApiResult<O>>

/** Shape of `window.api`. */
export type Api = {
  [D in ApiDomain]: {
    [M in ApiMethod<D>]: ApiFunction<ApiInput<D, M>, ApiOutput<D, M>>
  }
}

/** Runtime list of methods; the preload builds `window.api` from it. Must match ApiSpec exactly. */
export const API_METHODS = {
  empresa: { obtener: true, guardar: true },
  trabajadores: { listar: true, obtener: true, crear: true, actualizar: true, nuevaCondicion: true, tasaFonasa: true },
  parametros: { listar: true, nuevaVersion: true, actualizar: true },
  liquidaciones: {
    listar: true,
    obtener: true,
    crear: true,
    recalcular: true,
    emitir: true,
    reabrir: true,
    obtenerRecibo: true,
    actualizarRecibo: true,
  },
  pdf: { datosImpresion: true, listo: true, exportar: true, impresoras: true, imprimir: true },
  respaldo: { info: true, crear: true },
} as const satisfies { [D in ApiDomain]: { [M in ApiMethod<D>]: true } }

export function channel(domain: string, method: string): string {
  return `${domain}:${method}`
}
