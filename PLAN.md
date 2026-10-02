# Recibos de sueldo — Implementation plan for Claude Code

Sep 28, 2026 · @Marco

## Overview

Build a Windows desktop app that generates monthly paychecks (recibos de sueldo, liquidación tipo N) for a Uruguayan company, replacing the Excel-template script `mafty.tsx`. Data is entered through a UI and stored in SQLite; receipts are exported as PDF or printed directly. No dependency on MS Excel.

In scope: company data, workers, versioned salary conditions, versioned legal parameters, monthly liquidations with draft/issued states, manual overrides, PDF export and printing, database backup.

Out of scope: aguinaldo, salario vacacional, egreso, leave tracking, jornaleros, data import from the old .xlsx files, multi-employer workers, the 5% núcleo familiar reduction.

How to use this doc with Claude Code: save it as `PLAN.md` at the repo root. Task T0 turns the conventions below into `CLAUDE.md`. Each Claude Code session is started with one task id from the Tasks section and only touches the files that task owns.

## Stack and conventions

Electron with a React + TypeScript renderer, SQLite in the main process, Windows only.

| Layer | Choice |
| --- | --- |
| Shell and build | Electron via `electron-vite` |
| UI | React + TypeScript, Mantine, `@mantine/form` with Zod resolver |
| Routing | React Router `createHashRouter` (production loads from `file://`) |
| Data fetching | TanStack Query over `window.api` |
| Storage | SQLite via `better-sqlite3` + Drizzle ORM and drizzle-kit migrations |
| Validation | Zod, shared by forms and IPC handlers |
| Money math | `decimal.js` |
| Dates | `dayjs` |
| Tests | Vitest |
| Packaging | `electron-builder`, targets `portable` and `nsis` |

Conventions:

- Money is stored as integer cents. Intermediate math uses `decimal.js`. Each receipt line is rounded to cents, half-up.
- Rates are stored as decimal strings (`"0.15"`), never floats.
- Dates are ISO text (`YYYY-MM-DD`); periods are `YYYY-MM`.
- Money inputs accept and display Uruguayan format (`30.000,00`).
- Domain names stay in Spanish (`trabajador`, `liquidacion`, `recibo`); code structure and comments in English.
- The renderer never computes paychecks. Main is the single source of truth for numbers.
- `src/engine` imports nothing from Electron, the DB, or Node APIs.
- Every IPC input is validated with Zod in main.
- `contextIsolation: true`, `nodeIntegration: false`.
- Before any merge: `npm run typecheck`, `npm run lint`, `npm test` pass.

## Project structure

Main owns SQLite, the engine, PDF and backup; preload exposes a typed `window.api`; the renderer is UI only. Files are split per domain so parallel tasks don't edit the same file.

```
./
├─ CLAUDE.md
├─ PLAN.md
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ drizzle.config.ts
├─ drizzle/                        # generated migrations
└─ src/
   ├─ engine/                      # pure TS, no electron/db/node imports
   │  ├─ calcular.ts
   │  ├─ fonasa.ts
   │  ├─ irpf.ts
   │  ├─ redondeo.ts
   │  └─ __tests__/
   ├─ shared/
   │  ├─ types.ts                  # domain types (contract)
   │  ├─ api.ts                    # IPC contract (contract)
   │  ├─ schemas.ts                # Zod schemas
   │  └─ money.ts                  # cents helpers, UY format parse/format
   ├─ main/
   │  ├─ index.ts                  # lifecycle, window, registers ipc modules
   │  ├─ db/
   │  │  ├─ client.ts
   │  │  ├─ schema.ts
   │  │  └─ seed.ts
   │  ├─ repos/                    # one file per table group
   │  ├─ services/
   │  │  ├─ liquidaciones.ts
   │  │  ├─ pdf.ts
   │  │  └─ backup.ts
   │  └─ ipc/                      # one file per domain
   │     ├─ empresa.ts
   │     ├─ trabajadores.ts
   │     ├─ parametros.ts
   │     ├─ liquidaciones.ts
   │     ├─ pdf.ts
   │     └─ backup.ts
   ├─ preload/
   │  └─ index.ts                  # implements shared/api.ts via ipcRenderer.invoke
   └─ renderer/
      ├─ index.html
      └─ src/
         ├─ main.tsx
         ├─ router.tsx              # all routes, owned by T0
         ├─ api/
         │  ├─ client.ts            # typed wrapper over window.api
         │  └─ hooks.ts             # TanStack Query hooks
         ├─ components/
         │  ├─ Layout.tsx
         │  ├─ MoneyInput.tsx
         │  └─ Recibo.tsx           # receipt template: preview + PDF
         └─ routes/
            ├─ empresa/
            ├─ parametros/
            ├─ trabajadores/
            ├─ liquidaciones/
            ├─ recibo/
            ├─ respaldo/
            └─ print/
```

