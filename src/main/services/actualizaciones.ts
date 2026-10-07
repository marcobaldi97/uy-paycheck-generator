// Installing an update: the database is always backed up first, and a failed backup cancels
// the install. No Electron imports here; the updater wiring lives in src/main/updater.ts.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { crearRespaldo } from './backup'

/** `userData/respaldos-actualizacion/v1.0.0`: one folder per version being replaced. */
export function carpetaRespaldoActualizacion(userData: string, versionActual: string): string {
  return join(userData, 'respaldos-actualizacion', `v${versionActual}`)
}

/** Creates the folder if needed and writes a backup there. Returns the backup's path. */
export async function respaldarAntesDeActualizar(carpeta: string): Promise<string> {
  mkdirSync(carpeta, { recursive: true })
  return crearRespaldo(carpeta)
}

/** Runs `respaldar`, then `instalar`. If the backup fails, `instalar` never runs. */
export async function respaldarEInstalar<T>(
  respaldar: () => Promise<T>,
  instalar: () => void,
): Promise<T> {
  const respaldo = await respaldar()
  instalar()
  return respaldo
}
