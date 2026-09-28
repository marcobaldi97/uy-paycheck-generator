import { eq } from 'drizzle-orm'
import type { Empresa } from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { empresa } from '../db/schema'

const ID = 1

export function empresaRepo(db: Conn = getDb()) {
  return {
    get(): Empresa | null {
      const row = db.select().from(empresa).where(eq(empresa.id, ID)).get()
      if (!row) return null
      const { id: _id, ...data } = row
      return data
    },

    save(data: Empresa): Empresa {
      const values = {
        nombre: data.nombre,
        direccion: data.direccion,
        rut: data.rut,
        nroMtss: data.nroMtss,
        grupo: data.grupo,
        subgrupo: data.subgrupo,
      }
      db.insert(empresa)
        .values({ id: ID, ...values })
        .onConflictDoUpdate({ target: empresa.id, set: values })
        .run()
      return values
    },
  }
}

export type EmpresaRepo = ReturnType<typeof empresaRepo>
