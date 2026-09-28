// FONASA rate selection from the income band and the worker's family flags.

import Decimal from 'decimal.js'
import { fromCents } from '@shared/money'
import type { Cents, Parametros, Rate } from '@shared/types'

export interface FonasaCargas {
  fonasaConyuge: boolean
  fonasaHijos: boolean
}

/** True when the imponible is above `fonasaUmbralBpc` × BPC (the high band). */
export function fonasaBandaAlta(imponibleBps: Cents, parametros: Parametros): boolean {
  const umbral = new Decimal(parametros.fonasaUmbralBpc).times(fromCents(parametros.bpc))
  return fromCents(imponibleBps).greaterThan(umbral)
}

/** Computed FONASA rate (ignores manual and receipt overrides). */
export function tasaFonasa(imponibleBps: Cents, cargas: FonasaCargas, parametros: Parametros): Rate {
  if (!fonasaBandaAlta(imponibleBps, parametros)) {
    return cargas.fonasaConyuge ? parametros.fonasaBajoConConyuge : parametros.fonasaBajoSinConyuge
  }
  if (cargas.fonasaConyuge && cargas.fonasaHijos) return parametros.fonasaAltoConyugeHijos
  if (cargas.fonasaConyuge) return parametros.fonasaAltoConyuge
  if (cargas.fonasaHijos) return parametros.fonasaAltoHijos
  return parametros.fonasaAltoSinCargas
}
