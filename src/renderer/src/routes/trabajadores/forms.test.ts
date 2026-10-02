import type { Condicion, Trabajador } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  cargosExistentes,
  condicionFormSchema,
  condicionVigente,
  formACondicionInput,
  nuevaCondicionInicial,
  siguienteNumero,
  trabajadorAForm,
  trabajadorFormSchema,
  trabajadorVacio,
} from './forms'

const condicion = (id: number, vigenteDesde: string, extra: Partial<Condicion> = {}): Condicion => ({
  id,
  trabajadorId: 1,
  vigenteDesde,
  sueldoNominal: 3_000_000,
  fonasaConyuge: true,
  fonasaHijos: false,
  fonasaTasaManual: null,
  irpfHijos: 2,
  irpfHijosDiscapacidad: 1,
  irpfPctAtribucion: 50,
  irpfOtrasDeducciones: 12_345,
  ...extra,
})

describe('nuevaCondicionInicial', () => {
  it('copies the newest condition and clears the start date', () => {
    const values = nuevaCondicionInicial(condicion(3, '2026-01-01', { fonasaTasaManual: '0.045' }))
    expect(values).toEqual({
      vigenteDesde: '',
      sueldoNominal: 3_000_000,
      fonasaConyuge: true,
      fonasaHijos: false,
      fonasaTasaManual: '4,5',
      irpfHijos: 2,
      irpfHijosDiscapacidad: 1,
      irpfPctAtribucion: '50',
      irpfOtrasDeducciones: 12_345,
    })
  })

  it('uses defaults when there is no previous condition', () => {
    const values = nuevaCondicionInicial(undefined)
    expect(values.sueldoNominal).toBeNull()
    expect(values.irpfPctAtribucion).toBe('100')
    expect(values.fonasaTasaManual).toBe('')
  })
})

describe('condicionFormSchema', () => {
  const valid = { ...nuevaCondicionInicial(condicion(1, '2026-01-01')), vigenteDesde: '2026-06-01' }

  it('requires a start date and a salary', () => {
    expect(condicionFormSchema.safeParse(valid).success).toBe(true)
    expect(condicionFormSchema.safeParse({ ...valid, vigenteDesde: '' }).success).toBe(false)
    expect(condicionFormSchema.safeParse({ ...valid, sueldoNominal: null }).success).toBe(false)
    expect(condicionFormSchema.safeParse({ ...valid, irpfHijos: '' }).success).toBe(false)
  })

  it('accepts an empty or valid manual FONASA percent only', () => {
    expect(condicionFormSchema.safeParse({ ...valid, fonasaTasaManual: '' }).success).toBe(true)
    expect(condicionFormSchema.safeParse({ ...valid, fonasaTasaManual: '6,375' }).success).toBe(true)
    expect(condicionFormSchema.safeParse({ ...valid, fonasaTasaManual: 'abc' }).success).toBe(false)
    expect(condicionFormSchema.safeParse({ ...valid, fonasaTasaManual: '150' }).success).toBe(false)
  })
})

describe('formACondicionInput', () => {
  it('converts percent text and attribution to API values', () => {
    const base = nuevaCondicionInicial(condicion(1, '2026-01-01'))
    expect(formACondicionInput({ ...base, vigenteDesde: '2026-06-01', fonasaTasaManual: '6,375' })).toEqual({
      vigenteDesde: '2026-06-01',
      sueldoNominal: 3_000_000,
      fonasaConyuge: true,
      fonasaHijos: false,
      fonasaTasaManual: '0.06375',
      irpfHijos: 2,
      irpfHijosDiscapacidad: 1,
      irpfPctAtribucion: 50,
      irpfOtrasDeducciones: 12_345,
    })
    expect(formACondicionInput({ ...base, vigenteDesde: '2026-06-01' }).fonasaTasaManual).toBeNull()
  })
})

describe('trabajador helpers', () => {
  const trabajador: Trabajador = { id: 9, ...trabajadorVacio(4), numero: 4, nombre: 'Ana', ci: '1.234.567-8', fechaIngreso: '2020-02-01' }

  it('drops the id for the form and validates numero', () => {
    const values = trabajadorAForm(trabajador)
    expect(values).not.toHaveProperty('id')
    expect(trabajadorFormSchema.safeParse(values).success).toBe(true)
    expect(trabajadorFormSchema.safeParse({ ...values, numero: '' }).success).toBe(false)
    expect(trabajadorFormSchema.safeParse({ ...values, numero: 0 }).success).toBe(false)
    expect(trabajadorFormSchema.safeParse({ ...values, numero: 1.5 }).success).toBe(false)
  })

  it('suggests the next worker number', () => {
    expect(siguienteNumero([])).toBe(1)
    expect(siguienteNumero([trabajador, { ...trabajador, id: 10, numero: 12 }])).toBe(13)
  })
})

describe('condicionVigente', () => {
  const condiciones = [condicion(3, '2026-12-01'), condicion(2, '2026-03-01'), condicion(1, '2025-01-01')]

  it('picks the newest condition that already started', () => {
    expect(condicionVigente(condiciones, '2026-09-28')?.id).toBe(2)
    expect(condicionVigente(condiciones, '2026-03-01')?.id).toBe(2)
    expect(condicionVigente(condiciones, '2024-01-01')).toBeUndefined()
  })
})

describe('cargosExistentes', () => {
  const con = (id: number, cargo: string): Trabajador => ({
    id,
    ...trabajadorVacio(id),
    numero: id,
    nombre: `T${id}`,
    ci: '1.234.567-8',
    fechaIngreso: '2020-02-01',
    cargo,
  })

  it('returns nothing for no workers or blank cargos', () => {
    expect(cargosExistentes([])).toEqual([])
    expect(cargosExistentes([con(1, ''), con(2, '   ')])).toEqual([])
  })

  it('trims and dedupes ignoring case, keeping the first spelling', () => {
    expect(cargosExistentes([con(1, ' Peón '), con(2, 'PEÓN'), con(3, 'peón'), con(4, 'Peón')])).toEqual(['Peón'])
  })

  it('sorts alphabetically in Spanish', () => {
    expect(cargosExistentes([con(1, 'Vendedor'), con(2, 'administrativo'), con(3, 'Ñandú'), con(4, 'Cajero')])).toEqual([
      'administrativo',
      'Cajero',
      'Ñandú',
      'Vendedor',
    ])
  })
})
