import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/connection'
import { setDb } from '../db/connection'
import { openTestDb } from '../db/testing'
import {
  carpetaRespaldoActualizacion,
  respaldarAntesDeActualizar,
  respaldarEInstalar,
} from './actualizaciones'

describe('respaldarEInstalar', () => {
  it('installs after the backup succeeds', async () => {
    const orden: string[] = []
    const respaldo = await respaldarEInstalar(
      async () => {
        orden.push('respaldo')
        return 'archivo.db'
      },
      () => orden.push('instalar'),
    )
    expect(respaldo).toBe('archivo.db')
    expect(orden).toEqual(['respaldo', 'instalar'])
  })

  it('never installs when the backup fails', async () => {
    const instalar = vi.fn()
    await expect(
      respaldarEInstalar(() => Promise.reject(new Error('disco lleno')), instalar),
    ).rejects.toThrow('disco lleno')
    expect(instalar).not.toHaveBeenCalled()
  })
})

describe('respaldarAntesDeActualizar', () => {
  let dir: string
  let db: Db

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'recibos-actualizacion-'))
    db = openTestDb(join(dir, 'recibos.db'))
    setDb(db)
  })

  afterEach(() => {
    setDb(null)
    db.$client.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates the per-version folder and writes the backup there', async () => {
    const carpeta = carpetaRespaldoActualizacion(dir, '1.0.0')
    expect(carpeta).toBe(join(dir, 'respaldos-actualizacion', 'v1.0.0'))

    const archivo = await respaldarAntesDeActualizar(carpeta)
    expect(dirname(archivo)).toBe(carpeta)
    expect(existsSync(archivo)).toBe(true)
  })
})
