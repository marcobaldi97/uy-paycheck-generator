// Test fixtures for the receipt template: the Carmona 08/2024 receipt (PLAN.md test case 1).
// Sueldo 30.000; montepío 15%, FONASA 8%, FRL 0,125%; no IRPF; redondeo +0,50 (haber); líquido 23.063.
// Worker and company identity data are fictitious.

import type { ReciboImpresion } from '@shared/types'

export const reciboCarmona: ReciboImpresion = {
  reciboId: 1,
  empresa: {
    nombre: 'EMPRESA DE PRUEBA S.A.',
    direccion: 'Av. 18 de Julio 1234, Montevideo',
    rut: '211234560018',
    nroMtss: '1234567',
    afiliacionBps: '1234567',
    carpetaBse: '98765',
    grupo: '10',
    subgrupo: '01',
  },
  trabajador: {
    id: 1,
    numero: 1,
    ci: '1.234.567-8',
    nombre: 'CARMONA, Juan',
    cargo: 'Administrativo',
    fechaIngreso: '2019-03-01',
    sueldoNominal: 3_000_000,
  },
  liquidacion: { periodo: '2024-08', fechaCargo: '2024-08-31', fechaPago: '2024-09-05' },
  lineas: [
    {
      codigo: 'SUELDO',
      descripcion: 'Sueldo Mensual',
      cantidad: null,
      valorUnitario: null,
      importe: 3_000_000,
      tipo: 'haber',
      orden: 1,
      origen: 'auto',
      override: false,
    },
    {
      codigo: 'MONTEPIO',
      descripcion: 'Montepío',
      cantidad: '0.15',
      valorUnitario: 3_000_000,
      importe: 450_000,
      tipo: 'descuento',
      orden: 2,
      origen: 'auto',
      override: false,
    },
    {
      codigo: 'FONASA',
      descripcion: 'FONASA',
      cantidad: '0.08',
      valorUnitario: 3_000_000,
      importe: 240_000,
      tipo: 'descuento',
      orden: 3,
      origen: 'auto',
      // Set on purpose: overrides must never be visible on the printed receipt.
      override: true,
    },
    {
      codigo: 'FRL',
      descripcion: 'FRL',
      cantidad: '0.00125',
      valorUnitario: 3_000_000,
      importe: 3_750,
      tipo: 'descuento',
      orden: 4,
      origen: 'auto',
      override: false,
    },
    {
      codigo: 'REDONDEO',
      descripcion: 'Redondeo',
      cantidad: null,
      valorUnitario: null,
      importe: 50,
      tipo: 'haber',
      orden: 5,
      origen: 'auto',
      override: false,
    },
  ],
  totales: {
    imponibleBps: 3_000_000,
    imponibleIrpf: 3_000_000,
    totalHaberes: 3_000_050,
    totalDescuentos: 693_750,
    liquido: 2_306_300,
  },
}

/** `count` receipts for the print route, each with its own id and worker name. */
export function recibosDePrueba(count: number): ReciboImpresion[] {
  return Array.from({ length: count }, (_, index) => ({
    ...reciboCarmona,
    reciboId: index + 1,
    trabajador: { ...reciboCarmona.trabajador, id: index + 1, numero: index + 1, nombre: `TRABAJADOR ${index + 1}` },
  }))
}
