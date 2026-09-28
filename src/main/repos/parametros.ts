import { asc, desc, eq, lte } from 'drizzle-orm'
import { AppError } from '@shared/api'
import type { FranjaIrpf, IsoDate, Parametros, ParametrosVersion } from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { irpfFranjas, parametros } from '../db/schema'

type ParametrosRow = typeof parametros.$inferSelect

function scalars(v: ParametrosVersion): Parametros {
  return {
    vigenteDesde: v.vigenteDesde,
    bpc: v.bpc,
    montepio: v.montepio,
    frl: v.frl,
    topeMontepio: v.topeMontepio,
    fonasaUmbralBpc: v.fonasaUmbralBpc,
    fonasaBajoSinConyuge: v.fonasaBajoSinConyuge,
    fonasaBajoConConyuge: v.fonasaBajoConConyuge,
    fonasaAltoSinCargas: v.fonasaAltoSinCargas,
    fonasaAltoHijos: v.fonasaAltoHijos,
    fonasaAltoConyuge: v.fonasaAltoConyuge,
    fonasaAltoConyugeHijos: v.fonasaAltoConyugeHijos,
    irpfIncrementoUmbralBpc: v.irpfIncrementoUmbralBpc,
    irpfIncremento: v.irpfIncremento,
    irpfDeduccionUmbralBpc: v.irpfDeduccionUmbralBpc,
    irpfTasaDeduccionBaja: v.irpfTasaDeduccionBaja,
    irpfTasaDeduccionAlta: v.irpfTasaDeduccionAlta,
    irpfHijoBpcAnual: v.irpfHijoBpcAnual,
    irpfHijoDiscBpcAnual: v.irpfHijoDiscBpcAnual,
  }
}

/** Brackets sorted numerically by desdeBpc (they are stored as decimal strings). */
function sortFranjas(franjas: FranjaIrpf[]): FranjaIrpf[] {
  return [...franjas].sort((a, b) => Number(a.desdeBpc) - Number(b.desdeBpc))
}

export function parametrosRepo(db: Conn = getDb()) {
  function franjasOf(vigenteDesde: IsoDate): FranjaIrpf[] {
    const rows = db
      .select({ desdeBpc: irpfFranjas.desdeBpc, hastaBpc: irpfFranjas.hastaBpc, tasa: irpfFranjas.tasa })
      .from(irpfFranjas)
      .where(eq(irpfFranjas.vigenteDesde, vigenteDesde))
      .orderBy(asc(irpfFranjas.id))
      .all()
    return sortFranjas(rows)
  }

  function withFranjas(row: ParametrosRow): ParametrosVersion {
    return { ...row, franjas: franjasOf(row.vigenteDesde) }
  }

  return {
    /** Newest first, franjas included. */
    list(): ParametrosVersion[] {
      return db.select().from(parametros).orderBy(desc(parametros.vigenteDesde)).all().map(withFranjas)
    },

    get(vigenteDesde: IsoDate): ParametrosVersion | null {
      const row = db.select().from(parametros).where(eq(parametros.vigenteDesde, vigenteDesde)).get()
      return row ? withFranjas(row) : null
    },

    latest(): ParametrosVersion | null {
      const row = db.select().from(parametros).orderBy(desc(parametros.vigenteDesde)).limit(1).get()
      return row ? withFranjas(row) : null
    },

    /** The version in force on `fecha`: newest vigenteDesde <= fecha. */
    vigente(fecha: IsoDate): ParametrosVersion | null {
      const row = db
        .select()
        .from(parametros)
        .where(lte(parametros.vigenteDesde, fecha))
        .orderBy(desc(parametros.vigenteDesde))
        .limit(1)
        .get()
      return row ? withFranjas(row) : null
    },

    /** Inserts a new version with its franjas. Throws CONFLICTO if vigenteDesde exists. */
    insert(version: ParametrosVersion): ParametrosVersion {
      db.transaction((tx) => {
        const clash = tx
          .select({ v: parametros.vigenteDesde })
          .from(parametros)
          .where(eq(parametros.vigenteDesde, version.vigenteDesde))
          .get()
        if (clash) {
          throw new AppError('CONFLICTO', `Ya existe una versión vigente desde ${version.vigenteDesde}`)
        }
        tx.insert(parametros).values(scalars(version)).run()
        const franjas = sortFranjas(version.franjas)
        if (franjas.length > 0) {
          tx.insert(irpfFranjas)
            .values(franjas.map((f) => ({ vigenteDesde: version.vigenteDesde, ...f })))
            .run()
        }
      })
      return this.get(version.vigenteDesde)!
    },

    /** Replaces the version identified by vigenteDesde, franjas included. Throws NO_ENCONTRADO. */
    replace(version: ParametrosVersion): ParametrosVersion {
      db.transaction((tx) => {
        const { vigenteDesde, ...rest } = scalars(version)
        const result = tx.update(parametros).set(rest).where(eq(parametros.vigenteDesde, vigenteDesde)).run()
        if (result.changes === 0) {
          throw new AppError('NO_ENCONTRADO', `No existe una versión vigente desde ${vigenteDesde}`)
        }
        tx.delete(irpfFranjas).where(eq(irpfFranjas.vigenteDesde, vigenteDesde)).run()
        const franjas = sortFranjas(version.franjas)
        if (franjas.length > 0) {
          tx.insert(irpfFranjas)
            .values(franjas.map((f) => ({ vigenteDesde, ...f })))
            .run()
        }
      })
      return this.get(version.vigenteDesde)!
    },
  }
}

export type ParametrosRepo = ReturnType<typeof parametrosRepo>
