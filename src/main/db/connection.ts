// Opening, migrating and holding the database. No Electron imports here, so repos and
// tests can use it with any file path (or ':memory:').

import Database, { type RunResult } from 'better-sqlite3'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { seed } from './seed'

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database }

/**
 * The database or an open transaction. Repos take a `Conn`, so a service can run several
 * repos atomically: `getDb().transaction((tx) => { liquidacionesRepo(tx).create(...) })`.
 */
export type Conn = BaseSQLiteDatabase<'sync', RunResult, typeof schema>


/** Opens (or creates) the database, runs pending migrations and the idempotent seed. */
export function openDatabase(filename: string, migrationsFolder: string): Db {
  const sqlite = new Database(filename)
  sqlite.pragma('foreign_keys = ON')
  if (filename !== ':memory:') sqlite.pragma('journal_mode = WAL')
  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder })
  seed(db)
  return db
}

let current: Db | null = null

export function setDb(db: Db | null): void {
  current = db
}

/** The app database. Throws if `initDb()` has not run. */
export function getDb(): Db {
  if (!current) throw new Error('Database not initialized; call initDb() first')
  return current
}
