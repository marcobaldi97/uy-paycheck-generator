// Recibo module: turns a worker's condición and entradas into a stored recibo, and a stored
// recibo back into what the editor and the printed receipt show. Used by the liquidaciones
// service (crear, recalcular, actualizarRecibo, emitir, obtenerRecibo) and by pdf.datosImpresion,
// so the editor preview and the print route always show the same receipt.
//
// Rules:
// - Numbers come from what the recibo was calculated with: lines, totals, valoresCalculados and
//   the printed sueldo nominal (the stored SUELDO line). A new condición or parameter version
//   reaches a draft only when it is recalculated, never on read.
// - Identity data (empresa, worker name, CI, cargo…) is current for a borrador and the snapshot
//   taken by emitir for an emitida.
// - Conditions and parameters are resolved as of the last day of the period (`fechaResolucion`).

import { calcularRecibo } from '@engine/index'
import { AppError } from '@shared/api'
import { fechaResolucion } from '@shared/periodo'
import type {
  CodigoConcepto,
  Condicion,
  Empresa,
  IsoDate,
  Linea,
  Liquidacion,
  ParametrosVersion,
  Periodo,
  ReciboEntradas,
  ReciboImpresion,
  Trabajador,
  TrabajadorSnapshot,
  ValoresCalculados,
} from '@shared/types'
import type { Conn } from '../db/connection'
import { conceptosRepo } from '../repos/conceptos'
import { empresaRepo } from '../repos/empresa'
import type { ReciboData, ReciboRow } from '../repos/liquidaciones'
import { parametrosRepo } from '../repos/parametros'
import { trabajadoresRepo } from '../repos/trabajadores'

export const EMPRESA_VACIA: Empresa = { nombre: '', direccion: '', rut: '', nroMtss: '', afiliacionBps: '', carpetaBse: '', grupo: '', subgrupo: '' }

// ---------------------------------------------------------------- calculating

/** What every recibo of one period is calculated with, resolved once per operation. */
export interface ContextoPeriodo {
  periodo: Periodo
  fecha: IsoDate
  parametros: ParametrosVersion
  /** Printed descriptions of the auto lines, from `conceptos`. */
  descripciones: Partial<Record<CodigoConcepto, string>>
  /** Conditions in force for each worker; throws TRABAJADOR_SIN_CONDICIONES naming the missing ones. */
  condicionesDe(workers: Trabajador[]): Map<number, Condicion>
}

/** Throws SIN_PARAMETROS when no parameter version is in force for the period. */
export function contextoPeriodo(conn: Conn, periodo: Periodo): ContextoPeriodo {
  const fecha = fechaResolucion(periodo)
  const parametros = parametrosRepo(conn).vigente(fecha)
  if (!parametros) {
    throw new AppError('SIN_PARAMETROS', `No hay parámetros vigentes para el período ${periodo}`, {
      periodo,
      fecha,
    })
  }
  const descripciones: Partial<Record<CodigoConcepto, string>> = {}
  for (const c of conceptosRepo(conn).list()) descripciones[c.codigo] = c.descripcion

  return {
    periodo,
    fecha,
    parametros,
    descripciones,
    condicionesDe(workers) {
      const repo = trabajadoresRepo(conn)
      const result = new Map<number, Condicion>()
      const faltantes: { id: number; nombre: string }[] = []
      for (const t of workers) {
        const c = repo.condicionVigente(t.id, fecha)
        if (c) result.set(t.id, c)
        else faltantes.push({ id: t.id, nombre: t.nombre })
      }
      if (faltantes.length > 0) {
        const nombres = faltantes.map((f) => f.nombre).join(', ')
        throw new AppError(
          'TRABAJADOR_SIN_CONDICIONES',
          faltantes.length === 1
            ? `El trabajador ${nombres} no tiene condiciones vigentes para el período ${periodo}`
            : `Los trabajadores ${nombres} no tienen condiciones vigentes para el período ${periodo}`,
          { trabajadores: faltantes, periodo },
        )
      }
      return result
    },
  }
}

/** Runs the engine: everything a recibo stores. */
export function calcular(ctx: ContextoPeriodo, condicion: Condicion, entradas: ReciboEntradas): ReciboData {
  const r = calcularRecibo({
    condiciones: condicion,
    parametros: ctx.parametros,
    franjas: ctx.parametros.franjas,
    diasNoTrabajados: entradas.diasNoTrabajados,
    lineasManuales: entradas.lineasManuales,
    overrides: entradas.overrides,
    descripciones: ctx.descripciones,
  })
  return {
    entradas,
    lineas: r.lineas,
    totales: {
      imponibleBps: r.imponibleBps,
      imponibleIrpf: r.imponibleIrpf,
      totalHaberes: r.totalHaberes,
      totalDescuentos: r.totalDescuentos,
      liquido: r.liquido,
    },
    valoresCalculados: r.valoresCalculados,
  }
}

// ---------------------------------------------------------------- reading

export interface ReciboLeido {
  impresion: ReciboImpresion
  valoresCalculados: ValoresCalculados
}

