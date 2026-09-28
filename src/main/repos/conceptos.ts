import { asc } from 'drizzle-orm'
import type { CodigoConcepto, Concepto } from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { conceptos } from '../db/schema'

export function conceptosRepo(db: Conn = getDb()) {
  return {
    /** Ordered by `orden`. */
    list(): Concepto[] {
      return db.select().from(conceptos).orderBy(asc(conceptos.orden)).all()
    },

    byCodigo(): Map<CodigoConcepto, Concepto> {
      return new Map(this.list().map((c) => [c.codigo, c]))
    },
  }
}

export type ConceptosRepo = ReturnType<typeof conceptosRepo>
