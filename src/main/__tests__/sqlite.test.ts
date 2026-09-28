// Runs under `npm run test:db` (Vitest inside Electron as Node), proving the native
// better-sqlite3 binary loads in Electron's runtime. Repo tests (T2) follow the same setup.

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

describe('better-sqlite3 under Electron', () => {
  it('runs inside Electron', () => {
    expect(process.versions.electron).toBeTruthy()
  })

  it('opens an in-memory database', () => {
    const db = new Database(':memory:')
    db.exec('create table t (n integer)')
    db.prepare('insert into t (n) values (?)').run(42)
    expect(db.prepare('select n from t').get()).toEqual({ n: 42 })
    db.close()
  })
})
