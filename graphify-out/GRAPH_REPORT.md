# Graph Report - uy-paycheck-generator  (2026-10-28)

## Corpus Check
- 179 files · ~69,942 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .css 5, (none) 3, .woff2 2)

## Summary
- 1104 nodes · 3202 edges · 55 communities (42 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.86)
- Token cost: 507,095 input · 0 output

## Community Hubs (Navigation)
- Renderer Tests & Icons
- Paycheck Calculation Engine
- Electron Main Bootstrap
- Parametros Help & Forms
- UI Kit Components
- Recibo Rendering & Queries
- TanStack Mutation Hooks
- Money & Parsed Inputs
- Trabajador Forms & Hooks
- IPC Domain Handlers
- Liquidaciones Service & Repos
- Renderer API Client
- Trabajador Repo & ApiSpec
- DB Open, Seed & Migrations
- Release Workflow
- Liquidaciones Repo & PDF Tests
- Drizzle Schema
- Electron Builder Config
- Dev Dependencies
- Empresa & Parametros Pages
- Web TS Config
- Package Metadata
- Node TS Config
- ESLint Import Boundaries
- Printed Recibo Layout
- Recibo Repo Types
- Print Pipeline & Screens Plan
- Data Model & Legal Sources
- Task Plan & Worktrees
- Runtime Dependencies
- npm Scripts
- Contribution Rules & Overrides
- Recibo Editor Screen
- Parametros Screen
- Repo Guide & Architecture
- DB, Backup & CRUD Tasks
- Liquidaciones Screen
- Liquidacion Detail Screen
- Vite & Vitest Config
- IPC Contract
- README Scope & Features
- Trabajador Detail Screen
- BrowserWindow API
- Drizzle Kit
- Root TS Config
- Money Conventions
- cross-env
- PostCSS
- PostCSS Mantine Preset
- React DOM
- better-sqlite3 Types
- Node Types
- React Types
- Haberes Step

## God Nodes (most connected - your core abstractions)
1. `vitest` - 46 edges
2. `errorMessage()` - 42 edges
3. `@mantine/core` - 34 edges
4. `AppError` - 33 edges
5. `react` - 29 edges
6. `instalarApi()` - 23 edges
7. `ApiSpec` - 23 edges
8. `@testing-library/react` - 22 edges
9. `ok()` - 22 edges
10. `Detalle()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Worktree isolation per task` --semantically_similar_to--> `Git worktree workflow per task`  [INFERRED] [semantically similar]
  .claude/agents/task-implementer.md → PLAN.md
- `task-implementer agent` --references--> `Frozen IPC contract (types.ts, api.ts)`  [INFERRED]
  .claude/agents/task-implementer.md → CLAUDE.md
- `task-implementer agent` --references--> `CLAUDE.md repo working guide`  [EXTRACTED]
  .claude/agents/task-implementer.md → CLAUDE.md
- `task-implementer agent` --implements--> `Tasks T0-T13 with file ownership`  [INFERRED]
  .claude/agents/task-implementer.md → PLAN.md
- `Content-Security-Policy (self-only scripts)` --conceptually_related_to--> `secureWebPreferences() (contextIsolation, sandbox, no nodeIntegration)`  [INFERRED]
  src/renderer/index.html → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paycheck calculation pipeline steps** — plan_calcularrecibo, plan_step_haberes, plan_step_montepio_frl, plan_step_fonasa, plan_step_irpf, plan_step_redondeo [EXTRACTED 1.00]
