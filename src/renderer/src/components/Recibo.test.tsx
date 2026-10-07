import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderUi } from '../test/render'
import { Recibo } from './Recibo'
import { reciboCarmona } from './Recibo.fixture'

function ejemplares() {
  return screen.getAllByRole('region')
}

function fila(ejemplar: HTMLElement, codigo: string) {
  const row = ejemplar.querySelector(`tr[data-codigo="${codigo}"]`)
  if (!row) throw new Error(`No row for ${codigo}`)
  return within(row as HTMLElement)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

describe('Recibo (Carmona 08/2024)', () => {
  it('renders original and copy on one sheet', () => {
    renderUi(<Recibo datos={reciboCarmona} />)

    expect(screen.getAllByTestId('recibo-hoja')).toHaveLength(1)
    const [original, copia] = ejemplares()
    expect(original).toHaveAttribute('data-ejemplar', 'ORIGINAL')
    expect(copia).toHaveAttribute('data-ejemplar', 'COPIA')
    expect(within(original!).getByText('ORIGINAL')).toBeInTheDocument()
    expect(within(copia!).getByText('COPIA')).toBeInTheDocument()
  })

  it('prints the same data on both halves', () => {
    renderUi(<Recibo datos={reciboCarmona} />)
    const [original, copia] = ejemplares()
    const text = (el: HTMLElement) => el.textContent!.replace('ORIGINAL', '').replace('COPIA', '')
    expect(text(original!)).toBe(text(copia!))
  })

  it('shows company, worker and liquidación headers', () => {
    renderUi(<Recibo datos={reciboCarmona} />)
    const original = ejemplares()[0]!
    const texto = original.textContent!

    expect(texto).toContain('EMPRESA DE PRUEBA S.A.')
    expect(texto).toContain('RUT: 211234560018')
    expect(texto).toContain('Nº MTSS: 1234567')
    expect(texto).not.toContain('Nº:')
    expect(texto).toContain('Afiliación BPS: 1234567 · Carpeta BSE: 98765')
    expect(texto).toContain('Remuneración: 08/2024')
    expect(texto).toContain('Recibí conforme el importe neto de esta liquidación y una copia de la misma.')
    expect(texto).toContain(
      'La empresa declara haber efectuado los aportes de seguridad social correspondientes al mes anterior.',
    )
    expect(texto).toContain('Fecha: 05/09/2024')
    expect(texto).toContain('Tipo de liquidación: N')
    expect(texto).toContain('Fecha de cargo: 31/08/2024')
    expect(texto).toContain('Fecha de pago: 05/09/2024')
    expect(texto).toContain('Nombre: CARMONA, Juan')
    expect(texto).toContain('C.I.: 1.234.567-8')
    expect(texto).toContain('Fecha de ingreso: 01/03/2019')
    expect(texto).toContain('Sueldo nominal: 30.000,00')
  })

  it('matches the expected lines and totals', () => {
    renderUi(<Recibo datos={reciboCarmona} />)
    const original = ejemplares()[0]!

    // Concepto | Cantidad | Valor unit. | Haberes | Descuentos
    expect(fila(original, 'SUELDO')).toEqual(['Sueldo Mensual', '', '', '30.000,00', ''])
    expect(fila(original, 'MONTEPIO')).toEqual(['Montepío', '15%', '30.000,00', '', '4.500,00'])
    expect(fila(original, 'FONASA')).toEqual(['FONASA', '8%', '30.000,00', '', '2.400,00'])
    expect(fila(original, 'FRL')).toEqual(['FRL', '0,125%', '30.000,00', '', '37,50'])
    expect(fila(original, 'REDONDEO')).toEqual(['Redondeo', '', '', '0,50', ''])
    expect(original.querySelector('tr[data-codigo="IRPF"]')).toBeNull()

    expect(original.querySelector('[data-total="haberes"]')).toHaveTextContent('30.000,50')
    expect(original.querySelector('[data-total="descuentos"]')).toHaveTextContent('6.937,50')
    expect(original.querySelector('[data-total="liquido"]')).toHaveTextContent('LÍQUIDO A COBRAR: $ 23.063,00')
    expect(original.textContent).not.toContain('Imponible BPS')
    expect(original.textContent).toMatch(/Imponible IRPF: 0(?!,)/)
  })

  it('prints lines in orden order', () => {
    const lineas = [...reciboCarmona.lineas].reverse()
    renderUi(<Recibo datos={{ ...reciboCarmona, lineas }} />)
    const codigos = [...ejemplares()[0]!.querySelectorAll('tbody tr')].map((tr) => tr.getAttribute('data-codigo'))
    expect(codigos).toEqual(['SUELDO', 'MONTEPIO', 'FONASA', 'FRL', 'REDONDEO'])
  })

  it('never shows the override marker', () => {
    renderUi(<Recibo datos={reciboCarmona} />)
    expect(screen.queryByText(/override|modificad|manual/i)).toBeNull()
  })

  it('shows manual lines and negative haberes', () => {
    renderUi(
      <Recibo
        datos={{
          ...reciboCarmona,
          lineas: [
            ...reciboCarmona.lineas,
            {
              codigo: 'DIAS_NO_TRABAJADOS',
              descripcion: 'Días no trabajados',
              cantidad: '2',
              valorUnitario: 100_000,
              importe: -200_000,
              tipo: 'haber',
              orden: 1.1,
              origen: 'auto',
              override: false,
            },
            {
              codigo: null,
              descripcion: 'Horas extra',
              cantidad: '1.5',
              valorUnitario: 25_000,
              importe: 37_500,
              tipo: 'haber',
              orden: 1.2,
              origen: 'manual',
              override: false,
            },
          ],
        }}
      />,
    )
    const original = ejemplares()[0]!
    expect(fila(original, 'DIAS_NO_TRABAJADOS')).toEqual(['Días no trabajados', '2', '1.000,00', '-2.000,00', ''])
    expect(fila(original, 'MANUAL')).toEqual(['Horas extra', '1,5', '250,00', '375,00', ''])
  })
})
