import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/api'
import type { FranjaIrpf } from '@shared/types'
import type { Db } from '../db/connection'
import { PARAMETROS_2026 } from '../db/seed'
import { openTestDb } from '../db/testing'
import { parametrosService, problemaFranjas, type ParametrosService } from './parametros'

let db: Db
let service: ParametrosService
beforeEach(() => {
  db = openTestDb()
  service = parametrosService(db)
})

function expectAppError(fn: () => unknown, code: AppError['code']): AppError {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe(code)
    return error as AppError
  }
  throw new Error(`expected AppError ${code}`)
}

describe('problemaFranjas', () => {
  it('accepts contiguous brackets from 0 with an open last one, in any order', () => {
    expect(problemaFranjas(PARAMETROS_2026.franjas)).toBeNull()
    expect(problemaFranjas([...PARAMETROS_2026.franjas].reverse())).toBeNull()
    expect(problemaFranjas([{ desdeBpc: '0', hastaBpc: null, tasa: '0' }])).toBeNull()
    expect(
      problemaFranjas([
        { desdeBpc: '0', hastaBpc: '7.5', tasa: '0' },
        { desdeBpc: '7.50', hastaBpc: null, tasa: '0.1' },
      ]),
    ).toBeNull()
  })

  it.each<[string, FranjaIrpf[], string]>([
    ['empty', [], 'Se requiere al menos una franja'],
    ['not from 0', [{ desdeBpc: '1', hastaBpc: null, tasa: '0' }], 'La primera franja debe comenzar en 0 BPC'],
    [
      'a gap',
      [
        { desdeBpc: '0', hastaBpc: '7', tasa: '0' },
        { desdeBpc: '8', hastaBpc: null, tasa: '0.1' },
      ],
      'Las franjas deben ser contiguas (franja 1 termina en 7)',
    ],
    [
      'an open bracket before the last',
      [
        { desdeBpc: '0', hastaBpc: null, tasa: '0' },
        { desdeBpc: '7', hastaBpc: null, tasa: '0.1' },
      ],
      'Solo la última franja puede no tener límite superior (franja 1)',
    ],
    [
      'a closed last bracket',
      [
        { desdeBpc: '0', hastaBpc: '7', tasa: '0' },
        { desdeBpc: '7', hastaBpc: '10', tasa: '0.1' },
      ],
      'La última franja no debe tener límite superior',
    ],
    [
      'hasta not above desde',
      [
        { desdeBpc: '0', hastaBpc: '0', tasa: '0' },
        { desdeBpc: '0', hastaBpc: null, tasa: '0.1' },
      ],
      'El límite superior debe ser mayor que el inferior (franja 1)',
    ],
  ])('rejects %s', (_caso, franjas, mensaje) => {
    expect(problemaFranjas(franjas)).toBe(mensaje)
  })

  it('compares bounds as decimals, beyond float precision', () => {
    const franjas = [
      { desdeBpc: '0', hastaBpc: '7', tasa: '0' },
      { desdeBpc: '7.00000000000000001', hastaBpc: null, tasa: '0.1' },
    ]
    expect(problemaFranjas(franjas)).toBe('Las franjas deben ser contiguas (franja 1 termina en 7)')
  })
})

describe('parametrosService', () => {
  it('lists the seeded version', () => {
    expect(service.listar()).toEqual([PARAMETROS_2026])
  })

  it('nuevaVersion duplicates the latest version, franjas included', () => {
    const nueva = service.nuevaVersion('2027-01-01')
    expect(nueva).toEqual({ ...PARAMETROS_2026, vigenteDesde: '2027-01-01' })

    // Edit the new one; the next duplicate copies the edited latest, the old one is untouched.
    service.actualizar({ ...nueva, bpc: 700000 })
    const otra = service.nuevaVersion('2027-07-01')
    expect(otra.bpc).toBe(700000)

    const versiones = service.listar()
    expect(versiones.map((v) => v.vigenteDesde)).toEqual(['2027-07-01', '2027-01-01', PARAMETROS_2026.vigenteDesde])
    expect(versiones[2]).toEqual(PARAMETROS_2026)
  })

  it('nuevaVersion rejects an existing date, and an empty table with SIN_PARAMETROS', () => {
    expectAppError(() => service.nuevaVersion(PARAMETROS_2026.vigenteDesde), 'CONFLICTO')
    expect(service.listar()).toHaveLength(1)

    db.$client.exec('delete from irpf_franjas; delete from parametros')
    const error = expectAppError(() => service.nuevaVersion('2027-01-01'), 'SIN_PARAMETROS')
    expect(error.message).toBe('No hay parámetros cargados para duplicar')
  })

  it('actualizar replaces scalars and franjas of one version, franjas sorted', () => {
    const franjas = [
      { desdeBpc: '0', hastaBpc: '8', tasa: '0' },
      { desdeBpc: '8', hastaBpc: null, tasa: '0.2' },
    ]
    const actualizada = service.actualizar({ ...PARAMETROS_2026, montepio: '0.16', franjas: [...franjas].reverse() })
    expect(actualizada).toEqual({ ...PARAMETROS_2026, montepio: '0.16', franjas })
    expect(service.listar()).toEqual([actualizada])
  })

  it('actualizar rejects unknown versions and inconsistent franjas without writing', () => {
    expectAppError(() => service.actualizar({ ...PARAMETROS_2026, vigenteDesde: '2030-01-01' }), 'NO_ENCONTRADO')
    const error = expectAppError(
      () => service.actualizar({ ...PARAMETROS_2026, bpc: 1, franjas: [{ desdeBpc: '1', hastaBpc: null, tasa: '0' }] }),
      'VALIDACION',
    )
    expect(error.toApiError()).toEqual({
      code: 'VALIDACION',
      message: 'La primera franja debe comenzar en 0 BPC',
      details: { campo: 'franjas' },
    })
    expectAppError(() => service.actualizar({ ...PARAMETROS_2026, franjas: [] }), 'VALIDACION')
    expect(service.listar()).toEqual([PARAMETROS_2026])
  })
})