- **Nine-table SQLite data model** — plan_table_empresa, plan_table_trabajadores, plan_table_trabajador_condiciones, plan_table_parametros, plan_table_irpf_franjas, plan_table_conceptos, plan_table_liquidaciones, plan_table_recibos, plan_table_recibo_lineas [EXTRACTED 1.00]
- **Typed IPC contract flow (validation, handlers, ApiResult, renderer client)** — claude_frozen_ipc_contract, claude_inputschemas_validation, claude_ipc_handler_register_pattern, claude_apperror, claude_apiresult, claude_renderer_api_layer [INFERRED 0.85]
- **Liquidaciones dashboard layout** — docs_screenshots_01_liquidaciones_draft_liquidacion_card, docs_screenshots_01_liquidaciones_summary_stat_cards, docs_screenshots_01_liquidaciones_historial_table, docs_screenshots_01_liquidaciones_nueva_liquidacion_action [EXTRACTED 1.00]
- **Liquidación totals shown consistently across cards, table and money format** — docs_screenshots_02_liquidacion_summary_totals_cards, docs_screenshots_02_liquidacion_recibos_table, docs_screenshots_02_liquidacion_uruguayan_money_format [INFERRED 0.85]
- **Receipt edit inputs feed live receipt preview** — docs_screenshots_03_recibo_editor_dias_no_trabajados, docs_screenshots_03_recibo_editor_lineas_manuales, docs_screenshots_03_recibo_editor_conceptos_calculados, docs_screenshots_03_recibo_editor_recibo_preview [INFERRED 0.85]
- **Worker profile: identity data plus versioned salary conditions** — docs_screenshots_04_trabajador_datos_form, docs_screenshots_04_trabajador_condiciones_section, docs_screenshots_04_trabajador_condicion_en_uso_banner, docs_screenshots_04_trabajador_fonasa_irpf_dependents [INFERRED 0.85]
- **Versioned legal rate table driving paycheck calculation** — docs_screenshots_05_parametros_vigente_desde_versioning, docs_screenshots_05_parametros_general_section, docs_screenshots_05_parametros_fonasa_section, docs_screenshots_05_parametros_valor_bpc [INFERRED 0.85]
- **Personal social security contributions on the taxable base** — docs_screenshots_06_recibo_impreso_montepio, docs_screenshots_06_recibo_impreso_fonasa, docs_screenshots_06_recibo_impreso_frl [INFERRED 0.85]

## Communities (55 total, 13 thin omitted)

### Community 0 - "Renderer Tests & Icons"
Cohesion: 0.06
Nodes (58): @tanstack/react-query, @testing-library/react, @testing-library/user-event, vitest, queryKeys, hookByMethod, responde(), setup() (+50 more)

### Community 1 - "Paycheck Calculation Engine"
Cohesion: 0.06
Nodes (73): decimal.js, aporte(), calcularRecibo(), CalcularReciboInput, CalcularReciboResultado, CondicionesCalculo, DESCRIPCIONES_DEFAULT, LineaSinOrden (+65 more)

### Community 2 - "Electron Main Bootstrap"
Cohesion: 0.07
Nodes (47): electron@^44.4.5, electron, closeDb(), dbPath(), initDb(), migrationsFolder(), setDb(), createMainWindow() (+39 more)

### Community 3 - "Parametros Help & Forms"
Cohesion: 0.06
Nodes (43): AYUDA, AYUDA_FRANJA, Escalar, Etiqueta(), version2026, BPC_FIELDS, BpcField, bpcText (+35 more)

### Community 4 - "UI Kit Components"
Cohesion: 0.09
Nodes (30): dayjs, @mantine/core, react, react-router, useLiquidaciones(), PageHeaderProps, StatCard(), StatCardProps (+22 more)

### Community 5 - "Recibo Rendering & Queries"
Cohesion: 0.10
Nodes (31): useApiQuery(), useDatosImpresion(), useLiquidacion(), useRecibo(), iniciales(), PersonAvatar(), Campo(), Ejemplar (+23 more)

### Community 6 - "TanStack Mutation Hooks"
Cohesion: 0.11
Nodes (36): afterLiquidacionChange(), invalidate(), MutationOptions, MutationResult, noCacheChange(), QueryOptions, QueryResult, sameKey() (+28 more)

### Community 7 - "Money & Parsed Inputs"
Cohesion: 0.12
Nodes (31): useTasaFonasa(), display(), MoneyInput(), MoneyInputProps, parse(), Controlled(), TextoParseadoInput(), TextoParseadoInputProps (+23 more)

### Community 8 - "Trabajador Forms & Hooks"
Cohesion: 0.15
Nodes (30): isApiErrorCode(), afterTrabajadorChange(), useActualizarTrabajador(), useCrearTrabajador(), useNuevaCondicion(), useTrabajador(), useTrabajadores(), CondicionForm() (+22 more)

### Community 9 - "IPC Domain Handlers"
Cohesion: 0.12
Nodes (23): register(), register(), register(), EMPRESA, canales(), electronMock, errorCode(), invocar() (+15 more)

