// Route builders. Use these instead of hand-written strings so links match router.tsx.

export const paths = {
  liquidaciones: () => '/liquidaciones',
  liquidacion: (liquidacionId: number) => `/liquidaciones/${liquidacionId}`,
  recibo: (liquidacionId: number, reciboId: number) =>
    `/liquidaciones/${liquidacionId}/recibos/${reciboId}`,
  trabajadores: () => '/trabajadores',
  /** `trabajador('nuevo')` opens the create form. */
  trabajador: (trabajadorId: number | 'nuevo') => `/trabajadores/${trabajadorId}`,
  parametros: () => '/parametros',
  empresa: () => '/empresa',
  respaldo: () => '/respaldo',
  /** Loaded by main in a hidden window; reciboId null = every recibo of the liquidación. */
  print: (liquidacionId: number, reciboId: number | null = null) =>
    reciboId === null ? `/print/${liquidacionId}` : `/print/${liquidacionId}/${reciboId}`,
} as const
