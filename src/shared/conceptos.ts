// What each auto concepto means on a receipt, shared by the engine, main and the renderer.

import type { CodigoConcepto, Overrides } from './types'

export type OverrideKey = keyof Overrides

/** Auto lines that accept a receipt override, and the override key each one uses. */
export const OVERRIDE_POR_CODIGO: Readonly<Partial<Record<CodigoConcepto, OverrideKey>>> = {
  MONTEPIO: 'montepioTasa',
  FONASA: 'fonasaTasa',
  FRL: 'frlTasa',
  IRPF: 'irpfImporte',
}

const CODIGOS_TASA: ReadonlySet<CodigoConcepto> = new Set(['MONTEPIO', 'FONASA', 'FRL'])

/**
 * True for the contribution lines whose `cantidad` is the applied rate (e.g. "0.15") and whose
 * `valorUnitario` is the base amount. Other lines' `cantidad` is a plain quantity (days, units).
 */
export function esTasa(codigo: CodigoConcepto | null): boolean {
  return codigo !== null && CODIGOS_TASA.has(codigo)
}

/** True when at least one override is set. Overrides with nothing set are stored as `null`. */
export function tieneOverrides(overrides: Overrides | null | undefined): boolean {
  return !!overrides && Object.values(overrides).some((v) => v !== undefined && v !== null)
}
