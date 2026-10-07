// Liquidaciones, their recibos and the printed recibo lines. Pure storage: computing lines and
// state rules (e.g. "no writes to an emitida") belong to the liquidaciones service (T6).

import { asc, count, desc, eq, sum } from 'drizzle-orm'
import { AppError } from '@shared/api'
import { tieneOverrides } from '@shared/conceptos'
import type {
  CodigoConcepto,
  Empresa,
  EstadoLiquidacion,
  Linea,
  Liquidacion,
  LiquidacionResumen,
  NuevaLiquidacionInput,
  Periodo,
  ReciboEntradas,
  ReciboResumen,
  ReciboTotales,
  TrabajadorSnapshot,
  ValoresCalculados,
} from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { conceptos, liquidaciones, reciboLineas, recibos, trabajadores } from '../db/schema'

/** A stored recibo, without its lines. */
export interface ReciboRow {
  id: number
  liquidacionId: number
  trabajadorId: number
  entradas: ReciboEntradas
  totales: ReciboTotales
  /** Null until the liquidación is emitida. */
  snapshotEmpresa: Empresa | null
  snapshotTrabajador: TrabajadorSnapshot | null
  /** Engine values without overrides from the last calculation. Null on pre-migration rows. */
  valoresCalculados: ValoresCalculados | null
}

/** Everything a calculation stores. */
export interface ReciboData {
  entradas: ReciboEntradas
  totales: ReciboTotales
  lineas: Linea[]
  valoresCalculados: ValoresCalculados
}

type ReciboSelect = typeof recibos.$inferSelect

function toReciboRow(r: ReciboSelect): ReciboRow {
  return {
    id: r.id,
    liquidacionId: r.liquidacionId,
    trabajadorId: r.trabajadorId,
    entradas: {
      diasNoTrabajados: r.diasNoTrabajados,
      lineasManuales: r.lineasManuales,
      overrides: tieneOverrides(r.overrides) ? r.overrides : null,
    },
    totales: {
      imponibleBps: r.imponibleBps,
      imponibleIrpf: r.imponibleIrpf,
      totalHaberes: r.totalHaberes,
      totalDescuentos: r.totalDescuentos,
      liquido: r.liquido,
    },
    snapshotEmpresa: r.snapshotEmpresa ?? null,
    snapshotTrabajador: r.snapshotTrabajador ?? null,
    valoresCalculados: r.valoresCalculados ?? null,
  }
}

function reciboColumns(data: Omit<ReciboData, 'lineas'>) {
  return {
    diasNoTrabajados: data.entradas.diasNoTrabajados,
    lineasManuales: data.entradas.lineasManuales,
    overrides: tieneOverrides(data.entradas.overrides) ? data.entradas.overrides : null,
    imponibleBps: data.totales.imponibleBps,
    imponibleIrpf: data.totales.imponibleIrpf,
    totalHaberes: data.totales.totalHaberes,
    totalDescuentos: data.totales.totalDescuentos,
    liquido: data.totales.liquido,
    valoresCalculados: data.valoresCalculados,
  }
}

