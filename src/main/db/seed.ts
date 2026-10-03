// Idempotent seed: the conceptos catalog and the 2026 parameters with their IRPF brackets.
// Runs on every start; inserts only what is missing and never overwrites user edits.

import type { Conn } from './connection'
import type { CodigoConcepto, ParametrosVersion, TipoConcepto } from '@shared/types'
import * as schema from './schema'

interface ConceptoSeed {
  codigo: CodigoConcepto
  descripcion: string
  tipo: TipoConcepto
  gravadoBps: boolean
  gravadoIrpf: boolean
  calculo: 'auto' | 'manual'
  orden: number
}

export const CONCEPTOS_SEED: readonly ConceptoSeed[] = [
  { codigo: 'SUELDO', descripcion: 'Sueldo Mensual', tipo: 'haber', gravadoBps: true, gravadoIrpf: true, calculo: 'auto', orden: 10 },
  { codigo: 'DIAS_NO_TRABAJADOS', descripcion: 'Días no trabajados', tipo: 'haber', gravadoBps: true, gravadoIrpf: true, calculo: 'auto', orden: 20 },
  { codigo: 'MONTEPIO', descripcion: 'Montepío', tipo: 'descuento', gravadoBps: false, gravadoIrpf: false, calculo: 'auto', orden: 110 },
  { codigo: 'FONASA', descripcion: 'FONASA', tipo: 'descuento', gravadoBps: false, gravadoIrpf: false, calculo: 'auto', orden: 120 },
  { codigo: 'FRL', descripcion: 'FRL', tipo: 'descuento', gravadoBps: false, gravadoIrpf: false, calculo: 'auto', orden: 130 },
  { codigo: 'IRPF', descripcion: 'IRPF', tipo: 'descuento', gravadoBps: false, gravadoIrpf: false, calculo: 'auto', orden: 140 },
  { codigo: 'REDONDEO', descripcion: 'Redondeo', tipo: 'haber', gravadoBps: false, gravadoIrpf: false, calculo: 'auto', orden: 190 },
]

/** 2026 values: BPS Comunicado R 5/2026, BPS Tasas Fonasa, Decreto 148/007, Decreto 11/026. */
export const PARAMETROS_2026: ParametrosVersion = {
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

export function seed(db: Conn): void {
  db.transaction((tx) => {
    tx.insert(schema.conceptos)
      .values([...CONCEPTOS_SEED])
      .onConflictDoNothing({ target: schema.conceptos.codigo })
      .run()

    const { franjas, ...scalars } = PARAMETROS_2026
    const inserted = tx
      .insert(schema.parametros)
      .values(scalars)
      .onConflictDoNothing({ target: schema.parametros.vigenteDesde })
      .run()
    if (inserted.changes > 0) {
      tx.insert(schema.irpfFranjas)
        .values(franjas.map((f) => ({ ...f, vigenteDesde: scalars.vigenteDesde })))
        .run()
    }
  })
}
