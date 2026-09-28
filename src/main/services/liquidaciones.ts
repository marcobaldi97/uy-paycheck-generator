// Liquidaciones service: creates liquidaciones, computes their recibos with the engine and
// enforces the state rules (borrador ↔ emitida). Main is the single source of truth for numbers.
//
// Resolution date: conditions and parameters are resolved as of the LAST day of the period, so
// a version that starts during the month (e.g. a worker hired on the 15th) applies to it.
//
// Drafts only change on crear, recalcular and actualizarRecibo. Emitida liquidaciones are
// frozen: their recibos carry snapshots of empresa and trabajador, and every write is rejected
// with LIQUIDACION_EMITIDA.

import dayjs from 'dayjs'
import { calcularRecibo, type CalcularReciboResultado } from '@engine/index'
import { AppError } from '@shared/api'
import type {
  CodigoConcepto,
  Condicion,
  Empresa,
  IsoDate,
  Linea,
  Liquidacion,
  LiquidacionDetalle,
  LiquidacionResumen,
  NuevaLiquidacionInput,
  ParametrosVersion,
  Periodo,
  ReciboDetalle,
  ReciboEntradas,
  ReciboImpresion,
  Trabajador,
  TrabajadorSnapshot,
  ValoresCalculados,
} from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { conceptosRepo } from '../repos/conceptos'
import { empresaRepo } from '../repos/empresa'
import { liquidacionesRepo, type ReciboData, type ReciboRow } from '../repos/liquidaciones'
import { parametrosRepo } from '../repos/parametros'
import { trabajadoresRepo } from '../repos/trabajadores'

export const ENTRADAS_VACIAS: ReciboEntradas = { diasNoTrabajados: 0, lineasManuales: [], overrides: null }

const EMPRESA_VACIA: Empresa = { nombre: '', direccion: '', rut: '', nroMtss: '', grupo: '', subgrupo: '' }

/** Date used to resolve conditions and parameters for a period: its last day. */
export function fechaResolucion(periodo: Periodo): IsoDate {
  return dayjs(`${periodo}-01`).endOf('month').format('YYYY-MM-DD')
}

function snapshotTrabajador(t: Trabajador, sueldoNominal: number): TrabajadorSnapshot {
  return {
    id: t.id,
    numero: t.numero,
    ci: t.ci,
    nombre: t.nombre,
    cargo: t.cargo,
    fechaIngreso: t.fechaIngreso,
    afiliacionBps: t.afiliacionBps,
    carpetaBse: t.carpetaBse,
    lugarCobro: t.lugarCobro,
    centroCostos: t.centroCostos,
    lugarTrabajo: t.lugarTrabajo,
    sueldoNominal,
  }
}

function toReciboData(entradas: ReciboEntradas, r: CalcularReciboResultado): ReciboData {
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
  }
}

/**
 * Fallback when the engine can't run for a stored recibo (e.g. its parameters were removed):
 * read the applied values back from the stored lines.
 */
function valoresDesdeLineas(lineas: Linea[], parametros: ParametrosVersion | null): ValoresCalculados {
  const find = (codigo: CodigoConcepto): Linea | undefined => lineas.find((l) => l.codigo === codigo)
  return {
    montepioTasa: find('MONTEPIO')?.cantidad ?? parametros?.montepio ?? '0',
    fonasaTasa: find('FONASA')?.cantidad ?? '0',
    frlTasa: find('FRL')?.cantidad ?? parametros?.frl ?? '0',
    irpfImporte: find('IRPF')?.importe ?? 0,
  }
}

