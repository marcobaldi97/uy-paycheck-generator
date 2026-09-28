import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { conceptosRepo } from '../repos/conceptos'
import { parametrosRepo } from '../repos/parametros'
import { CONCEPTOS_SEED, PARAMETROS_2026, seed } from './seed'
import { openTestDb } from './testing'

const TABLES = [
  'ajustes',
  'conceptos',
  'empresa',
  'irpf_franjas',
  'liquidaciones',
  'parametros',
  'recibo_lineas',
  'recibos',
  'trabajador_condiciones',
  'trabajadores',
]

describe('migrations', () => {
  it('create every table', () => {
    const db = openTestDb()
    const names = db.$client
      .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(names).toEqual(TABLES)
  })

  it('enable foreign keys', () => {
    const db = openTestDb()
    expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('seed', () => {
  it('inserts the conceptos catalog in order', () => {
    const db = openTestDb()
    const conceptos = conceptosRepo(db).list()
    expect(conceptos.map((c) => c.codigo)).toEqual([
      'SUELDO',
      'DIAS_NO_TRABAJADOS',
      'MONTEPIO',
      'FONASA',
      'FRL',
      'IRPF',
      'REDONDEO',
    ])
    const sueldo = conceptos.find((c) => c.codigo === 'SUELDO')!
    expect(sueldo).toMatchObject({ descripcion: 'Sueldo Mensual', tipo: 'haber', gravadoBps: true, gravadoIrpf: true })
    expect(conceptos.find((c) => c.codigo === 'REDONDEO')!.tipo).toBe('descuento')
  })

  it('inserts the 2026 parameters with their IRPF brackets', () => {
    const db = openTestDb()
    const versions = parametrosRepo(db).list()
    expect(versions).toHaveLength(1)
    expect(versions[0]).toEqual(PARAMETROS_2026)
    expect(versions[0]!.bpc).toBe(686400)
    expect(versions[0]!.franjas).toHaveLength(8)
    expect(versions[0]!.franjas.at(-1)).toEqual({ desdeBpc: '115', hastaBpc: null, tasa: '0.36' })
  })

  it('is idempotent and never overwrites user edits', () => {
    const db = openTestDb()
    const repo = parametrosRepo(db)
    repo.replace({ ...PARAMETROS_2026, bpc: 700000, franjas: PARAMETROS_2026.franjas.slice(0, 2) })
    seed(db)
    seed(db)
    expect(conceptosRepo(db).list()).toHaveLength(CONCEPTOS_SEED.length)
    const v = repo.get('2026-01-01')!
    expect(v.bpc).toBe(700000)
    expect(v.franjas).toHaveLength(2)
  })
})

describe('file database', () => {
  let dir: string | null = null
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = null
  })

  it('reopens an existing file without re-running migrations or duplicating the seed', () => {
    dir = mkdtempSync(join(tmpdir(), 'recibos-test-'))
    const file = join(dir, 'recibos.db')
    const first = openTestDb(file)
    expect(first.$client.pragma('journal_mode', { simple: true })).toBe('wal')
    first.$client.close()

    const second = openTestDb(file)
    expect(conceptosRepo(second).list()).toHaveLength(CONCEPTOS_SEED.length)
    expect(parametrosRepo(second).list()).toHaveLength(1)
    second.$client.close()
  })
})
