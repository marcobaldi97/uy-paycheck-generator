import { describe, expect, it } from 'vitest'
import { esTasa, OVERRIDE_POR_CODIGO, tieneOverrides } from './conceptos'
import { casoFonasa } from './fonasa'
import { fechaResolucion } from './periodo'

describe('fechaResolucion', () => {
  it('is the last day of the period', () => {
    expect(fechaResolucion('2026-02')).toBe('2026-02-28')
    expect(fechaResolucion('2024-02')).toBe('2024-02-29')
    expect(fechaResolucion('2026-12')).toBe('2026-12-31')
  })
})

describe('conceptos', () => {
  it('marks the contribution lines as rates', () => {
    expect(esTasa('MONTEPIO')).toBe(true)
    expect(esTasa('FONASA')).toBe(true)
    expect(esTasa('FRL')).toBe(true)
    expect(esTasa('IRPF')).toBe(false)
    expect(esTasa('DIAS_NO_TRABAJADOS')).toBe(false)
    expect(esTasa(null)).toBe(false)
  })

  it('maps overridable lines to their override key', () => {
    expect(OVERRIDE_POR_CODIGO.IRPF).toBe('irpfImporte')
    expect(OVERRIDE_POR_CODIGO.SUELDO).toBeUndefined()
  })

  it('tieneOverrides ignores empty overrides', () => {
    expect(tieneOverrides(null)).toBe(false)
    expect(tieneOverrides({})).toBe(false)
    expect(tieneOverrides({ fonasaTasa: undefined })).toBe(false)
    expect(tieneOverrides({ irpfImporte: 0 })).toBe(true)
  })
})

describe('casoFonasa', () => {
  const cargas = (fonasaConyuge: boolean, fonasaHijos: boolean) => ({ fonasaConyuge, fonasaHijos })

  it('below the threshold only the spouse matters', () => {
    expect(casoFonasa(false, cargas(false, true))).toBe('bajo_sin_conyuge')
    expect(casoFonasa(false, cargas(true, true))).toBe('bajo_con_conyuge')
  })

  it('above the threshold spouse and children both matter', () => {
    expect(casoFonasa(true, cargas(false, false))).toBe('alto_sin_cargas')
    expect(casoFonasa(true, cargas(true, false))).toBe('alto_conyuge')
    expect(casoFonasa(true, cargas(false, true))).toBe('alto_hijos')
    expect(casoFonasa(true, cargas(true, true))).toBe('alto_conyuge_hijos')
  })
})