The two files marked "contract" are frozen after T0. A change to them is a separate small commit on `main`, and worktrees rebase onto it.

## Data model

Nine tables. Worker conditions and legal parameters are versioned by `vigente_desde`; issued receipts are snapshots and never recomputed.

| Table | Columns | Notes |
| --- | --- | --- |
| `empresa` | `nombre`, `direccion`, `rut`, `nro_mtss`, `afiliacion_bps`, `carpeta_bse`, `grupo`, `subgrupo` | Single row |
| `trabajadores` | `id`, `numero`, `ci`, `nombre`, `cargo`, `fecha_ingreso`, `activo` | Identity data |
| `trabajador_condiciones` | `trabajador_id`, `vigente_desde`, `sueldo_nominal`, `fonasa_conyuge`, `fonasa_hijos`, `fonasa_tasa_manual` (nullable), `irpf_hijos`, `irpf_hijos_discapacidad`, `irpf_pct_atribucion` (100 or 50), `irpf_otras_deducciones` | Versioned; past rows never edited |
| `parametros` | `vigente_desde`, `bpc`, `montepio`, `frl`, `tope_montepio` (nullable), `fonasa_umbral_bpc`, `fonasa_bajo_sin_conyuge`, `fonasa_bajo_con_conyuge`, `fonasa_alto_sin_cargas`, `fonasa_alto_hijos`, `fonasa_alto_conyuge`, `fonasa_alto_conyuge_hijos`, `irpf_incremento_umbral_bpc`, `irpf_incremento`, `irpf_deduccion_umbral_bpc`, `irpf_tasa_deduccion_baja`, `irpf_tasa_deduccion_alta`, `irpf_hijo_bpc_anual`, `irpf_hijo_disc_bpc_anual` | Versioned |
| `irpf_franjas` | `vigente_desde`, `desde_bpc`, `hasta_bpc` (nullable), `tasa` | Versioned with parametros |
| `conceptos` | `codigo`, `descripcion`, `tipo` (haber/descuento), `gravado_bps`, `gravado_irpf`, `calculo` (auto/manual), `orden` | Seeded catalog |
| `liquidaciones` | `id`, `periodo`, `fecha_cargo`, `fecha_pago`, `estado` (borrador/emitida) | One per month |
| `recibos` | `id`, `liquidacion_id`, `trabajador_id`, `snapshot_empresa` (JSON), `snapshot_trabajador` (JSON), `overrides` (JSON, nullable), `imponible_bps`, `imponible_irpf`, `total_haberes`, `total_descuentos`, `liquido` | One per worker per liquidación |
| `recibo_lineas` | `recibo_id`, `concepto_id`, `descripcion`, `cantidad`, `valor_unitario`, `importe`, `tipo`, `orden` | Printed lines |

Seeded `conceptos`: Sueldo Mensual, Días no trabajados, Montepío, FONASA, FRL, IRPF, Redondeo.

The `overrides` JSON shape is `{ montepioTasa?, fonasaTasa?, frlTasa?, irpfImporte? }`.

## Calculation engine

One pure function turns conditions, parameters and overrides into receipt lines and totals. All values come from `parametros`; nothing legal is hardcoded.