### Community 10 - "Liquidaciones Service & Repos"
Cohesion: 0.13
Nodes (27): ConceptosRepo, EmpresaRepo, TrabajadoresRepo, assertNumeroLibre(), LiquidacionesService, assertBorrador(), getLiquidacion(), reciboDetalle() (+19 more)

### Community 11 - "Renderer API Client"
Cohesion: 0.12
Nodes (21): AnyMethod, ApiRequestError, call(), CallArgs, callOrThrow(), failure(), isApiResult(), toApiError() (+13 more)

### Community 12 - "Trabajador Repo & ApiSpec"
Cohesion: 0.20
Nodes (24): ENTRADAS_VACIAS, TasaFonasaInput, Props, ApiFunction, ApiSpec, Id, Condicion, CondicionInput (+16 more)

### Community 13 - "DB Open, Seed & Migrations"
Cohesion: 0.12
Nodes (18): Db, openDatabase(), TABLES, CONCEPTOS_SEED, ConceptoSeed, PARAMETROS_2026, seed(), MIGRATIONS_FOLDER (+10 more)

### Community 14 - "Release Workflow"
Cohesion: 0.07
Nodes (27): concurrency, cancel-in-progress, group, run, GH_TOKEN, jobs, release, name (+19 more)

### Community 15 - "Liquidaciones Repo & PDF Tests"
Cohesion: 0.09
Nodes (23): LiquidacionesRepo, conceptoIds(), writeLineas(), detalle(), condicion(), crearLiquidacion(), datosHandler, EMPRESA (+15 more)

### Community 16 - "Drizzle Schema"
Cohesion: 0.17
Nodes (19): drizzle-orm, Conn, getDb(), ajustes, conceptos, empresa, irpfFranjas, liquidaciones (+11 more)

### Community 17 - "Electron Builder Config"
Cohesion: 0.08
Nodes (25): appId, asarUnpack, directories, buildResources, output, extraResources, from, to (+17 more)

### Community 18 - "Dev Dependencies"
Cohesion: 0.09
Nodes (23): devDependencies, electron-builder@^26.15.3, jsdom@^27.0.1, @mantine/core@^9.6.3, @mantine/dates@^9.6.3, @mantine/form@^9.6.3, @mantine/notifications@^9.6.3, react@^19.3.0 (+15 more)

### Community 19 - "Empresa & Parametros Pages"
Cohesion: 0.17
Nodes (17): @mantine/form, errorMessage(), useEmpresa(), useParametros(), useRespaldoInfo(), PageHeader(), EmpresaForm(), EmpresaPage() (+9 more)

### Community 20 - "Web TS Config"
Cohesion: 0.09
Nodes (21): compilerOptions, composite, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+13 more)

### Community 21 - "Package Metadata"
Cohesion: 0.10
Nodes (20): author, description, @mantine/hooks@^9.6.3, @mantine/modals@^9.6.3, postcss-simple-vars@^7.0.1, @testing-library/dom@^10.4.2, typescript@^6.0.3, engines (+12 more)

### Community 22 - "Node TS Config"
Cohesion: 0.10
Nodes (20): compilerOptions, composite, esModuleInterop, isolatedModules, lib, module, moduleResolution, noFallthroughCasesInSwitch (+12 more)

### Community 23 - "ESLint Import Boundaries"
Cohesion: 0.13
Nodes (13): nodeAndDb, noEngine, noUi, eslint@^10.11.0, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, globals@^17.12.0, typescript-eslint@^8.71.0 (+5 more)

### Community 24 - "Printed Recibo Layout"
Cohesion: 0.16
Nodes (12): Empresa header (RUT, MTSS, BPS, BSE, grupo/subgrupo), Firma del trabajador / recibi conforme, FONASA (4,5%), FRL (0,125%), Imponible IRPF, Recibo lines table (Concepto, Cantidad, Valor unit., Haberes, Descuentos), Liquidacion metadata (remuneracion, tipo N, fecha de cargo, fecha de pago), Liquido a cobrar (+4 more)

### Community 25 - "Recibo Repo Types"
Cohesion: 0.23
Nodes (11): ReciboData, ReciboRow, EMPRESA, setup(), trabajador(), Congelado, Empresa, Linea (+3 more)

