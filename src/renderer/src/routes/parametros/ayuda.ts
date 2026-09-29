// Plain-language explanation of each parameter, shown as a tooltip next to its label.
// Descriptions follow how `src/engine` uses each value; none of them states a legal rate.

import type { ParametrosFormValues } from './form'

type Escalar = Exclude<keyof ParametrosFormValues, 'franjas'>

export const AYUDA: Record<Escalar, string> = {
  bpc: 'Base de Prestaciones y Contribuciones: valor en pesos que fija el Poder Ejecutivo. Los umbrales y deducciones expresados en BPC se convierten a pesos con este valor.',
  topeMontepio:
    'Sueldo máximo sobre el que se calcula el montepío. Si el sueldo gravado lo supera, el aporte se calcula solo hasta este tope. Vacío = sin tope.',
  montepio: 'Aporte jubilatorio del trabajador al BPS, como porcentaje del sueldo gravado (hasta el tope, si hay uno).',
  frl: 'Aporte del trabajador al Fondo de Reconversión Laboral, como porcentaje del sueldo gravado.',
  fonasaUmbralBpc:
    'Límite de sueldo, en BPC, que separa las dos bandas de FONASA. Hasta el umbral se usan las tasas «hasta el umbral»; por encima, las tasas «sobre el umbral».',
  fonasaBajoSinConyuge: 'Tasa de FONASA cuando el sueldo no supera el umbral y el trabajador no tiene cónyuge a cargo.',
  fonasaBajoConConyuge: 'Tasa de FONASA cuando el sueldo no supera el umbral y el trabajador tiene cónyuge a cargo.',
  fonasaAltoSinCargas:
    'Tasa de FONASA cuando el sueldo supera el umbral y el trabajador no tiene cónyuge ni hijos a cargo.',
  fonasaAltoHijos: 'Tasa de FONASA cuando el sueldo supera el umbral y el trabajador tiene hijos a cargo, sin cónyuge.',
  fonasaAltoConyuge:
    'Tasa de FONASA cuando el sueldo supera el umbral y el trabajador tiene cónyuge a cargo, sin hijos.',
  fonasaAltoConyugeHijos:
    'Tasa de FONASA cuando el sueldo supera el umbral y el trabajador tiene cónyuge e hijos a cargo.',
  irpfIncrementoUmbralBpc:
    'Renta mensual, en BPC, por encima de la cual se aplica el incremento antes de calcular el IRPF.',
  irpfIncremento:
    'Porcentaje que se suma a la renta gravada cuando esta supera el umbral del incremento. Con ese valor se aplican las franjas.',
  irpfDeduccionUmbralBpc:
    'Renta mensual, en BPC, que separa las dos tasas de deducción: hasta el umbral se usa la tasa baja; por encima, la alta.',
  irpfTasaDeduccionBaja:
    'Porcentaje de las deducciones (aportes, hijos, otras) que se resta del IRPF cuando la renta no supera el umbral de deducción.',
  irpfTasaDeduccionAlta:
    'Porcentaje de las deducciones que se resta del IRPF cuando la renta supera el umbral de deducción.',
  irpfHijoBpcAnual:
    'Deducción anual por cada hijo a cargo, en BPC. Se divide entre 12 para obtener el monto mensual y se aplica según el porcentaje de atribución del trabajador.',
  irpfHijoDiscBpcAnual:
    'Deducción anual por cada hijo con discapacidad a cargo, en BPC. Se divide entre 12 y se aplica según el porcentaje de atribución.',
}

export const AYUDA_FRANJA = {
  desde: 'Renta mensual, en BPC, donde empieza la franja. Es igual al «Hasta» de la franja anterior.',
  hasta: 'Renta mensual, en BPC, donde termina la franja. La última franja queda sin límite.',
  tasa: 'Porcentaje de IRPF que se aplica a la parte de la renta que cae dentro de esta franja.',
}
