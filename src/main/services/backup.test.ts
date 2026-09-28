import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/api'
import type { Db } from '../db/connection'
import { openTestDb } from '../db/testing'
import { ajustesRepo } from '../repos/ajustes'
import { crearRespaldo, nombreRespaldo, respaldoInfo } from './backup'

let dir: string
let db: Db

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'recibos-backup-'))
  // A file DB in WAL mode, like the app's, so the test covers uncheckpointed writes.
  db = openTestDb(join(dir, 'recibos.db'))
})

afterEach(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('nombreRespaldo', () => {
  it('uses a local-time timestamp', () => {
    expect(nombreRespaldo(new Date(2026, 8, 28, 14, 5, 7))).toBe(
      'recibos-respaldo-2026-09-28_14-05-07.db',
    )
  })
})

describe('crearRespaldo', () => {
  it('copies the database into the folder and records ultimoRespaldo', async () => {
    const destino = mkdtempSync(join(dir, 'out-'))
    const ahora = new Date(2026, 8, 28, 14, 5, 7)

    expect(respaldoInfo('/x/recibos.db', db)).toEqual({
      ultimoRespaldo: null,
      ubicacionDb: '/x/recibos.db',
    })

    // Uncheckpointed WAL write: must be in the copy.
    ajustesRepo(db).set('ultimoRespaldo', 'previo')
    const archivo = await crearRespaldo(destino, db, ahora)

    expect(basename(archivo)).toBe('recibos-respaldo-2026-09-28_14-05-07.db')
    expect(respaldoInfo('/x/recibos.db', db).ultimoRespaldo).toBe(ahora.toISOString())

    const copia = new Database(archivo, { readonly: true })
    try {
      const tablas = copia
        .prepare("select name from sqlite_master where type = 'table'")
        .all()
        .map((r) => (r as { name: string }).name)
      expect(tablas).toContain('ajustes')
      const conceptos = copia.prepare('select count(*) as n from conceptos').get() as { n: number }
      expect(conceptos.n).toBeGreaterThan(0)
      const ajuste = copia.prepare("select valor from ajustes where clave = 'ultimoRespaldo'").get()
      expect(ajuste).toEqual({ valor: 'previo' })
    } finally {
      copia.close()
    }
  })

  it('never overwrites an existing backup with the same timestamp', async () => {
    const ahora = new Date(2026, 8, 28, 14, 5, 7)
    const destino = mkdtempSync(join(dir, 'out-'))
    const a = await crearRespaldo(destino, db, ahora)
    const b = await crearRespaldo(destino, db, ahora)
    expect(a).not.toBe(b)
    expect(basename(b)).toBe('recibos-respaldo-2026-09-28_14-05-07-2.db')
    expect(readdirSync(destino)).toHaveLength(2)
  })

  it('fails with NO_ENCONTRADO for a missing folder', async () => {
    await expect(crearRespaldo(join(dir, 'no-existe'), db)).rejects.toMatchObject({
      code: 'NO_ENCONTRADO',
    })
    await expect(crearRespaldo(join(dir, 'no-existe'), db)).rejects.toBeInstanceOf(AppError)
    expect(respaldoInfo('', db).ultimoRespaldo).toBeNull()
  })
})
