// Test fixture: the seeded 2026 parameter version.

import type { ParametrosVersion } from '@shared/types'

export const version2026: ParametrosVersion = {
  vigenteDesde: '2026-01-01',
  bpc: 686400,
  montepio: '0.15',
  frl: '0.00125',
  topeMontepio: null,
  fonasaUmbralBpc: '2.5',
  fonasaBajoSinConyuge: '0.03',
  fonasaBajoConConyuge: '0.05',
  fonasaAltoSinCargas: '0.045',
  fonasaAltoHijos: '0.06',
  fonasaAltoConyuge: '0.065',
  fonasaAltoConyugeHijos: '0.08',
  irpfIncrementoUmbralBpc: '10',
  irpfIncremento: '0.06',
  irpfDeduccionUmbralBpc: '15',
  irpfTasaDeduccionBaja: '0.14',
  irpfTasaDeduccionAlta: '0.08',
  irpfHijoBpcAnual: '20',
  irpfHijoDiscBpcAnual: '40',
  franjas: [
    { desdeBpc: '0', hastaBpc: '7', tasa: '0' },
    { desdeBpc: '7', hastaBpc: '10', tasa: '0.1' },
    { desdeBpc: '10', hastaBpc: '15', tasa: '0.15' },
    { desdeBpc: '15', hastaBpc: '30', tasa: '0.24' },
    { desdeBpc: '30', hastaBpc: '50', tasa: '0.25' },
    { desdeBpc: '50', hastaBpc: '75', tasa: '0.27' },
    { desdeBpc: '75', hastaBpc: '115', tasa: '0.31' },
    { desdeBpc: '115', hastaBpc: null, tasa: '0.36' },
  ],
}