### Community 26 - "Print Pipeline & Screens Plan"
Cohesion: 0.17
Nodes (12): Hidden print window loading print route (datosImpresion, listo), Router page exports (LiquidacionesPage, ReciboEditorPage, PrintPage, ...), secureWebPreferences() (contextIsolation, sandbox, no nodeIntegration), Print rules (A4, original + copy, Tipo de liquidación N), T11 Liquidaciones screens, T12 Recibo editor, T4 Receipt template, T7 PDF and print (+4 more)

### Community 27 - "Data Model & Legal Sources"
Cohesion: 0.21
Nodes (11): Legal sources (BPS Comunicado R 5/2026, Tasas Fonasa, Decreto 148/007, Decreto 11/026), calcularRecibo pure calculation function, Data model (nine tables), Engine test cases 1-9, 2026 seed values (BPC 6.864, tasas, franjas), T1 Calculation engine, T6 Liquidaciones service, irpf_franjas table (+3 more)

### Community 28 - "Task Plan & Worktrees"
Cohesion: 0.22
Nodes (7): task-implementer agent, Mantine schemaResolver with Zod 4 (Standard Schema), PLAN.md Recibos de sueldo implementation plan, mafty.tsx Excel-template script (replaced), Tech stack (Electron, React, Mantine, SQLite, Drizzle, decimal.js), T13 Integration and packaging, Tasks T0-T13 with file ownership

### Community 29 - "Runtime Dependencies"
Cohesion: 0.18
Nodes (10): dependencies, better-sqlite3@^13.0.3, dayjs@^1.11.23, decimal.js@^10.6.0, drizzle-orm@^0.45.3, electron-updater@^6.8.9, zod@^4.6.5, better-sqlite3 (+2 more)

### Community 30 - "npm Scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, dev, lint, package, preview, test (+3 more)

### Community 31 - "Contribution Rules & Overrides"
Cohesion: 0.20
Nodes (9): Receipt overrides JSON (montepioTasa, fonasaTasa, frlTasa, irpfImporte), FONASA band and rate calculation, IRPF calculation (6% increment, brackets, deducciones, tasa 14%/8%), Montepío and FRL calculation, conceptos table (seeded catalog), empresa table, liquidaciones table (borrador/emitida), recibo_lineas table (+1 more)

### Community 32 - "Recibo Editor Screen"
Cohesion: 0.33
Nodes (9): Aportes personales (Montepio, FONASA, FRL), Conceptos calculados table, Dias no trabajados input, Lineas manuales (manual lines), Recibo Editor Screen (screenshot), Recibo de sueldo live preview, Redondeo line, App Sidebar Navigation (+1 more)

### Community 33 - "Parametros Screen"
Cohesion: 0.25
Nodes (7): App shell sidebar navigation, FONASA rates by franja and family situation, General parameters (Valor BPC, Tope montepío, Montepío, FRL), Nueva versión action, ParametrosPage (versioned legal parameters screen), Parámetros screen screenshot, Valor BPC

### Community 34 - "Repo Guide & Architecture"
Cohesion: 0.25
Nodes (4): npm scripts (dev, typecheck, lint, test, test:db, db:generate, package), CLAUDE.md repo working guide, Project structure (engine/shared/main/preload/renderer), T0 Scaffold and contracts

### Community 35 - "DB, Backup & CRUD Tasks"
Cohesion: 0.29
Nodes (8): initDb() opens userData/recibos.db, migrates, seeds, Runtime drizzle migrations folder (resources/drizzle when packaged), T10 Trabajadores screens, T2 Database, T5 CRUD IPC, T8 Backup, T9 Empresa, Parámetros, Respaldo screens, Installation (setup.exe / portable.exe, %APPDATA% recibos.db)

### Community 36 - "Liquidaciones Screen"
Cohesion: 0.36
Nodes (8): Current Draft Liquidacion Card, Estado Badge (BORRADOR / EMITIDA), Historial Table (Periodo, Fecha de pago, Estado, Recibos, Total liquido), Liquidaciones Screen (screenshot), Nueva liquidacion Button, Sidebar Navigation (Liquidaciones, Trabajadores, Parametros, Empresa, Respaldo, Colapsar menu), Summary Stat Cards (Recibos, Total liquido estimado), Uruguayan Money Format (170.487,00)

