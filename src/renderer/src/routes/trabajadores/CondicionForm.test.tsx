import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Api, ApiResult } from '@shared/api'
import type { TasaFonasaPreview } from '@shared/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/** Fake main: high band, rate picked from the flags like the seeded parámetros. */
function instalarApi() {
  const tasaFonasa = vi.fn(
    async (input: { fonasaConyuge: boolean; fonasaHijos: boolean }): Promise<ApiResult<TasaFonasaPreview>> => {
      const tasa = input.fonasaConyuge ? (input.fonasaHijos ? '0.08' : '0.065') : input.fonasaHijos ? '0.06' : '0.045'
      return { ok: true, data: { tasa, bandaAlta: true, parametrosVigenteDesde: '2026-01-01' } }
    },
  )
  window.api = { trabajadores: { tasaFonasa } } as unknown as Api
  return tasaFonasa
}

afterEach(() => {
  delete (window as { api?: Api }).api
})

function renderForm(initialValues: CondicionFormValues = INICIAL) {
  return renderUi(<CondicionForm initialValues={initialValues} onGuardar={vi.fn()} onCancelar={vi.fn()} />)
}

describe('CondicionForm FONASA preview', () => {
  it('asks main for the rate and refreshes it when "Cónyuge a cargo" changes', async () => {
    const tasaFonasa = instalarApi()
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
    const tasaFonasa = instalarApi()
    renderForm({ ...INICIAL, sueldoNominal: null })

    expect(screen.getByText('Ingrese el sueldo nominal para ver la tasa FONASA.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Tasa FONASA manual (%)'), '4,5')

    expect(await screen.findByText('Tasa FONASA aplicada: 4,5 % (manual)')).toBeInTheDocument()
    expect(tasaFonasa).not.toHaveBeenCalled()
  })

  it('shows the API error dimmed', async () => {
    window.api = {
      trabajadores: {
        tasaFonasa: vi.fn(async () => ({
          ok: false,
          error: { code: 'SIN_PARAMETROS', message: 'No hay parámetros vigentes para la fecha 01/03/2020' },
        })),
      },
    } as unknown as Api
    renderForm({ ...INICIAL, vigenteDesde: '2020-03-01' })

    await waitFor(() =>
      expect(screen.getByText('No hay parámetros vigentes para la fecha 01/03/2020')).toBeInTheDocument(),
    )
  })
})