```ts
calcularRecibo(input: {
  condiciones: Condiciones;          // includes fonasaTasaManual?
  parametros: Parametros;
  franjas: FranjaIrpf[];
  diasNoTrabajados: number;
  lineasManuales: LineaManual[];
  overrides?: { montepioTasa?: Decimal; fonasaTasa?: Decimal;
                frlTasa?: Decimal; irpfImporte?: Decimal };
}): { lineas: Linea[]; imponibleBps: Decimal; imponibleIrpf: Decimal;
      totalHaberes: Decimal; totalDescuentos: Decimal; liquido: Decimal }
```

### Seed values (2026)

| Parameter | Value |
| --- | --- |
| BPC | $6.864 |
| Montepío / FRL | 15% / 0,125% |
| FONASA ≤ 2,5 BPC | 3% without spouse, 5% with spouse |
| FONASA > 2,5 BPC | 4,5% none, 6% children, 6,5% spouse, 8% spouse + children |
| IRPF brackets (BPC) | 0–7: 0%, 7–10: 10%, 10–15: 15%, 15–30: 24%, 30–50: 25%, 50–75: 27%, 75–115: 31%, >115: 36% |
| IRPF increment | +6% when renta > 10 BPC |
| IRPF deduction rate | 14% if renta ≤ 15 BPC, else 8% |
| Child deduction | 20 BPC/year per child, 40 BPC/year with disability |
| `tope_montepio` | null |

