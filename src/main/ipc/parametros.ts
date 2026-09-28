// parametros: versioned legal parameters with their IRPF brackets.

import Decimal from 'decimal.js'
import { AppError } from '@shared/api'
import type { FranjaIrpf, IsoDate, ParametrosVersion } from '@shared/types'
import { getDb } from '../db/connection'
import { handle } from '../lib/ipc'
import { parametrosRepo } from '../repos/parametros'

/**
 * IRPF brackets must start at 0 BPC, be contiguous, have hasta > desde, and only the last one
 * may be open-ended. Returns a Spanish message for the first problem, or null.
 */
export function problemaFranjas(franjas: FranjaIrpf[]): string | null {
  if (franjas.length === 0) return 'Se requiere al menos una franja'
  const ordenadas = [...franjas].sort((a, b) => new Decimal(a.desdeBpc).comparedTo(b.desdeBpc))
  if (!new Decimal(ordenadas[0]!.desdeBpc).isZero()) return 'La primera franja debe comenzar en 0 BPC'
  for (let i = 0; i < ordenadas.length; i++) {
    const franja = ordenadas[i]!
    const n = i + 1
    const ultima = i === ordenadas.length - 1
    if (franja.hastaBpc === null) {
      if (!ultima) return `Solo la última franja puede no tener límite superior (franja ${n})`
      continue
    }
    if (ultima) return 'La última franja no debe tener límite superior'
    if (!new Decimal(franja.hastaBpc).greaterThan(franja.desdeBpc)) {
      return `El límite superior debe ser mayor que el inferior (franja ${n})`
    }
    if (!new Decimal(franja.hastaBpc).equals(ordenadas[i + 1]!.desdeBpc)) {
      return `Las franjas deben ser contiguas (franja ${n} termina en ${franja.hastaBpc})`
    }
  }
  return null
}

/** Duplicates the latest version (scalars and franjas) under a new vigenteDesde. */
function nuevaVersion(vigenteDesde: IsoDate): ParametrosVersion {
  return getDb().transaction((tx) => {
    const repo = parametrosRepo(tx)
    const latest = repo.latest()
    if (!latest) throw new AppError('SIN_PARAMETROS', 'No hay parámetros cargados para duplicar')
    return repo.insert({ ...latest, vigenteDesde, franjas: latest.franjas.map((f) => ({ ...f })) })
  })
}

function actualizar(version: ParametrosVersion): ParametrosVersion {
  const problema = problemaFranjas(version.franjas)
  if (problema) throw new AppError('VALIDACION', problema, { campo: 'franjas' })
  return parametrosRepo().replace(version)
}

export function register(): void {
  handle('parametros', 'listar', () => parametrosRepo().list())
  handle('parametros', 'nuevaVersion', ({ vigenteDesde }) => nuevaVersion(vigenteDesde))
  handle('parametros', 'actualizar', (input) => actualizar(input))
}
