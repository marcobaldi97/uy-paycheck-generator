// Shared harness for IPC wiring tests: a fake `ipcMain` that records listeners, a fresh seeded
// in-memory database per test, and helpers that invoke a channel through the real `handle()`
// pipeline (Zod validation + error mapping). Lives in a subfolder so src/main/index.ts's
// `./ipc/*.ts` glob never picks it up.
//
// Usage, at the top of a test file:
//
//   vi.mock('electron', () => import('./harness').then((m) => m.electronMock))
//   usarIpc(empresa, trabajadores)
//
// This file must not import anything that imports `electron`, or the mock factory above would
// load it in a cycle.

import { afterEach, beforeEach } from 'vitest'
import { channel, type ApiDomain, type ApiMethod, type ApiOutput, type ApiResult } from '@shared/api'
import { setDb } from '../../db/connection'
import { openTestDb } from '../../db/testing'

type Listener = (event: unknown, raw: unknown) => Promise<ApiResult<unknown>>

const listeners = new Map<string, Listener>()

/** Stands in for the `electron` module: only `ipcMain.handle` is used by src/main/lib/ipc.ts. */
export const electronMock = {
  ipcMain: {
    handle: (name: string, listener: Listener) => listeners.set(name, listener),
  },
}

/**
 * Before each test: a fresh seeded in-memory database, then `register()` of every module, so
 * services created at register time bind to that database. Clears it after each test.
 */
export function usarIpc(...modules: Array<{ register: () => void }>): void {
  beforeEach(() => {
    listeners.clear()
    setDb(openTestDb())
    for (const module of modules) module.register()
  })
  afterEach(() => setDb(null))
}

/** Every registered channel, sorted. */
export function canales(): string[] {
  return [...listeners.keys()].sort()
}

/** Invokes `domain:method` like the renderer would. `input` is unchecked so tests can send bad data. */
export function invocar<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  input?: unknown,
): Promise<ApiResult<ApiOutput<D, M>>> {
  const listener = listeners.get(channel(domain, method))
  if (!listener) throw new Error(`no handler for ${channel(domain, method)}`)
  return listener({}, input) as Promise<ApiResult<ApiOutput<D, M>>>
}

/** The data of a successful call; throws with the error code otherwise. */
export async function ok<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  input?: unknown,
): Promise<ApiOutput<D, M>> {
  const result = await invocar(domain, method, input)
  if (!result.ok) throw new Error(`${channel(domain, method)}: ${result.error.code} ${result.error.message}`)
  return result.data
}

/** The error code of a failed call; throws if it succeeded. */
export async function errorCode<D extends ApiDomain, M extends ApiMethod<D>>(
  domain: D,
  method: M,
  input?: unknown,
): Promise<string> {
  const result = await invocar(domain, method, input)
  if (result.ok) throw new Error(`${channel(domain, method)} unexpectedly succeeded`)
  return result.error.code
}
