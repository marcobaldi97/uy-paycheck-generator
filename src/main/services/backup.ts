// Database backup: copies the live SQLite database to a user-chosen folder with the online
// backup API (safe while the app has the DB open, includes WAL contents). No Electron imports
// here; the folder dialog lives in ipc/backup.ts.

import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import dayjs from 'dayjs'
import { AppError } from '@shared/api'
import type { RespaldoInfo } from '@shared/types'
import { getDb, type Db } from '../db/connection'
import { ajustesRepo } from '../repos/ajustes'

const PREFIJO = 'recibos-respaldo'

/** `recibos-respaldo-2026-09-28_14-05-00.db`, in local time. */
export function nombreRespaldo(fecha: Date): string {
  return `${PREFIJO}-${dayjs(fecha).format('YYYY-MM-DD_HH-mm-ss')}.db`
}

/** First path in `carpeta` for this timestamp that doesn't exist yet (`-2`, `-3`... on collision). */
function rutaLibre(carpeta: string, fecha: Date): string {
  const base = nombreRespaldo(fecha)
  let ruta = join(carpeta, base)
  for (let n = 2; existsSync(ruta); n++) {
    ruta = join(carpeta, base.replace(/\.db$/, `-${n}.db`))
  }
  return ruta
}

export function respaldoInfo(ubicacionDb: string, db: Db = getDb()): RespaldoInfo {
  return { ultimoRespaldo: ajustesRepo(db).get('ultimoRespaldo'), ubicacionDb }
}

/**
 * Writes a timestamped copy of the database into `carpeta`, records `ultimoRespaldo`
 * (ISO date-time) and returns the absolute path of the new file.
 */
export async function crearRespaldo(
  carpeta: string,
  db: Db = getDb(),
  ahora: Date = new Date(),
): Promise<string> {
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) {
    throw new AppError('NO_ENCONTRADO', 'La carpeta elegida no existe', { carpeta })
  }
  const archivo = rutaLibre(carpeta, ahora)
  try {
    await db.$client.backup(archivo)
  } catch (error) {
    console.error('[respaldo] backup failed', error)
    throw new AppError('INTERNO', 'No se pudo crear el respaldo en la carpeta elegida', {
      carpeta,
    })
  }
  ajustesRepo(db).set('ultimoRespaldo', ahora.toISOString())
  return archivo
}
