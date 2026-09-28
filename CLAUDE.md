# Recibos de sueldo

Windows desktop app that generates monthly Uruguayan paychecks (liquidación tipo N). Electron + React + TypeScript, SQLite in main. The full spec and task list are in `PLAN.md`; this file covers how to work in the repo.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | electron-vite dev server + Electron window |
| `npm run typecheck` | `tsc` on the node project (main, preload, shared, engine) and the web project (renderer, shared) |
| `npm run lint` | ESLint, including the import boundaries below |
| `npm test` | Vitest: `src/engine` and `src/shared` under Node, `src/renderer` under jsdom |
| `npm run test:db` | Vitest inside Electron (`ELECTRON_RUN_AS_NODE=1`) for `src/main/**/*.test.ts` |
| `npm run db:generate` | drizzle-kit migration from `src/main/db/schema.ts` into `drizzle/` |
| `npm run build` / `npm run package` | Build to `out/`; package portable + NSIS into `dist/` |

Before any merge: `npm run typecheck`, `npm run lint`, `npm test` pass (and `npm run test:db` if you touched `src/main`).

Use Node 24 LTS (`.nvmrc`). Tests that load `better-sqlite3` must live under `src/main` and run with `test:db`: the native module crashes under some system Node versions (23.3 segfaults) but always matches Electron's runtime.

## Stack

Electron via electron-vite · React 19 + Mantine 9 · React Router 8 (`createHashRouter`) · TanStack Query 5 · Zod 4 · better-sqlite3 + Drizzle ORM · decimal.js · dayjs · Vitest 4 · electron-builder.

Version notes that differ from older docs:

- Forms: `useForm({ validate: schemaResolver(schema) })` with `schemaResolver` from `@mantine/form` (Standard Schema, works with Zod 4 directly). There is no separate zod-resolver package.
- React Router 8: import from `react-router`; `RouterProvider` for the DOM comes from `react-router/dom`.
- better-sqlite3 13 is N-API with bundled prebuilds; no electron-rebuild step.

Dependencies are fixed by T0. Don't run `npm install <pkg>`; report a missing package instead.

## Conventions

- Money is integer cents (`Cents`). Intermediate math uses `decimal.js`; each receipt line is rounded to cents, half-up (`toCents` in `src/shared/money.ts`).
- Rates are decimal strings (`"0.15"`), never floats. BPC multiples are `DecimalString`.
- Dates are ISO text `YYYY-MM-DD`; periods are `YYYY-MM`.
- Money inputs accept and display Uruguayan format (`30.000,00`): `parseMoney` / `formatMoney`. Percent inputs: `parseRatePercent` / `formatRatePercent`.
- Domain names stay in Spanish (`trabajador`, `liquidacion`, `recibo`); code structure and comments in English. User-facing text in Spanish.
- The renderer never computes paychecks. Main is the single source of truth for numbers.
- Nothing legal is hardcoded; every rate and threshold comes from `parametros`.

## Architecture and import boundaries

```
src/engine     pure TS: may import decimal.js, dayjs, @shared. No Electron, DB, Node, UI.
src/shared     types, IPC contract, Zod schemas, money helpers. No Electron, DB, Node, engine, UI.
src/main       owns SQLite, engine calls, PDF, backup. Registers IPC.
src/preload    exposes window.api only.
src/renderer   UI only. No Electron, Node, DB, engine.
```

ESLint (`no-restricted-imports`) enforces these. Aliases: `@shared/*`, `@engine/*` (main only), `@renderer/*`.

Windows use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` via `secureWebPreferences()` in `src/main/lib/window.ts`.

## IPC contract

- `src/shared/types.ts` and `src/shared/api.ts` are **frozen**. If a task needs a change, stop and report it; the change goes to `main` as one small commit and open worktrees rebase onto it.
- `ApiSpec` in `api.ts` lists every method as `{ input, output }`. `window.api.<domain>.<method>(input)` resolves to `ApiResult<T>` = `{ ok: true, data } | { ok: false, error: { code, message, details? } }`. It never rejects for domain errors.
- Every input is validated in main with `inputSchemas[domain][method]` from `src/shared/schemas.ts`.

Implementing a handler (T5–T8): one file per domain in `src/main/ipc/`, exporting `register()`. `src/main/index.ts` picks up every `src/main/ipc/*.ts` automatically.

```ts
// src/main/ipc/empresa.ts
import { handle } from '../lib/ipc'
import { AppError } from '@shared/api'

export function register(): void {
  handle('empresa', 'obtener', () => empresaRepo.get())
  handle('empresa', 'guardar', (input) => empresaRepo.save(input)) // input is already validated
}
```

Throw `new AppError(code, 'mensaje en español', details?)` for expected failures; anything else becomes `INTERNO` and is logged.

## Main process

- `src/main/index.ts` (T0): single-instance lock, `await initDb()`, register IPC modules, open the window.
- `src/main/db/client.ts` (T2): export `initDb()`, which opens `app.getPath('userData')/recibos.db`, runs migrations and the idempotent seed before the window opens. T0 left a no-op placeholder.
- Migrations folder at runtime: `app.isPackaged ? join(process.resourcesPath, 'drizzle') : join(app.getAppPath(), 'drizzle')`. electron-builder copies `drizzle/` to `resources/drizzle`.
- Hidden print window (T7): `new BrowserWindow({ show: false, webPreferences: secureWebPreferences() })`, then `loadRenderer(win, 'print/<liquidacionId>[/<reciboId>]')`. The print route fetches `api.pdf.datosImpresion` and calls `api.pdf.listo()` once rendered.

## Renderer

- `router.tsx` (T0) defines every route. Each `routes/<area>/index.tsx` keeps the export names the router imports (`LiquidacionesPage`, `LiquidacionDetallePage`, `ReciboEditorPage`, `TrabajadoresPage`, `TrabajadorDetallePage`, `ParametrosPage`, `EmpresaPage`, `RespaldoPage`, `PrintPage`). Replace the placeholder freely; split into more files inside the folder as needed.
- Build links with `paths` from `src/renderer/src/paths.ts`, not string literals.
- Data goes through `src/renderer/src/api/` (T3): `client.ts` wraps `window.api`, `hooks.ts` has one TanStack Query hook per method. Screens don't call `window.api` directly.
- `/print/:liquidacionId/:reciboId?` renders outside the app shell.
- Tests: `*.test.tsx` next to the component; render with `renderWithProviders` / `renderUi` from `src/renderer/src/test/render.tsx`.

## Task ownership

Each task only creates or edits the files it owns (table in `PLAN.md`). T0 also owns `src/main/lib/**`, `src/renderer/src/paths.ts`, `src/renderer/src/test/**` and `components/Placeholder.tsx`. Only T13 edits files owned by other tasks.

- Don't edit `drizzle/` outside T2; a later schema change is a new migration on `main`.
- Running `npm run dev` in several worktrees at once: set `RENDERER_PORT=5174` (etc.) in `.env.local`.
