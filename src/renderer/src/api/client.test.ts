import type { Api } from '@shared/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError, call, callOrThrow, errorMessage, isApiErrorCode, toApiError } from './client'

function stubApi(partial: Record<string, Record<string, unknown>>) {
  window.api = partial as unknown as Api
}

afterEach(() => {
  delete (window as { api?: Api }).api
})

describe('call', () => {
  it('passes the input and returns the result unchanged', async () => {
    const listar = vi.fn().mockResolvedValue({ ok: true, data: [] })
    stubApi({ trabajadores: { listar } })

    await expect(call('trabajadores', 'listar', { soloActivos: true })).resolves.toEqual({ ok: true, data: [] })
    expect(listar).toHaveBeenCalledWith({ soloActivos: true })
  })

  it('calls void methods without arguments', async () => {
    const obtener = vi.fn().mockResolvedValue({ ok: true, data: null })
    stubApi({ empresa: { obtener } })

    await call('empresa', 'obtener')
    expect(obtener).toHaveBeenCalledWith()
  })

  it('returns domain errors as typed results', async () => {
    const error = { code: 'SIN_PARAMETROS', message: 'No hay parámetros vigentes.' }
    stubApi({ liquidaciones: { crear: vi.fn().mockResolvedValue({ ok: false, error }) } })

    const result = await call('liquidaciones', 'crear', {
      periodo: '2026-01',
      fechaCargo: '2026-01-31',
      fechaPago: '2026-02-05',
    } as never)
    expect(result).toEqual({ ok: false, error })
  })

  it('turns a rejected IPC call into INTERNO', async () => {
    stubApi({ empresa: { obtener: vi.fn().mockRejectedValue(new Error('boom')) } })

    const result = await call('empresa', 'obtener')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNO')
      expect(result.error.details).toMatchObject({ cause: 'boom' })
    }
  })

  it('turns a missing bridge or malformed response into INTERNO', async () => {
    await expect(call('empresa', 'obtener')).resolves.toMatchObject({ ok: false, error: { code: 'INTERNO' } })

    stubApi({ empresa: { obtener: vi.fn().mockResolvedValue('nope') } })
    await expect(call('empresa', 'obtener')).resolves.toMatchObject({ ok: false, error: { code: 'INTERNO' } })
  })
})

describe('callOrThrow', () => {
  it('returns data on success', async () => {
    stubApi({ respaldo: { info: vi.fn().mockResolvedValue({ ok: true, data: { ultimoRespaldo: null } }) } })
    await expect(callOrThrow('respaldo', 'info')).resolves.toEqual({ ultimoRespaldo: null })
  })

  it('throws ApiRequestError with code, message and details', async () => {
    const error = { code: 'TRABAJADOR_SIN_CONDICIONES', message: 'Falta condición.', details: { trabajadores: [] } }
    stubApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue({ ok: false, error }) } })

    const thrown = await callOrThrow('liquidaciones', 'obtener', { id: 1 }).catch((e: unknown) => e)
    expect(thrown).toBeInstanceOf(ApiRequestError)
    expect(thrown).toMatchObject({ code: 'TRABAJADOR_SIN_CONDICIONES', message: 'Falta condición.' })
    expect(toApiError(thrown)).toEqual(error)
    expect(isApiErrorCode(thrown, 'TRABAJADOR_SIN_CONDICIONES')).toBe(true)
    expect(errorMessage(thrown)).toBe('Falta condición.')
  })
})

describe('toApiError', () => {
  it('maps unknown errors to INTERNO', () => {
    expect(toApiError(new Error('x'))).toMatchObject({ code: 'INTERNO' })
    expect(isApiErrorCode(new Error('x'), 'INTERNO')).toBe(false)
  })
})
