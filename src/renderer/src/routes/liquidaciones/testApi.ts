// Test fixtures for the liquidaciones screens. Install them with `instalarApi` from test/fakeApi.

import type { LiquidacionDetalle, LiquidacionResumen } from '@shared/types'

export const resumenes: LiquidacionResumen[] = [
  {
    id: 2,
    periodo: '2024-08',
    fechaCargo: '2024-08-31',
    fechaPago: '2024-09-05',
    estado: 'borrador',
    cantidadRecibos: 2,
    totalLiquido: 5_432_110,
  },
  {
    id: 1,
    periodo: '2024-07',
    fechaCargo: '2024-07-31',
    fechaPago: '2024-08-05',
    estado: 'emitida',
    cantidadRecibos: 1,
    totalLiquido: 2_500_000,
  },
]

export function detalle(estado: 'borrador' | 'emitida' = 'borrador', recibos = true): LiquidacionDetalle {
  return {
    liquidacion: { id: 2, periodo: '2024-08', fechaCargo: '2024-08-31', fechaPago: '2024-09-05', estado },
    recibos: recibos
      ? [
          {
            id: 10,
            trabajadorId: 1,
            trabajadorNombre: 'ANA PÉREZ',
            totalHaberes: 3_000_000,
            totalDescuentos: 600_000,
            liquido: 2_400_000,
            tieneOverrides: false,
          },
          {
            id: 11,
            trabajadorId: 2,
            trabajadorNombre: 'JUAN GÓMEZ',
            totalHaberes: 3_800_000,
            totalDescuentos: 767_890,
            liquido: 3_032_110,
            tieneOverrides: true,
          },
        ]
      : [],
    totales: recibos
      ? { totalHaberes: 6_800_000, totalDescuentos: 1_367_890, liquido: 5_432_110 }
      : { totalHaberes: 0, totalDescuentos: 0, liquido: 0 },
  }
}
