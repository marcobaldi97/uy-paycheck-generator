// Key-value app state (e.g. `ultimoRespaldo` for the backup screen).

import { eq } from 'drizzle-orm'
import { getDb, type Conn } from '../db/connection'
import { ajustes } from '../db/schema'

export type ClaveAjuste = 'ultimoRespaldo'

export function ajustesRepo(db: Conn = getDb()) {
  return {
    get(clave: ClaveAjuste): string | null {
      return db.select().from(ajustes).where(eq(ajustes.clave, clave)).get()?.valor ?? null
    },

    set(clave: ClaveAjuste, valor: string): void {
      db.insert(ajustes)
        .values({ clave, valor })
        .onConflictDoUpdate({ target: ajustes.clave, set: { valor } })
        .run()
    },
  }
}

export type AjustesRepo = ReturnType<typeof ajustesRepo>
