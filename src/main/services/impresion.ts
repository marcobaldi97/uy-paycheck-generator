// Builds ReciboImpresion, the data a printed receipt shows. Shared by the editor preview
// (liquidaciones.obtenerRecibo → ReciboDetalle.impresion) and the print route
// (pdf.datosImpresion) so both always show the same receipt.
//
// Rules: an emitida recibo uses its stored snapshots of empresa and trabajador. A borrador uses
// the current empresa and worker, with the sueldo nominal from the condición in force on the
// last day of the period (falling back to the stored SUELDO line).

import dayjs from 'dayjs'
import { AppError } from '@shared/api'
import type {
  Condicion,
  Empresa,
  IsoDate,
  Linea,
  Liquidacion,
  Periodo,
  ReciboImpresion,
  Trabajador,
  TrabajadorSnapshot,
} from '@shared/types'
import type { Conn } from '../db/connection'
import { empresaRepo } from '../repos/empresa'
import type { ReciboRow } from '../repos/liquidaciones'
import { trabajadoresRepo } from '../repos/trabajadores'

export const EMPRESA_VACIA: Empresa = { nombre: '', direccion: '', rut: '', nroMtss: '', afiliacionBps: '', carpetaBse: '', grupo: '', subgrupo: '' }

/** Date used to resolve conditions and parameters for a period: its last day. */
export function fechaResolucion(periodo: Periodo): IsoDate {
  return dayjs(`${periodo}-01`).endOf('month').format('YYYY-MM-DD')
}

export function snapshotTrabajador(t: Trabajador, sueldoNominal: number): TrabajadorSnapshot {
  return {
    id: t.id,
    numero: t.numero,
    ci: t.ci,
    nombre: t.nombre,
    cargo: t.cargo,
    fechaIngreso: t.fechaIngreso,
    sueldoNominal,
  }
}

/** sueldoNominal as printed: the condición vigente, else the stored SUELDO line, else 0. */
export function sueldoImpreso(lineas: Linea[], condicion: Condicion | null): number {
  return condicion?.sueldoNominal ?? lineas.find((l) => l.codigo === 'SUELDO')?.importe ?? 0
}

export interface OpcionesImpresion {
  /**
   * What to do for a borrador when no empresa is saved yet. `vacia`: blank fields (the editor
   * preview stays usable before empresa setup). `error`: NO_ENCONTRADO (printing and PDF).
   */
  sinEmpresa: 'vacia' | 'error'
}

/**
 * Returns a builder for the recibos of one liquidación. The current empresa is read at most
 * once per builder. Throws NO_ENCONTRADO for a missing worker (or empresa with `sinEmpresa: 'error'`).
 */
export function constructorImpresion(
  conn: Conn,
  liq: Liquidacion,
  { sinEmpresa }: OpcionesImpresion,
): (row: ReciboRow, lineas: Linea[]) => ReciboImpresion {
  let empresaActual: Empresa | null | undefined
  const getEmpresaActual = (): Empresa => {
    if (empresaActual === undefined) empresaActual = empresaRepo(conn).get()
    if (empresaActual) return empresaActual
    if (sinEmpresa === 'vacia') return EMPRESA_VACIA
    throw new AppError('NO_ENCONTRADO', 'Complete los datos de la empresa antes de imprimir')
  }

  const trabajadorActual = (row: ReciboRow, lineas: Linea[]): TrabajadorSnapshot => {
    const repo = trabajadoresRepo(conn)
    const trabajador = repo.get(row.trabajadorId)
    if (!trabajador) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
    const condicion = repo.condicionVigente(row.trabajadorId, fechaResolucion(liq.periodo))
    return snapshotTrabajador(trabajador, sueldoImpreso(lineas, condicion))
  }

  return (row, lineas) => ({
    reciboId: row.id,
    empresa: row.snapshotEmpresa ?? getEmpresaActual(),
    trabajador: row.snapshotTrabajador ?? trabajadorActual(row, lineas),
    liquidacion: { periodo: liq.periodo, fechaCargo: liq.fechaCargo, fechaPago: liq.fechaPago },
    lineas,
    totales: row.totales,
  })
}
