// What the receipt editor edits: a local draft of the recibo's entradas, autosaved to main.
// Server lines, totals and the preview come from `detalle`; this hook only owns the entradas.
//
// - While the liquidación is emitida the recibo is read-only: `entradas` are the stored ones
//   and edits are ignored.
// - When it goes back to borrador (reabrir), the draft restarts from the stored entradas, not
//   from edits main rejected while it was emitida.

import type { OverrideKey } from '@shared/conceptos'
import type { Overrides, ReciboDetalle, ReciboEntradas } from '@shared/types'
import { useState } from 'react'
import { conOverride } from './entradas'
import { useAutosave, type EstadoGuardado } from './useAutosave'

export interface ReciboDraftOptions {
  /** Debounce before an edit is saved, in ms. */
  autosaveMs: number
  /** Called when main rejects a save because the liquidación was emitida meanwhile. */
  onEmitida?: () => void
}

export interface ReciboDraft {
  /** What the inputs show: the draft, or the stored entradas while read-only. */
  entradas: ReciboEntradas
  /** Replaces the draft and schedules a save. No-op while read-only. */
  editar: (next: ReciboEntradas) => void
  /** Sets (or, with `undefined`, removes) one override. */
  setOverride: <K extends OverrideKey>(key: K, value: Overrides[K] | undefined) => void
  estado: EstadoGuardado
  soloLectura: boolean
}

export function useReciboDraft(detalle: ReciboDetalle, { autosaveMs, onEmitida }: ReciboDraftOptions): ReciboDraft {
  const soloLectura = detalle.estado === 'emitida'
  const { estado, programar } = useAutosave(detalle.id, { delay: autosaveMs, onEmitida })

  const [borrador, setBorrador] = useState<ReciboEntradas>(detalle.entradas)
  const [prevEstado, setPrevEstado] = useState(detalle.estado)
  if (detalle.estado !== prevEstado) {
    setPrevEstado(detalle.estado)
    if (detalle.estado === 'borrador') setBorrador(detalle.entradas)
  }
  const entradas = soloLectura ? detalle.entradas : borrador

  function editar(next: ReciboEntradas) {
    if (soloLectura) return
    setBorrador(next)
    programar(next)
  }

  function setOverride<K extends OverrideKey>(key: K, value: Overrides[K] | undefined) {
    editar({ ...entradas, overrides: conOverride(entradas.overrides, key, value) })
  }

  return { entradas, editar, setOverride, estado, soloLectura }
}