export function liquidacionesRepo(db: Conn = getDb()) {
  // The conceptos catalog is seeded and never edited: its ids are read once per repo instance.
  let conceptoIdsCache: Map<CodigoConcepto, number> | undefined
  function conceptoIds(conn: Conn): Map<CodigoConcepto, number> {
    if (!conceptoIdsCache) {
      const rows = conn.select({ id: conceptos.id, codigo: conceptos.codigo }).from(conceptos).all()
      conceptoIdsCache = new Map(rows.map((r) => [r.codigo, r.id]))
    }
    return conceptoIdsCache
  }

  /** Replaces the lines of a recibo on `conn` (this repo's connection or a transaction of it). */
  function writeLineas(conn: Conn, reciboId: number, lineas: Linea[]): void {
    conn.delete(reciboLineas).where(eq(reciboLineas.reciboId, reciboId)).run()
    if (lineas.length === 0) return
    const ids = conceptoIds(conn)
    conn.insert(reciboLineas)
      .values(
        lineas.map((l) => {
          let conceptoId: number | null = null
          if (l.codigo !== null) {
            conceptoId = ids.get(l.codigo) ?? null
            if (conceptoId === null) throw new Error(`Unknown concepto ${l.codigo}`)
          }
          return {
            reciboId,
            conceptoId,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            valorUnitario: l.valorUnitario,
            importe: l.importe,
            tipo: l.tipo,
            orden: l.orden,
            origen: l.origen,
            override: l.override,
          }
        }),
      )
      .run()
  }

  return {
    // ------------------------------------------------------------ liquidaciones

    /** Newest period first, with receipt count and total líquido. */
    list(): LiquidacionResumen[] {
      const rows = db
        .select({
          id: liquidaciones.id,
          periodo: liquidaciones.periodo,
          fechaCargo: liquidaciones.fechaCargo,
          fechaPago: liquidaciones.fechaPago,
          estado: liquidaciones.estado,
          cantidadRecibos: count(recibos.id),
          totalLiquido: sum(recibos.liquido),
        })
        .from(liquidaciones)
        .leftJoin(recibos, eq(recibos.liquidacionId, liquidaciones.id))
        .groupBy(liquidaciones.id)
        .orderBy(desc(liquidaciones.periodo))
        .all()
      return rows.map((r) => ({ ...r, totalLiquido: Number(r.totalLiquido ?? 0) }))
    },

    get(id: number): Liquidacion | null {
      return db.select().from(liquidaciones).where(eq(liquidaciones.id, id)).get() ?? null
    },

    getByPeriodo(periodo: Periodo): Liquidacion | null {
      return db.select().from(liquidaciones).where(eq(liquidaciones.periodo, periodo)).get() ?? null
    },

    /**
     * New liquidación in borrador. The service checks the period first (LIQUIDACION_EXISTENTE);
     * the unique index rejects a duplicate anyway.
     */
    create(input: NuevaLiquidacionInput): Liquidacion {
      return db
        .insert(liquidaciones)
        .values({
          periodo: input.periodo,
          fechaCargo: input.fechaCargo,
          fechaPago: input.fechaPago,
          estado: 'borrador',
        })
        .returning()
        .get()
    },

    /** Throws NO_ENCONTRADO. */
    setEstado(id: number, estado: EstadoLiquidacion): Liquidacion {
      const row = db.update(liquidaciones).set({ estado }).where(eq(liquidaciones.id, id)).returning().get()
      if (!row) throw new AppError('NO_ENCONTRADO', 'Liquidación no encontrada')
      return row
    },

    /** Deletes the liquidación with its recibos and lines. */
    delete(id: number): void {
      db.delete(liquidaciones).where(eq(liquidaciones.id, id)).run()
    },

    // ------------------------------------------------------------ recibos

    /**
     * One row per recibo, ordered by worker número. The name comes from the snapshot when the
     * liquidación is emitida, otherwise from the current worker.
     */
    listResumen(liquidacionId: number): ReciboResumen[] {
      const rows = db
        .select({ recibo: recibos, nombre: trabajadores.nombre })
        .from(recibos)
        .innerJoin(trabajadores, eq(trabajadores.id, recibos.trabajadorId))
        .where(eq(recibos.liquidacionId, liquidacionId))
        .orderBy(asc(trabajadores.numero))
        .all()
      return rows.map(({ recibo, nombre }) => ({
        id: recibo.id,
        trabajadorId: recibo.trabajadorId,
        trabajadorNombre: recibo.snapshotTrabajador?.nombre ?? nombre,
        totalHaberes: recibo.totalHaberes,
        totalDescuentos: recibo.totalDescuentos,
        liquido: recibo.liquido,
        tieneOverrides: tieneOverrides(recibo.overrides),
      }))
    },

    /** Ordered by worker número. */
    listRecibos(liquidacionId: number): ReciboRow[] {
      return db
        .select({ recibo: recibos })
        .from(recibos)
        .innerJoin(trabajadores, eq(trabajadores.id, recibos.trabajadorId))
        .where(eq(recibos.liquidacionId, liquidacionId))
        .orderBy(asc(trabajadores.numero))
        .all()
        .map((r) => toReciboRow(r.recibo))
    },

    getRecibo(id: number): ReciboRow | null {
      const row = db.select().from(recibos).where(eq(recibos.id, id)).get()
      return row ? toReciboRow(row) : null
    },

    /** Ordered by `orden`. */
    getLineas(reciboId: number): Linea[] {
      return db
        .select({ linea: reciboLineas, codigo: conceptos.codigo })
        .from(reciboLineas)
        .leftJoin(conceptos, eq(conceptos.id, reciboLineas.conceptoId))
        .where(eq(reciboLineas.reciboId, reciboId))
        .orderBy(asc(reciboLineas.orden), asc(reciboLineas.id))
        .all()
        .map(({ linea, codigo }) => ({
          codigo: codigo ?? null,
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          valorUnitario: linea.valorUnitario,
          importe: linea.importe,
          tipo: linea.tipo,
          orden: linea.orden,
          origen: linea.origen,
          override: linea.override,
        }))
    },

    /** Inserts a recibo with its lines, atomically. */
    insertRecibo(liquidacionId: number, trabajadorId: number, data: ReciboData): ReciboRow {
      return db.transaction((tx) => {
        const row = tx
          .insert(recibos)
          .values({ liquidacionId, trabajadorId, ...reciboColumns(data) })
          .returning()
          .get()
        writeLineas(tx, row.id, data.lineas)
        return toReciboRow(row)
      })
    },

    /** Replaces inputs, totals, valoresCalculados and lines of a recibo, atomically. Throws NO_ENCONTRADO. */
    updateRecibo(id: number, data: ReciboData): ReciboRow {
      return db.transaction((tx) => {
        const row = tx.update(recibos).set(reciboColumns(data)).where(eq(recibos.id, id)).returning().get()
        if (!row) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
        writeLineas(tx, id, data.lineas)
        return toReciboRow(row)
      })
    },

    /** Sets (emitir) or clears (reabrir, with nulls) the snapshots. Throws NO_ENCONTRADO. */
    setSnapshots(id: number, empresa: Empresa | null, trabajador: TrabajadorSnapshot | null): void {
      const result = db
        .update(recibos)
        .set({ snapshotEmpresa: empresa, snapshotTrabajador: trabajador })
        .where(eq(recibos.id, id))
        .run()
      if (result.changes === 0) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
    },

    /** Stores the valoresCalculados alone (emitir freezes them on pre-migration rows). Throws NO_ENCONTRADO. */
    setValoresCalculados(id: number, valores: ValoresCalculados): void {
      const result = db.update(recibos).set({ valoresCalculados: valores }).where(eq(recibos.id, id)).run()
      if (result.changes === 0) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
    },

    deleteRecibo(id: number): void {
      db.delete(recibos).where(eq(recibos.id, id)).run()
    },
  }
}

export type LiquidacionesRepo = ReturnType<typeof liquidacionesRepo>
