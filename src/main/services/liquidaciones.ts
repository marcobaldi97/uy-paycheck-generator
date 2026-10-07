// Liquidaciones service: creates liquidaciones, computes their recibos with the engine and
// enforces the state rules (borrador ↔ emitida). Main is the single source of truth for numbers.
//
// How a recibo is calculated, read and frozen lives in ./recibo: conditions and parameters are
// resolved as of the LAST day of the period, and a recibo always shows what it was calculated with.
//
// Drafts only change on crear, recalcular and actualizarRecibo. Emitida liquidaciones are
// frozen: their recibos carry snapshots of empresa and trabajador, and every write is rejected
// with LIQUIDACION_EMITIDA.

import { AppError } from '@shared/api'
import type {
  Liquidacion,
  LiquidacionDetalle,
  LiquidacionResumen,
  NuevaLiquidacionInput,
  ReciboDetalle,
  ReciboEntradas,
  Trabajador,
} from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { empresaRepo } from '../repos/empresa'
import { liquidacionesRepo } from '../repos/liquidaciones'
import { trabajadoresRepo } from '../repos/trabajadores'
import { calcular, congelar, contextoPeriodo, leer } from './recibo'

export const ENTRADAS_VACIAS: ReciboEntradas = { diasNoTrabajados: 0, lineasManuales: [], overrides: null }

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

  function reciboDetalle(conn: Conn, reciboId: number): ReciboDetalle {
    const repo = liquidacionesRepo(conn)
    const row = repo.getRecibo(reciboId)
    if (!row) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
    const liq = getLiquidacion(conn, row.liquidacionId)
    const lineas = repo.getLineas(row.id)
    // Blank empresa fields when none is saved yet, so a draft stays editable.
    const { impresion, valoresCalculados } = leer(conn, liq, row, lineas, { sinEmpresa: 'vacia' })
    return {
      id: row.id,
      liquidacionId: row.liquidacionId,
      trabajadorId: row.trabajadorId,
      estado: liq.estado,
      entradas: row.entradas,
      valoresCalculados,
      lineas,
      totales: row.totales,
      impresion,
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
        const ctx = contextoPeriodo(tx, input.periodo)
        const workers = trabajadoresRepo(tx).list({ soloActivos: true })
        if (workers.length === 0) {
          throw new AppError('SIN_TRABAJADORES_ACTIVOS', 'No hay trabajadores activos para liquidar')
        }
        const condiciones = ctx.condicionesDe(workers)
        const liq = repo.create(input)
        for (const t of workers) {
          repo.insertRecibo(liq.id, t.id, calcular(ctx, condiciones.get(t.id)!, ENTRADAS_VACIAS))
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
        const ctx = contextoPeriodo(tx, liq.periodo)
        const recibos = repo.listRecibos(id)
        const conRecibo = new Set(recibos.map((r) => r.trabajadorId))
        const nuevos = trabajadoresRepo(tx)
          .list({ soloActivos: true })
          .filter((t) => !conRecibo.has(t.id))
        const workers = [...recibos.map((r) => trabajadorDe(tx, r.trabajadorId)), ...nuevos]
        const condiciones = ctx.condicionesDe(workers)
        for (const r of recibos) {
          repo.updateRecibo(r.id, calcular(ctx, condiciones.get(r.trabajadorId)!, r.entradas))
        }
        for (const t of nuevos) {
          repo.insertRecibo(id, t.id, calcular(ctx, condiciones.get(t.id)!, ENTRADAS_VACIAS))
        }
        return detalle(tx, liq)
      })
    },

    /**
     * Borrador → emitida. Snapshots empresa and trabajador (as the draft printed them) on every
     * recibo; lines, totals and valoresCalculados are kept as they are (no recompute). Requires
     * empresa data (CONFLICTO otherwise).
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
        for (const r of repo.listRecibos(id)) {
          const c = congelar(tx, liq, r, repo.getLineas(r.id), empresa)
          repo.setSnapshots(r.id, c.snapshotEmpresa, c.snapshotTrabajador)
          if (r.valoresCalculados === null) repo.setValoresCalculados(r.id, c.valoresCalculados)
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
        const ctx = contextoPeriodo(tx, liq.periodo)
        const condicion = ctx.condicionesDe([trabajadorDe(tx, row.trabajadorId)]).get(row.trabajadorId)!
        repo.updateRecibo(id, calcular(ctx, condicion, entradas))
        return reciboDetalle(tx, id)
      })
    },
  }
}

export type LiquidacionesService = ReturnType<typeof liquidacionesService>
