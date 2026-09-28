// App database lifecycle. `initDb()` is awaited by src/main/index.ts before any window opens.

import { app } from 'electron'
import { join } from 'node:path'
import { getDb, openDatabase, setDb, type Db } from './connection'

export { getDb, type Db }

/** Absolute path of the SQLite file: userData/recibos.db. */
export function dbPath(): string {
  return join(app.getPath('userData'), 'recibos.db')
}

/** drizzle/ is copied to resources/drizzle by electron-builder. */
export function migrationsFolder(): string {
  return app.isPackaged ? join(process.resourcesPath, 'drizzle') : join(app.getAppPath(), 'drizzle')
}

/** Opens userData/recibos.db, runs migrations and the idempotent seed. */
export async function initDb(): Promise<void> {
  const db = openDatabase(dbPath(), migrationsFolder())
  setDb(db)
  app.once('will-quit', () => closeDb())
}

export function closeDb(): void {
  try {
    getDb().$client.close()
  } catch {
    // not open
  }
  setDb(null)
}