export interface OpcionesLectura {
  /**
   * What to do for a borrador when no empresa is saved yet. `vacia`: blank fields (the editor
   * preview stays usable before empresa setup). `error`: NO_ENCONTRADO (printing and PDF).
   */
  sinEmpresa: 'vacia' | 'error'
}

/** The sueldo nominal the recibo was calculated with: its SUELDO line (the engine always emits one). */
function sueldoCalculado(lineas: Linea[]): number {
  return lineas.find((l) => l.codigo === 'SUELDO')?.importe ?? 0
}

/** The worker as printed on a borrador: current identity data, sueldo from the stored lines. */
function trabajadorActual(conn: Conn, row: ReciboRow, lineas: Linea[]): TrabajadorSnapshot {
  const t = trabajadoresRepo(conn).get(row.trabajadorId)
  if (!t) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
  return {
    id: t.id,
    numero: t.numero,
    ci: t.ci,
    nombre: t.nombre,
    cargo: t.cargo,
    fechaIngreso: t.fechaIngreso,
    sueldoNominal: sueldoCalculado(lineas),
  }
}

/**
 * Pre-migration fallback for rows whose `valores_calculados` is NULL (stored before migration
 * 0005): re-runs the engine with today's condición and parámetros, else reads the values back
 * from the lines. Drafts fill the column on Recalcular or any edit, and emitir freezes it, so this
 * can be deleted once every pre-migration draft was recalculated or emitted.
 */
function valoresSinGuardar(conn: Conn, liq: Liquidacion, row: ReciboRow, lineas: Linea[]): ValoresCalculados {
  const fecha = fechaResolucion(liq.periodo)
  const parametros = parametrosRepo(conn).vigente(fecha)
  const condicion = trabajadoresRepo(conn).condicionVigente(row.trabajadorId, fecha)
  if (parametros && condicion) {
    return calcularRecibo({
      condiciones: condicion,
      parametros,
      franjas: parametros.franjas,
      diasNoTrabajados: row.entradas.diasNoTrabajados,
      lineasManuales: row.entradas.lineasManuales,
      overrides: row.entradas.overrides,
    }).valoresCalculados
  }
  const find = (codigo: CodigoConcepto): Linea | undefined => lineas.find((l) => l.codigo === codigo)
  return {
    montepioTasa: find('MONTEPIO')?.cantidad ?? parametros?.montepio ?? '0',
    fonasaTasa: find('FONASA')?.cantidad ?? '0',
    frlTasa: find('FRL')?.cantidad ?? parametros?.frl ?? '0',
    irpfImporte: find('IRPF')?.importe ?? 0,
  }
}

/**
 * Returns a reader for the stored recibos of one liquidación. The current empresa is read at
 * most once per reader. Throws NO_ENCONTRADO for a missing worker (or empresa with
 * `sinEmpresa: 'error'`).
 */
export function lector(
  conn: Conn,
  liq: Liquidacion,
  { sinEmpresa }: OpcionesLectura,
): (row: ReciboRow, lineas: Linea[]) => ReciboLeido {
  let empresaActual: Empresa | null | undefined
  const getEmpresaActual = (): Empresa => {
    if (empresaActual === undefined) empresaActual = empresaRepo(conn).get()
    if (empresaActual) return empresaActual
    if (sinEmpresa === 'vacia') return EMPRESA_VACIA
    throw new AppError('NO_ENCONTRADO', 'Complete los datos de la empresa antes de imprimir')
  }

  return (row, lineas) => ({
    impresion: {
      reciboId: row.id,
      empresa: row.snapshotEmpresa ?? getEmpresaActual(),
      trabajador: row.snapshotTrabajador ?? trabajadorActual(conn, row, lineas),
      liquidacion: { periodo: liq.periodo, fechaCargo: liq.fechaCargo, fechaPago: liq.fechaPago },
      lineas,
      totales: row.totales,
    },
    valoresCalculados: row.valoresCalculados ?? valoresSinGuardar(conn, liq, row, lineas),
  })
}

/** Reads one stored recibo. See `lector`. */
export function leer(conn: Conn, liq: Liquidacion, row: ReciboRow, lineas: Linea[], opciones: OpcionesLectura): ReciboLeido {
  return lector(conn, liq, opciones)(row, lineas)
}

// ---------------------------------------------------------------- emitir

export interface Congelado {
  snapshotEmpresa: Empresa
  snapshotTrabajador: TrabajadorSnapshot
  valoresCalculados: ValoresCalculados
}

/**
 * What emitir stores so the recibo never changes afterwards: the empresa, the worker exactly as
 * the draft printed it, and its valoresCalculados. Throws NO_ENCONTRADO for a missing worker.
 */
export function congelar(conn: Conn, liq: Liquidacion, row: ReciboRow, lineas: Linea[], empresa: Empresa): Congelado {
  return {
    snapshotEmpresa: empresa,
    snapshotTrabajador: trabajadorActual(conn, row, lineas),
    valoresCalculados: row.valoresCalculados ?? valoresSinGuardar(conn, liq, row, lineas),
  }
}
