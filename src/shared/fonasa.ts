// FONASA cases: which rate of `parametros` applies, from the income band and family flags.
// The engine maps a case to its rate; the renderer maps it to a description.

export interface FonasaCargas {
  fonasaConyuge: boolean
  fonasaHijos: boolean
}

export type CasoFonasa =
  | 'bajo_sin_conyuge'
  | 'bajo_con_conyuge'
  | 'alto_sin_cargas'
  | 'alto_conyuge'
  | 'alto_hijos'
  | 'alto_conyuge_hijos'

/** Below the threshold only the spouse matters; above it, spouse and children. */
export function casoFonasa(bandaAlta: boolean, cargas: FonasaCargas): CasoFonasa {
  if (!bandaAlta) return cargas.fonasaConyuge ? 'bajo_con_conyuge' : 'bajo_sin_conyuge'
  if (cargas.fonasaConyuge && cargas.fonasaHijos) return 'alto_conyuge_hijos'
  if (cargas.fonasaConyuge) return 'alto_conyuge'
  if (cargas.fonasaHijos) return 'alto_hijos'
  return 'alto_sin_cargas'
}
