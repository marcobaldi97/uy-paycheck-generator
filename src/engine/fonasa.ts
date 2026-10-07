// FONASA rate selection from the income band and the worker's family flags.

import Decimal from 'decimal.js'
import { casoFonasa, type CasoFonasa, type FonasaCargas } from '@shared/fonasa'
import { fromCents } from '@shared/money'
import type { Cents, Parametros, Rate } from '@shared/types'

export type { FonasaCargas }

const TASA_POR_CASO = {
  bajo_sin_conyuge: 'fonasaBajoSinConyuge',
  bajo_con_conyuge: 'fonasaBajoConConyuge',
  alto_sin_cargas: 'fonasaAltoSinCargas',
  alto_conyuge: 'fonasaAltoConyuge',
  alto_hijos: 'fonasaAltoHijos',
  alto_conyuge_hijos: 'fonasaAltoConyugeHijos',
} as const satisfies Record<CasoFonasa, keyof Parametros>

/** True when the imponible is above `fonasaUmbralBpc` × BPC (the high band). */
export function fonasaBandaAlta(imponibleBps: Cents, parametros: Parametros): boolean {
  const umbral = new Decimal(parametros.fonasaUmbralBpc).times(fromCents(parametros.bpc))
  return fromCents(imponibleBps).greaterThan(umbral)
}

/** Computed FONASA rate (ignores manual and receipt overrides). */
export function tasaFonasa(imponibleBps: Cents, cargas: FonasaCargas, parametros: Parametros): Rate {
  const caso = casoFonasa(fonasaBandaAlta(imponibleBps, parametros), cargas)
  return parametros[TASA_POR_CASO[caso]]
}
