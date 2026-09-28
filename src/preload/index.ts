// Implements `window.api` (shared/api.ts) on top of ipcRenderer.invoke. Nothing else is exposed.

import { contextBridge, ipcRenderer } from 'electron'
import { API_METHODS, channel, type Api } from '@shared/api'

const api = Object.fromEntries(
  Object.entries(API_METHODS).map(([domain, methods]) => [
    domain,
    Object.fromEntries(
      Object.keys(methods).map((method) => [
        method,
        (input?: unknown) => ipcRenderer.invoke(channel(domain, method), input),
      ]),
    ),
  ]),
) as Api

contextBridge.exposeInMainWorld('api', api)