### Community 37 - "Liquidacion Detail Screen"
Cohesion: 0.39
Nodes (8): App shell sidebar navigation, Estado badge (Borrador), Liquidación actions (Recalcular, Emitir, Vista previa, Exportar o imprimir), Liquidación detail screen (screenshot), Print recibo action, Recibos per trabajador table, Summary totals cards (haberes, descuentos, líquido), Uruguayan money format (30.000,00)

### Community 38 - "Vite & Vitest Config"
Cohesion: 0.25
Nodes (6): sharedAlias, electron-vite@^5.0.0, @vitejs/plugin-react@^5.2.0, electron-vite, @vitejs/plugin-react, alias

### Community 39 - "IPC Contract"
Cohesion: 0.33
Nodes (6): ApiResult<T> ok/error union (never rejects), AppError (expected failures; else INTERNO), inputSchemas[domain][method] Zod validation in main, IPC handler register() pattern with handle(), Renderer api layer (client.ts + TanStack hooks.ts), T3 UI kit and API hooks

### Community 40 - "README Scope & Features"
Cohesion: 0.29
Nodes (6): Scope (in/out: no aguinaldo, salario vacacional, jornaleros), Redondeo: líquido rounded up to next peso, Feature list (empresa, trabajadores, cálculo, emitir/reabrir, PDF, respaldo), GitHub Actions release on version bump, README Recibos de sueldo, Screenshots (docs/screenshots/*.png)

### Community 41 - "Trabajador Detail Screen"
Cohesion: 0.33
Nodes (7): App Sidebar Navigation, Condicion en uso Banner, Condiciones (salary conditions history), Trabajador Datos Form, Estado Badge (ACTIVO), FONASA / IRPF dependents flags, Trabajador Detail Screen (screenshot)

## Knowledge Gaps
- **39 isolated node(s):** `Mantine schemaResolver with Zod 4 (Standard Schema)`, `Uruguayan money format helpers (parseMoney/formatMoney, parseRatePercent/formatRatePercent)`, `Runtime drizzle migrations folder (resources/drizzle when packaged)`, `Router page exports (LiquidacionesPage, ReciboEditorPage, PrintPage, ...)`, `mafty.tsx Excel-template script (replaced)` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 297 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Renderer Tests & Icons` to `Paycheck Calculation Engine`, `Electron Main Bootstrap`, `Parametros Help & Forms`, `UI Kit Components`, `Recibo Rendering & Queries`, `Vite & Vitest Config`, `Money & Parsed Inputs`, `Trabajador Forms & Hooks`, `IPC Domain Handlers`, `Liquidaciones Service & Repos`, `Renderer API Client`, `DB Open, Seed & Migrations`, `Liquidaciones Repo & PDF Tests`, `Dev Dependencies`, `Package Metadata`, `Recibo Repo Types`, `Runtime Dependencies`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `Mantine schemaResolver with Zod 4 (Standard Schema)`, `Uruguayan money format helpers (parseMoney/formatMoney, parseRatePercent/formatRatePercent)`, `Runtime drizzle migrations folder (resources/drizzle when packaged)` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Renderer Tests & Icons` be split into smaller, more focused modules?**
  _Cohesion score 0.057373737373737375 - nodes in this community are weakly interconnected._
- **Why does `@mantine/core` connect `UI Kit Components` to `Renderer Tests & Icons`, `Paycheck Calculation Engine`, `Parametros Help & Forms`, `Recibo Rendering & Queries`, `TanStack Mutation Hooks`, `Money & Parsed Inputs`, `Trabajador Forms & Hooks`, `Dev Dependencies`, `Empresa & Parametros Pages`, `Package Metadata`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `Paycheck Calculation Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.058177278401997504 - nodes in this community are weakly interconnected._
- **Why does `react` connect `UI Kit Components` to `Renderer Tests & Icons`, `Paycheck Calculation Engine`, `Parametros Help & Forms`, `Recibo Rendering & Queries`, `TanStack Mutation Hooks`, `Money & Parsed Inputs`, `Trabajador Forms & Hooks`, `Renderer API Client`, `Dev Dependencies`, `Empresa & Parametros Pages`, `Package Metadata`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Electron Main Bootstrap` be split into smaller, more focused modules?**
  _Cohesion score 0.0744047619047619 - nodes in this community are weakly interconnected._