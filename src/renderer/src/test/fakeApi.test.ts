import { afterEach, describe, expect, it, vi } from 'vitest'
import { err, instalarApi, ok, quitarApi } from './fakeApi'

afterEach(quitarApi)

describe('instalarApi', () => {
  it('serves the given methods and returns them', async () => {
    const api = instalarApi({ empresa: { obtener: vi.fn().mockResolvedValue(ok(null)) } })
    await expect(window.api.empresa.obtener()).resolves.toEqual({ ok: true, data: null })
    expect(api.empresa.obtener).toHaveBeenCalledOnce()
  })

  it('answers INTERNO for methods that were not given', async () => {
    instalarApi({})
    await expect(window.api.liquidaciones.listar()).resolves.toEqual(
      err('INTERNO', 'sin mock: liquidaciones.listar'),
    )
  })

  it('quitarApi removes window.api', () => {
    instalarApi({})
    quitarApi()
    expect(window.api).toBeUndefined()
  })
})
