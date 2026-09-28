// Liquidaciones, their recibos and the printed recibo lines. Pure storage: computing lines and
// state rules (e.g. "no writes to an emitida") belong to the liquidaciones service (T6).

import { asc, count, desc, eq, sum } from 'drizzle-orm'
import { AppError } from '@shared/api'
import type {
  CodigoConcepto,
  Empresa,
  EstadoLiquidacion,
  Linea,
  Liquidacion,
  LiquidacionResumen,
  NuevaLiquidacionInput,
  Overrides,
  Periodo,
  ReciboEntradas,
  ReciboResumen,
  ReciboTotales,
  TrabajadorSnapshot,
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
}

export interface ReciboData {
  entradas: ReciboEntradas
  totales: ReciboTotales
  lineas: Linea[]
}

type ReciboSelect = typeof recibos.$inferSelect

export function tieneOverrides(overrides: Overrides | null | undefined): boolean {
  return !!overrides && Object.values(overrides).some((v) => v !== undefined && v !== null)
}

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
  }
}

export function liquidacionesRepo(db: Conn = getDb()) {
  function conceptoIds(): Map<CodigoConcepto, number> {
    const rows = db.select({ id: conceptos.id, codigo: conceptos.codigo }).from(conceptos).all()
    return new Map(rows.map((r) => [r.codigo, r.id]))
  }

  function insertLineas(reciboId: number, lineas: Linea[]): void {
    if (lineas.length === 0) return
    const ids = conceptoIds()
    db.insert(reciboLineas)
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

    /** New liquidación in borrador. Throws LIQUIDACION_EXISTENTE when the period exists. */
    create(input: NuevaLiquidacionInput): Liquidacion {
      if (this.getByPeriodo(input.periodo)) {
        throw new AppError('LIQUIDACION_EXISTENTE', `Ya existe una liquidación para ${input.periodo}`)
      }
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
        const repo = liquidacionesRepo(tx)
        const row = tx
          .insert(recibos)
          .values({ liquidacionId, trabajadorId, ...reciboColumns(data) })
          .returning()
          .get()
        repo.replaceLineas(row.id, data.lineas)
        return toReciboRow(row)
      })
    },

    /** Replaces inputs, totals and lines of a recibo, atomically. Throws NO_ENCONTRADO. */
    updateRecibo(id: number, data: ReciboData): ReciboRow {
      return db.transaction((tx) => {
        const row = tx.update(recibos).set(reciboColumns(data)).where(eq(recibos.id, id)).returning().get()
        if (!row) throw new AppError('NO_ENCONTRADO', 'Recibo no encontrado')
        liquidacionesRepo(tx).replaceLineas(id, data.lineas)
        return toReciboRow(row)
      })
    },

    replaceLineas(reciboId: number, lineas: Linea[]): void {
      db.delete(reciboLineas).where(eq(reciboLineas.reciboId, reciboId)).run()
      insertLineas(reciboId, lineas)
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

    deleteRecibo(id: number): void {
      db.delete(recibos).where(eq(recibos.id, id)).run()
    },
  }
}

export type LiquidacionesRepo = ReturnType<typeof liquidacionesRepo>
