// Pure helpers for editing ReciboEntradas in the editor. They only reshape user input;
// every number shown on the receipt comes back from main.

import { tieneOverrides, type OverrideKey } from '@shared/conceptos'
import type { DecimalString, LineaManual, Overrides } from '@shared/types'

/** Display names used when a line is missing (e.g. IRPF is omitted when it is 0). */
export const NOMBRE_OVERRIDE: Record<OverrideKey, string> = {
  montepioTasa: 'Montepío',
  fonasaTasa: 'FONASA',
  frlTasa: 'FRL',
  irpfImporte: 'IRPF',
}

export const ORDEN_OVERRIDES: readonly OverrideKey[] = ['montepioTasa', 'fonasaTasa', 'frlTasa', 'irpfImporte']

/** Sets (or, with `undefined`, removes) one override. No overrides left means `null`, as main expects. */
export function conOverride<K extends OverrideKey>(
  overrides: Overrides | null,
  key: K,
  value: Overrides[K] | undefined,
): Overrides | null {
  const next: Overrides = { ...overrides }
  if (value === undefined) delete next[key]
  else next[key] = value
  return tieneOverrides(next) ? next : null
}

export function tieneOverride(overrides: Overrides | null, key: OverrideKey): boolean {
  return overrides?.[key] !== undefined
}

export function nuevaLineaManual(): LineaManual {
  return {
    descripcion: '',
    tipo: 'haber',
    cantidad: null,
    valorUnitario: null,
    importe: 0,
    gravadoBps: true,
    gravadoIrpf: true,
  }
}

/** "2,5" or "2.5" → "2.5"; empty → null; anything else → undefined (invalid). */
export function parseCantidad(text: string): DecimalString | null | undefined {
  const normalized = text.trim().replace(',', '.')
  if (normalized === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined
  return normalized
}
