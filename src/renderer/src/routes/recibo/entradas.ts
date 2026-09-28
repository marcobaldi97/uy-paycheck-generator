// Pure helpers for editing ReciboEntradas in the editor. They only reshape user input;
// every number shown on the receipt comes back from main.

import type { CodigoConcepto, DecimalString, LineaManual, Overrides } from '@shared/types'

export type OverrideKey = keyof Overrides

/** Auto lines that accept an override, and the override key each one uses. */
export const OVERRIDE_POR_CODIGO: Partial<Record<CodigoConcepto, OverrideKey>> = {
  MONTEPIO: 'montepioTasa',
  FONASA: 'fonasaTasa',
  FRL: 'frlTasa',
  IRPF: 'irpfImporte',
}

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
  return Object.keys(next).length === 0 ? null : next
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

/** "2.5" → "2,5". */
export function formatCantidad(value: DecimalString | null): string {
  return value === null ? '' : value.replace('.', ',')
}