export function liquidacionesService(db: Conn = getDb()) {
  // ------------------------------------------------------------------ helpers (repos on `conn`)

  function getLiquidacion(conn: Conn, id: number): Liquidacion {
    const liq = liquidacionesRepo(conn).get(id)
    if (!liq) throw new AppError('NO_ENCONTRADO', 'Liquidación no encontrada')
    return liq
  }

  function assertBorrador(liq: Liquidacion): void {
    if (liq.estado === 'emitida') {
      throw new AppError(
        'LIQUIDACION_EMITIDA',
        `La liquidación ${liq.periodo} está emitida; reábrala para modificarla`,
      )
    }
  }

  function parametrosDe(conn: Conn, periodo: Periodo): ParametrosVersion {
    const p = parametrosRepo(conn).vigente(fechaResolucion(periodo))
    if (!p) {
      throw new AppError('SIN_PARAMETROS', `No hay parámetros vigentes para el período ${periodo}`, {
        periodo,
        fecha: fechaResolucion(periodo),
      })
    }
    return p
  }

  /** Conditions in force for each worker; throws TRABAJADOR_SIN_CONDICIONES naming the missing ones. */
  function condicionesDe(conn: Conn, periodo: Periodo, workers: Trabajador[]): Map<number, Condicion> {
    const repo = trabajadoresRepo(conn)
    const fecha = fechaResolucion(periodo)
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
  }

  function descripciones(conn: Conn): Partial<Record<CodigoConcepto, string>> {
    const out: Partial<Record<CodigoConcepto, string>> = {}
    for (const c of conceptosRepo(conn).list()) out[c.codigo] = c.descripcion
    return out
  }

  function calcular(
    conn: Conn,
    condicion: Condicion,
    parametros: ParametrosVersion,
    entradas: ReciboEntradas,
  ): CalcularReciboResultado {
    return calcularRecibo({
      condiciones: condicion,
      parametros,
      franjas: parametros.franjas,
      diasNoTrabajados: entradas.diasNoTrabajados,
      lineasManuales: entradas.lineasManuales,
      overrides: entradas.overrides,
      descripciones: descripciones(conn),
    })
  }

  function detalle(conn: Conn, liq: Liquidacion): LiquidacionDetalle {
    const recibos = liquidacionesRepo(conn).listResumen(liq.id)
    const totales = recibos.reduce(
      (acc, r) => ({
        totalHaberes: acc.totalHaberes + r.totalHaberes,
        totalDescuentos: acc.totalDescuentos + r.totalDescuentos,
        liquido: acc.liquido + r.liquido,
      }),
      { totalHaberes: 0, totalDescuentos: 0, liquido: 0 },
    )
    return { liquidacion: liq, recibos, totales }
  }

  function trabajadorDe(conn: Conn, id: number): Trabajador {
    const t = trabajadoresRepo(conn).get(id)
    if (!t) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
    return t
  }

  /**
   * sueldoNominal as printed: the condición vigente on the last day of the period (same rule as
   * pdf.datosImpresion in T7); falls back to the stored SUELDO line if there is no condición.
   */
  function sueldoDe(lineas: Linea[], condicion: Condicion | null): number {
    return condicion?.sueldoNominal ?? lineas.find((l) => l.codigo === 'SUELDO')?.importe ?? 0
  }

  /**
   * Print data, with the same rules as pdf.datosImpresion (T7): snapshots for an emitida, current
   * empresa and worker for a borrador. One difference: with no empresa saved yet, the editor
   * preview gets blank empresa fields instead of an error, so a draft stays editable.
   */
  function impresion(conn: Conn, liq: Liquidacion, row: ReciboRow, lineas: Linea[]): ReciboImpresion {
    let empresa = row.snapshotEmpresa
    let trabajador = row.snapshotTrabajador
    if (!empresa) empresa = empresaRepo(conn).get() ?? EMPRESA_VACIA
    if (!trabajador) {
      const condicion = trabajadoresRepo(conn).condicionVigente(row.trabajadorId, fechaResolucion(liq.periodo))
      trabajador = snapshotTrabajador(trabajadorDe(conn, row.trabajadorId), sueldoDe(lineas, condicion))
    }
    return {
      reciboId: row.id,
      empresa,
      trabajador,
      liquidacion: { periodo: liq.periodo, fechaCargo: liq.fechaCargo, fechaPago: liq.fechaPago },
      lineas,
      totales: row.totales,
    }
  }

  function valoresCalculados(conn: Conn, liq: Liquidacion, row: ReciboRow, lineas: Linea[]): ValoresCalculados {
    const fecha = fechaResolucion(liq.periodo)
    const parametros = parametrosRepo(conn).vigente(fecha)
    const condicion = trabajadoresRepo(conn).condicionVigente(row.trabajadorId, fecha)
    if (!parametros || !condicion) return valoresDesdeLineas(lineas, parametros)
    return calcular(conn, condicion, parametros, row.entradas).valoresCalculados
  }

  function reciboDetalle(conn: Conn, reciboId: number): ReciboDetalle {
    const repo = liquidacionesRepo(conn)
    const row = repo.getRecibo(reciboId)
    if (!row) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
    const liq = getLiquidacion(conn, row.liquidacionId)
    const lineas = repo.getLineas(row.id)
    return {
      id: row.id,
      liquidacionId: row.liquidacionId,
      trabajadorId: row.trabajadorId,
      estado: liq.estado,
      entradas: row.entradas,
      valoresCalculados: valoresCalculados(conn, liq, row, lineas),
      lineas,
      totales: row.totales,
      impresion: impresion(conn, liq, row, lineas),
    }
  }

  // ------------------------------------------------------------------ API

  return {
    /** Newest period first. */
    listar(): LiquidacionResumen[] {
      return liquidacionesRepo(db).list()
    },

    obtener(id: number): LiquidacionDetalle {
      return detalle(db, getLiquidacion(db, id))
    },

    /**
     * New borrador with one recibo per active worker. Fails, in this order, with
     * LIQUIDACION_EXISTENTE, SIN_PARAMETROS, SIN_TRABAJADORES_ACTIVOS or TRABAJADOR_SIN_CONDICIONES.
     */
    crear(input: NuevaLiquidacionInput): Liquidacion {
      return db.transaction((tx) => {
        const repo = liquidacionesRepo(tx)
        if (repo.getByPeriodo(input.periodo)) {
          throw new AppError('LIQUIDACION_EXISTENTE', `Ya existe una liquidación para ${input.periodo}`, {
            periodo: input.periodo,
          })
        }
        const parametros = parametrosDe(tx, input.periodo)
        const workers = trabajadoresRepo(tx).list({ soloActivos: true })
        if (workers.length === 0) {
          throw new AppError('SIN_TRABAJADORES_ACTIVOS', 'No hay trabajadores activos para liquidar')
        }
        const condiciones = condicionesDe(tx, input.periodo, workers)
        const liq = repo.create(input)
        for (const t of workers) {
          const r = calcular(tx, condiciones.get(t.id)!, parametros, ENTRADAS_VACIAS)
          repo.insertRecibo(liq.id, t.id, toReciboData(ENTRADAS_VACIAS, r))
        }
        return liq
      })
    },

    /**
     * Borrador only. Re-resolves conditions and parameters and recomputes every recibo, keeping
     * its entradas and overrides. Active workers without a recibo (added after creation) get one;
     * existing recibos are never removed.
     */
    recalcular(id: number): LiquidacionDetalle {
      return db.transaction((tx) => {
        const liq = getLiquidacion(tx, id)
        assertBorrador(liq)
        const repo = liquidacionesRepo(tx)
        const parametros = parametrosDe(tx, liq.periodo)
        const recibos = repo.listRecibos(id)
        const conRecibo = new Set(recibos.map((r) => r.trabajadorId))
        const nuevos = trabajadoresRepo(tx)
          .list({ soloActivos: true })
          .filter((t) => !conRecibo.has(t.id))
        const workers = [...recibos.map((r) => trabajadorDe(tx, r.trabajadorId)), ...nuevos]
        const condiciones = condicionesDe(tx, liq.periodo, workers)
        for (const r of recibos) {
          const calc = calcular(tx, condiciones.get(r.trabajadorId)!, parametros, r.entradas)
          repo.updateRecibo(r.id, toReciboData(r.entradas, calc))
        }
        for (const t of nuevos) {
          const calc = calcular(tx, condiciones.get(t.id)!, parametros, ENTRADAS_VACIAS)
          repo.insertRecibo(id, t.id, toReciboData(ENTRADAS_VACIAS, calc))
        }
        return detalle(tx, liq)
      })
    },

    /**
     * Borrador → emitida. Snapshots empresa and trabajador on every recibo; lines and totals are
     * kept as they are (no recompute). Requires empresa data (CONFLICTO otherwise).
     */
    emitir(id: number): LiquidacionDetalle {
      return db.transaction((tx) => {
        const liq = getLiquidacion(tx, id)
        assertBorrador(liq)
        const empresa = empresaRepo(tx).get()
        if (!empresa) {
          throw new AppError('CONFLICTO', 'Complete los datos de la empresa antes de emitir la liquidación')
        }
        const repo = liquidacionesRepo(tx)
        const fecha = fechaResolucion(liq.periodo)
        for (const r of repo.listRecibos(id)) {
          const condicion = trabajadoresRepo(tx).condicionVigente(r.trabajadorId, fecha)
          const sueldo = sueldoDe(repo.getLineas(r.id), condicion)
          repo.setSnapshots(r.id, empresa, snapshotTrabajador(trabajadorDe(tx, r.trabajadorId), sueldo))
        }
        return detalle(tx, repo.setEstado(id, 'emitida'))
      })
    },

    /** Emitida → borrador; clears the snapshots. CONFLICTO if it is not emitida. */
    reabrir(id: number): LiquidacionDetalle {
      return db.transaction((tx) => {
        const liq = getLiquidacion(tx, id)
        if (liq.estado !== 'emitida') {
          throw new AppError('CONFLICTO', `La liquidación ${liq.periodo} no está emitida`)
        }
        const repo = liquidacionesRepo(tx)
        for (const r of repo.listRecibos(id)) repo.setSnapshots(r.id, null, null)
        return detalle(tx, repo.setEstado(id, 'borrador'))
      })
    },

    obtenerRecibo(id: number): ReciboDetalle {
      return reciboDetalle(db, id)
    },

    /** Borrador only. Stores the entradas and recomputes the recibo with the period's conditions. */
    actualizarRecibo(id: number, entradas: ReciboEntradas): ReciboDetalle {
      return db.transaction((tx) => {
        const repo = liquidacionesRepo(tx)
        const row = repo.getRecibo(id)
        if (!row) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
        const liq = getLiquidacion(tx, row.liquidacionId)
        assertBorrador(liq)
        const parametros = parametrosDe(tx, liq.periodo)
        const condicion = condicionesDe(tx, liq.periodo, [trabajadorDe(tx, row.trabajadorId)]).get(
          row.trabajadorId,
        )!
        repo.updateRecibo(id, toReciboData(entradas, calcular(tx, condicion, parametros, entradas)))
        return reciboDetalle(tx, id)
      })
    },
  }
}

export type LiquidacionesService = ReturnType<typeof liquidacionesService>
