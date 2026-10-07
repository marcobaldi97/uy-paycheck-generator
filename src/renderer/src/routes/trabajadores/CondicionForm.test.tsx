import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TasaFonasaPreview } from '@shared/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { err, instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { renderUi } from '../../test/render'
import { CondicionForm } from './CondicionForm'
import type { CondicionFormValues } from './forms'

const INICIAL: CondicionFormValues = {
  vigenteDesde: '2026-03-01',
  sueldoNominal: 3_000_000,
  fonasaConyuge: false,
  fonasaHijos: true,
  fonasaTasaManual: '',
  irpfHijos: 0,
  irpfHijosDiscapacidad: 0,
  irpfPctAtribucion: '100',
  irpfOtrasDeducciones: null,
}

/** Main's preview in the high band, with the seeded parámetros' rate for the given flags. */
const preview = (tasa: string): TasaFonasaPreview => ({ tasa, bandaAlta: true, parametrosVigenteDesde: '2026-01-01' })

afterEach(quitarApi)

function renderForm(initialValues: CondicionFormValues = INICIAL) {
  return renderUi(<CondicionForm initialValues={initialValues} onGuardar={vi.fn()} onCancelar={vi.fn()} />)
}

describe('CondicionForm FONASA preview', () => {
  it('asks main for the rate and refreshes it when "Cónyuge a cargo" changes', async () => {
    // Hijos only, then cónyuge and hijos.
    const { tasaFonasa } = instalarApi({
      trabajadores: {
        tasaFonasa: vi.fn().mockResolvedValueOnce(ok(preview('0.06'))).mockResolvedValue(ok(preview('0.08'))),
      },
    }).trabajadores
    renderForm()

    expect(await screen.findByText('Tasa FONASA aplicada: 6 % (sobre el umbral, con hijos)')).toBeInTheDocument()
    expect(tasaFonasa).toHaveBeenCalledWith({
      fecha: '2026-03-01',
      sueldoNominal: 3_000_000,
      fonasaConyuge: false,
      fonasaHijos: true,
    })
    expect(screen.getByText(/en el recibo se usa el imponible del mes/)).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Cónyuge a cargo'))

    expect(await screen.findByText('Tasa FONASA aplicada: 8 % (sobre el umbral, con cónyuge e hijos)')).toBeInTheDocument()
    expect(tasaFonasa).toHaveBeenLastCalledWith({
      fecha: '2026-03-01',
      sueldoNominal: 3_000_000,
      fonasaConyuge: true,
      fonasaHijos: true,
    })
  })

  it('shows a manual rate without calling the API', async () => {
    const { tasaFonasa } = instalarApi({ trabajadores: { tasaFonasa: vi.fn() } }).trabajadores
    renderForm({ ...INICIAL, sueldoNominal: null })

    expect(screen.getByText('Ingrese el sueldo nominal para ver la tasa FONASA.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Tasa FONASA manual (%)'), '4,5')

    expect(await screen.findByText('Tasa FONASA aplicada: 4,5 % (manual)')).toBeInTheDocument()
    expect(tasaFonasa).not.toHaveBeenCalled()
  })

  it('shows the API error dimmed', async () => {
    instalarApi({
      trabajadores: {
        tasaFonasa: vi.fn().mockResolvedValue(err('SIN_PARAMETROS', 'No hay parámetros vigentes para la fecha 01/03/2020')),
      },
    })
    renderForm({ ...INICIAL, vigenteDesde: '2020-03-01' })

    await waitFor(() =>
      expect(screen.getByText('No hay parámetros vigentes para la fecha 01/03/2020')).toBeInTheDocument(),
    )
  })
})
