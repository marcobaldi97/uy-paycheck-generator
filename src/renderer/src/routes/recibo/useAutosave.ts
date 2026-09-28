// Debounced, serialized autosave for the receipt editor. Edits are queued with `programar`;
// after `delay` ms of quiet the latest entradas are sent. Only one request is in flight at a
// time, so responses can't arrive out of order and overwrite a newer recibo in the cache.

import { reciboEntradasSchema } from '@shared/schemas'
import type { ReciboEntradas } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, isApiErrorCode } from '../../api/client'
import { useActualizarRecibo } from '../../api/hooks'

export type EstadoGuardado =
  | { tipo: 'guardado' }
  | { tipo: 'pendiente' }
  | { tipo: 'guardando' }
  | { tipo: 'invalido'; mensaje: string }
  | { tipo: 'error'; mensaje: string }

export interface AutosaveOptions {
  delay: number
  /** Called when main rejects the save because the liquidación was emitida meanwhile. */
  onEmitida?: () => void
}

export function useAutosave(reciboId: number, { delay, onEmitida }: AutosaveOptions) {
  const { mutateAsync } = useActualizarRecibo()
  const [estado, setEstado] = useState<EstadoGuardado>({ tipo: 'guardado' })

  const pending = useRef<ReciboEntradas | null>(null)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest callbacks, so `flush` stays stable.
  const latest = useRef({ mutateAsync, onEmitida })
  useEffect(() => {
    latest.current = { mutateAsync, onEmitida }
  })

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (inFlight.current) return // the running loop picks up whatever is pending
    inFlight.current = true
    try {
      while (pending.current !== null) {
        const entradas = pending.current
        pending.current = null
        const parsed = reciboEntradasSchema.safeParse(entradas)
        if (!parsed.success) {
          setEstado({ tipo: 'invalido', mensaje: mensajeValidacion(parsed.error.issues) })
          continue
        }
        setEstado({ tipo: 'guardando' })
        try {
          await latest.current.mutateAsync({ id: reciboId, entradas: parsed.data })
          if (pending.current === null) setEstado({ tipo: 'guardado' })
        } catch (error) {
          setEstado({ tipo: 'error', mensaje: errorMessage(error) })
          if (isApiErrorCode(error, 'LIQUIDACION_EMITIDA')) {
            pending.current = null
            latest.current.onEmitida?.()
          }
        }
      }
    } finally {
      inFlight.current = false
    }
  }, [reciboId])

  const programar = useCallback(
    (entradas: ReciboEntradas) => {
      pending.current = entradas
      setEstado((prev) => (prev.tipo === 'guardando' ? prev : { tipo: 'pendiente' }))
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
    [delay, flush],
  )

  // Leaving the screen saves whatever is still waiting for the debounce.
  useEffect(
    () => () => {
      if (timer.current !== null) void flush()
    },
    [flush],
  )

  return { estado, programar }
}

function mensajeValidacion(issues: { path: PropertyKey[]; message: string }[]): string {
  const issue = issues[0]
  if (issue?.path[0] === 'lineasManuales' && typeof issue.path[1] === 'number') {
    const campo = issue.path[2] === 'descripcion' ? 'falta la descripción' : issue.message.toLowerCase()
    return `Línea manual ${issue.path[1] + 1}: ${campo}. Los cambios no se guardaron.`
  }
  return `${issue?.message ?? 'Datos inválidos'}. Los cambios no se guardaron.`
}
