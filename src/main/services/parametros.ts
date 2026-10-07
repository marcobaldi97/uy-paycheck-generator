// Parametros service: versioned legal parameters with their IRPF brackets. Versions are
// created by duplicating the latest one and then edited in place; brackets are validated here.

import Decimal from 'decimal.js'
import { AppError } from '@shared/api'
import type { FranjaIrpf, IsoDate, ParametrosVersion } from '@shared/types'
import { getDb, type Conn } from '../db/connection'
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

export function parametrosService(db: Conn = getDb()) {
  return {
    /** Newest first, franjas included. */
    listar(): ParametrosVersion[] {
      return parametrosRepo(db).list()
    },

    /**
     * Duplicates the latest version (scalars and franjas) under a new vigenteDesde. Throws
     * SIN_PARAMETROS when there is nothing to copy and CONFLICTO when the date exists.
     */
    nuevaVersion(vigenteDesde: IsoDate): ParametrosVersion {
      return db.transaction((tx) => {
        const repo = parametrosRepo(tx)
        const latest = repo.latest()
        if (!latest) throw new AppError('SIN_PARAMETROS', 'No hay parámetros cargados para duplicar')
        return repo.insert({ ...latest, vigenteDesde, franjas: latest.franjas.map((f) => ({ ...f })) })
      })
    },

    /** Replaces one version, franjas included. Throws VALIDACION (campo franjas) or NO_ENCONTRADO. */
    actualizar(version: ParametrosVersion): ParametrosVersion {
      const problema = problemaFranjas(version.franjas)
      if (problema) throw new AppError('VALIDACION', problema, { campo: 'franjas' })
      return parametrosRepo(db).replace(version)
    },
  }
}

export type ParametrosService = ReturnType<typeof parametrosService>