Sources: [BPS Comunicado R 5/2026](https://www.bps.gub.uy/bps/file/23860/3/2026---comunicado-r-5---valores-escalas-irpf-2026.pdf), [BPS Tasas Fonasa](https://www.bps.gub.uy/10314/tasas-fonasa.html), [Decreto 148/007](https://www.impo.com.uy/bases/decretos/148-2007/63), [Decreto 11/026](https://www.impo.com.uy/bases/decretos/11-2026).

### Steps

1. Haberes: Sueldo = nominal; Días no trabajados = nominal / 30 × days, as a negative haber; manual haberes added.
2. Imponible BPS = sum of haberes with `gravado_bps`.
3. Montepío = imponible × rate (capped by `tope_montepio` if set). FRL = imponible × rate.
4. FONASA: band = imponible > `fonasa_umbral_bpc` × BPC; rate from band + worker flags.
5. IRPF:
   1. renta = sum of haberes with `gravado_irpf`; if renta > 10 BPC, renta × 1,06.
   2. bruto = progressive brackets on renta.
   3. deducciones = montepío + FONASA + FRL + (hijos × 20 BPC/12 + disc × 40 BPC/12) × pct + otras.
   4. tasa = 14% if renta (after increment) ≤ 15 BPC, else 8%.
   5. IRPF = max(0, bruto − deducciones × tasa); line omitted when 0.
6. Redondeo: líquido rounded up to the next whole peso (never down); redondeo = unrounded − rounded, placed in descuentos (always ≤ 0).

### Overrides

- Rate resolution: receipt override → `fonasa_tasa_manual` (FONASA only) → computed.
- Overrides are applied during computation, so a FONASA override changes IRPF deductions.
- `irpfImporte` replaces the IRPF amount. Redondeo is never overridable.

### Test cases

| # | Case | Expected |
| --- | --- | --- |
| 1 | 08/2024, 30000, FONASA 8%, BPC 2024 | 4500 / 2400 / 37,50; no IRPF; redondeo −0,50; líquido 23063 |
| 2 | 2026, 15000, spouse, no children | FONASA 5% |
| 3 | 2026, 80000, no dependents | renta 84800; bruto 4483,20; deducciones 15700 × 14%; IRPF 2285,20; líquido 62015 |
| 4 | 2026, 120000, FONASA 8%, 2 children at 100% | renta 127200; bruto 13024,80; deducciones 50630 × 8%; IRPF 8974,40; líquido 83276 |
| 5 | bruto < deducciones × tasa | IRPF 0, line omitted |
| 6 | Just above 10 BPC, días no trabajados bring it below | No 6% increment |
| 7 | FONASA override | FONASA line and IRPF deductions both change |
| 8 | IRPF override | Amount replaced, other lines unchanged |
| 9 | Receipt and worker FONASA override both set | Receipt override wins |

Cases 3 and 4 are hand-computed. Verify them against the BPS or DGI simulator before committing them as fixtures.

## UI

Seven views: Liquidaciones (home), Trabajadores, Parámetros, Empresa, plus Respaldo at the bottom and the receipt editor opened from a liquidación.

| Screen | Content | Actions |
| --- | --- | --- |
| Liquidaciones (list) | Periods with estado, receipt count, total líquido | Nueva liquidación (period, fecha de cargo, fecha de pago); blocked with a message if no parameters apply or an active worker has no conditions |
| Liquidación (detail) | One row per worker: nombre, haberes, descuentos, líquido; totals footer | Recalcular (draft), Emitir, Reabrir (confirm), Exportar PDF (single file or one per worker, `Nombre--dd-mm-yyyy.pdf`), Imprimir |
| Recibo (editor) | Left: días no trabajados, manual lines, auto lines with override control and "restaurar". Right: live preview (original + copy) | Autosave; read-only when emitida |
| Trabajadores | List with active filter; detail = identity form + condiciones history | Nueva condición (requires start date) |
| Parámetros | Versions by `vigente_desde`; scalar fields + editable IRPF brackets table | Nueva versión (duplicates latest) |
| Empresa | Single form | Guardar |
| Respaldo | Last backup date | Copy DB file to a chosen folder |

Behavior rules:

- Money inputs use `MoneyInput` (UY format, stores cents).
- Parameter or condition changes never touch issued receipts; drafts update only on Recalcular.
- Overrides are marked in the editor and never shown on the printed receipt.
- The printed receipt shows "Tipo de liquidación: N" as a fixed value.
- Print CSS: `@page { size: A4; margin: 0 }`, `break-after: page`, original and copy on one sheet.

## Tasks

Fourteen tasks. Each owns a set of files; a task never edits files owned by another task. If a task needs a contract change in `src/shared/types.ts` or `src/shared/api.ts`, it stops and reports instead of editing.

| ID | Task | Owns | Depends on | Done when |
| --- | --- | --- | --- | --- |
| T0 | Scaffold and contracts | Root configs, `package.json` (all dependencies), `CLAUDE.md`, `src/shared/**`, `src/preload/index.ts`, `src/main/index.ts`, `renderer/src/main.tsx`, `router.tsx`, `components/Layout.tsx`, placeholder component in every `routes/*` folder | — | `npm run dev` opens a window with sidebar and placeholder screens; `api.ts` declares every method T5–T12 need; `money.ts` tests pass (`"30.000,00"` ↔ 3000000 cents); builder config has `asarUnpack` for `better-sqlite3` and `drizzle/` as `extraResources`; `test:db` script runs Vitest through Electron as Node |
| T1 | Calculation engine | `src/engine/**` | T0 | Test cases 1–9 pass; no imports outside `src/engine` and `src/shared` |
| T2 | Database | `src/main/db/**`, `src/main/repos/**`, `drizzle/**` | T0 | Migrations create all tables; DB at `userData/recibos.db`; migrations run before the window opens; idempotent seed (conceptos, 2026 parametros and franjas); repo tests pass via `test:db` |
| T3 | UI kit and API hooks | `renderer/src/api/**`, `components/MoneyInput.tsx` | T0 | `client.ts` wraps `window.api` and surfaces errors as typed results; one TanStack Query hook per API method with invalidation; `MoneyInput` round-trips `"30.000,00"` |
| T4 | Receipt template | `components/Recibo.tsx`, `routes/print/**` | T0 | Carmona 08/2024 fixture renders matching `recibo1.pdf` (original + copy on one A4); print route renders N receipts with page breaks and signals ready |
| T5 | CRUD IPC | `main/ipc/empresa.ts`, `trabajadores.ts`, `parametros.ts` | T2 | Zod-validated handlers; new condición never edits past rows; new parameter version duplicates the latest |
| T6 | Liquidaciones service | `main/services/liquidaciones.ts`, `main/ipc/liquidaciones.ts` | T1, T2 | Create resolves conditions and parameters by period and fails with a named reason; recalc keeps overrides; emitir snapshots empresa and trabajador; reabrir works; writes to an emitida are rejected |
| T7 | PDF and print | `main/services/pdf.ts`, `main/ipc/pdf.ts` | T2, T4 | Hidden window loads `#/print/:id`, waits for ready, `printToPDF` A4; single file or one per worker named `Nombre--dd-mm-yyyy.pdf`; `print()` with printer selection |
| T8 | Backup | `main/services/backup.ts`, `main/ipc/backup.ts` | T2 | Uses `better-sqlite3` `backup()` to a folder chosen in a dialog; timestamped filename |
| T9 | Empresa, Parámetros, Respaldo screens | `routes/empresa/**`, `routes/parametros/**`, `routes/respaldo/**` | T3, T5, T8 | Forms validate with Zod and save through the real API; IRPF brackets editable as a table; "Nueva versión" prefilled from latest |
| T10 | Trabajadores screens | `routes/trabajadores/**` | T3, T5 | List with active filter; identity form; condiciones history with "Nueva condición", all against the real API |
| T11 | Liquidaciones screens | `routes/liquidaciones/**` | T3, T6, T7 | List and detail per UI spec; blocked-creation message shown; Recalcular, Emitir, Reabrir, Exportar PDF and Imprimir work end to end |
| T12 | Recibo editor | `routes/recibo/**` | T3, T4, T6 | Manual inputs, override control with marker and "restaurar", live preview via `Recibo.tsx`, autosave, read-only when emitida |
| T13 | Integration and packaging | Fixes anywhere, one commit per fix | All | Full flow (empresa, 2 workers, liquidación, FONASA override, emitir, PDF, print); portable build starts on a clean Windows machine and creates the DB |

## Parallelization

T0 runs alone, then three phases of four parallel worktrees (T1–T4, T5–T8, T9–T12), then T13 alone.

&#91;embedded content: task dependencies · 5 phases, 14 tasks\]

A task starts as soon as its own dependencies are merged; it doesn't wait for the rest of the previous phase. The UI screens (T9–T12) build against the real services; each one waits for the services it calls.

Merge order inside each phase, so the next phase can start early:

1. Phase 1: T2 first (all of Phase 2 needs it), then T1 and T4, then T3.
2. Phase 2: T5 first (unblocks T9 and T10), then T6 and T7 (unblock T11 and T12), then T8.
3. Phase 3: T10 first, then T9, T11, T12 in any order.
4. T13 after every branch is merged.

Conflict risk is low by design. Only T13 may touch files owned by other tasks.

## Worktree workflow

One git worktree and one Claude Code session per task, each branched from an up-to-date `main`.

```bash
# from the main checkout, after the previous phase is merged
git pull
git worktree add ../recibos-t1 -b t1-engine
cd ../recibos-t1
npm install            # each worktree has its own node_modules; rebuilds better-sqlite3
claude
```

Prompt to start each session:

```
Implement task T1 from PLAN.md. Follow CLAUDE.md. Only create or edit the files T1 owns.
If you need a change in src/shared/types.ts or src/shared/api.ts, stop and describe it.
Finish when every "Done when" item passes, then run typecheck, lint and tests.
```

Merging:

1. In the worktree: `git rebase main`, then `npm run typecheck && npm run lint && npm test`.
2. In the main checkout: `git merge --ff-only t1-engine`.
3. Clean up: `git worktree remove ../recibos-t1` and `git branch -d t1-engine`.

Contract changes found mid-phase: make them on `main` as one small commit, then `git rebase main` in every open worktree.

Rules for every session:

- Don't run `npm install <pkg>`; dependencies are fixed in T0. A missing package is reported, not added.
- Don't edit `drizzle/` outside T2. A schema change needed later is a new migration on `main`.
- `npm run dev` in several worktrees at once needs different ports: set the renderer port per worktree in `.env.local`.
