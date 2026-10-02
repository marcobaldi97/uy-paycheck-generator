// Drizzle schema. `npm run db:generate` turns changes here into a migration in drizzle/.
// Money columns are integer cents; rates and BPC multiples are decimal strings; dates are ISO text.

import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type {
  CodigoConcepto,
  Empresa,
  EstadoLiquidacion,
  IrpfPctAtribucion,
  LineaManual,
  Overrides,
  TipoConcepto,
  TrabajadorSnapshot,
} from '@shared/types'

/** Single row, id always 1. */
export const empresa = sqliteTable(
  'empresa',
  {
    id: integer('id').primaryKey(),
    nombre: text('nombre').notNull(),
    direccion: text('direccion').notNull(),
    rut: text('rut').notNull(),
    nroMtss: text('nro_mtss').notNull(),
    grupo: text('grupo').notNull(),
    subgrupo: text('subgrupo').notNull(),
  },
  (t) => [check('empresa_single_row', sql`${t.id} = 1`)],
)

export const trabajadores = sqliteTable(
  'trabajadores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    numero: integer('numero').notNull(),
    ci: text('ci').notNull(),
    nombre: text('nombre').notNull(),
    cargo: text('cargo').notNull(),
    fechaIngreso: text('fecha_ingreso').notNull(),
    afiliacionBps: text('afiliacion_bps').notNull(),
    carpetaBse: text('carpeta_bse').notNull(),
    lugarCobro: text('lugar_cobro').notNull(),
    lugarTrabajo: text('lugar_trabajo').notNull(),
    activo: integer('activo', { mode: 'boolean' }).notNull(),
  },
  (t) => [uniqueIndex('trabajadores_numero_unique').on(t.numero)],
)

/** Versioned by vigente_desde; rows are never edited once created. */
export const trabajadorCondiciones = sqliteTable(
  'trabajador_condiciones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trabajadorId: integer('trabajador_id')
      .notNull()
      .references(() => trabajadores.id, { onDelete: 'cascade' }),
    vigenteDesde: text('vigente_desde').notNull(),
    sueldoNominal: integer('sueldo_nominal').notNull(),
    fonasaConyuge: integer('fonasa_conyuge', { mode: 'boolean' }).notNull(),
    fonasaHijos: integer('fonasa_hijos', { mode: 'boolean' }).notNull(),
    fonasaTasaManual: text('fonasa_tasa_manual'),
    irpfHijos: integer('irpf_hijos').notNull(),
    irpfHijosDiscapacidad: integer('irpf_hijos_discapacidad').notNull(),
    irpfPctAtribucion: integer('irpf_pct_atribucion').$type<IrpfPctAtribucion>().notNull(),
    irpfOtrasDeducciones: integer('irpf_otras_deducciones').notNull(),
  },
  (t) => [
    uniqueIndex('trabajador_condiciones_trabajador_vigente_unique').on(t.trabajadorId, t.vigenteDesde),
    check('trabajador_condiciones_pct', sql`${t.irpfPctAtribucion} in (50, 100)`),
  ],
)

/** Versioned legal parameters, identified by vigente_desde. */
export const parametros = sqliteTable('parametros', {
  vigenteDesde: text('vigente_desde').primaryKey(),
  bpc: integer('bpc').notNull(),
  montepio: text('montepio').notNull(),
  frl: text('frl').notNull(),
  topeMontepio: integer('tope_montepio'),
  fonasaUmbralBpc: text('fonasa_umbral_bpc').notNull(),
  fonasaBajoSinConyuge: text('fonasa_bajo_sin_conyuge').notNull(),
  fonasaBajoConConyuge: text('fonasa_bajo_con_conyuge').notNull(),
  fonasaAltoSinCargas: text('fonasa_alto_sin_cargas').notNull(),
  fonasaAltoHijos: text('fonasa_alto_hijos').notNull(),
  fonasaAltoConyuge: text('fonasa_alto_conyuge').notNull(),
  fonasaAltoConyugeHijos: text('fonasa_alto_conyuge_hijos').notNull(),
  irpfIncrementoUmbralBpc: text('irpf_incremento_umbral_bpc').notNull(),
  irpfIncremento: text('irpf_incremento').notNull(),
  irpfDeduccionUmbralBpc: text('irpf_deduccion_umbral_bpc').notNull(),
  irpfTasaDeduccionBaja: text('irpf_tasa_deduccion_baja').notNull(),
  irpfTasaDeduccionAlta: text('irpf_tasa_deduccion_alta').notNull(),
  irpfHijoBpcAnual: text('irpf_hijo_bpc_anual').notNull(),
  irpfHijoDiscBpcAnual: text('irpf_hijo_disc_bpc_anual').notNull(),
})

/** IRPF brackets, versioned together with parametros. */
export const irpfFranjas = sqliteTable(
  'irpf_franjas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vigenteDesde: text('vigente_desde')
      .notNull()
      .references(() => parametros.vigenteDesde, { onDelete: 'cascade', onUpdate: 'cascade' }),
    desdeBpc: text('desde_bpc').notNull(),
    hastaBpc: text('hasta_bpc'),
    tasa: text('tasa').notNull(),
  },
  (t) => [index('irpf_franjas_vigente_idx').on(t.vigenteDesde)],
)

/** Seeded catalog. */
export const conceptos = sqliteTable(
  'conceptos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    codigo: text('codigo').$type<CodigoConcepto>().notNull(),
    descripcion: text('descripcion').notNull(),
    tipo: text('tipo', { enum: ['haber', 'descuento'] }).$type<TipoConcepto>().notNull(),
    gravadoBps: integer('gravado_bps', { mode: 'boolean' }).notNull(),
    gravadoIrpf: integer('gravado_irpf', { mode: 'boolean' }).notNull(),
    calculo: text('calculo', { enum: ['auto', 'manual'] }).notNull(),
    orden: integer('orden').notNull(),
  },
  (t) => [uniqueIndex('conceptos_codigo_unique').on(t.codigo)],
)

export const liquidaciones = sqliteTable(
  'liquidaciones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    periodo: text('periodo').notNull(),
    fechaCargo: text('fecha_cargo').notNull(),
    fechaPago: text('fecha_pago').notNull(),
    estado: text('estado', { enum: ['borrador', 'emitida'] }).$type<EstadoLiquidacion>().notNull(),
  },
  (t) => [uniqueIndex('liquidaciones_periodo_unique').on(t.periodo)],
)

/**
 * One per worker per liquidación. Besides the planned columns, it stores the editor inputs
 * (`dias_no_trabajados`, `lineas_manuales`) so ReciboEntradas round-trips exactly.
 * Snapshots are null until the liquidación is emitida.
 */
export const recibos = sqliteTable(
  'recibos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    liquidacionId: integer('liquidacion_id')
      .notNull()
      .references(() => liquidaciones.id, { onDelete: 'cascade' }),
    trabajadorId: integer('trabajador_id')
      .notNull()
      .references(() => trabajadores.id, { onDelete: 'restrict' }),
    snapshotEmpresa: text('snapshot_empresa', { mode: 'json' }).$type<Empresa>(),
    snapshotTrabajador: text('snapshot_trabajador', { mode: 'json' }).$type<TrabajadorSnapshot>(),
    overrides: text('overrides', { mode: 'json' }).$type<Overrides>(),
    diasNoTrabajados: integer('dias_no_trabajados').notNull().default(0),
    lineasManuales: text('lineas_manuales', { mode: 'json' })
      .$type<LineaManual[]>()
      .notNull()
      .default(sql`'[]'`),
    imponibleBps: integer('imponible_bps').notNull(),
    imponibleIrpf: integer('imponible_irpf').notNull(),
    totalHaberes: integer('total_haberes').notNull(),
    totalDescuentos: integer('total_descuentos').notNull(),
    liquido: integer('liquido').notNull(),
  },
  (t) => [uniqueIndex('recibos_liquidacion_trabajador_unique').on(t.liquidacionId, t.trabajadorId)],
)

/** Printed lines. concepto_id is null for manual lines. */
export const reciboLineas = sqliteTable(
  'recibo_lineas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reciboId: integer('recibo_id')
      .notNull()
      .references(() => recibos.id, { onDelete: 'cascade' }),
    conceptoId: integer('concepto_id').references(() => conceptos.id),
    descripcion: text('descripcion').notNull(),
    cantidad: text('cantidad'),
    valorUnitario: integer('valor_unitario'),
    importe: integer('importe').notNull(),
    tipo: text('tipo', { enum: ['haber', 'descuento'] }).$type<TipoConcepto>().notNull(),
    orden: integer('orden').notNull(),
    origen: text('origen', { enum: ['auto', 'manual'] }).notNull(),
    override: integer('override', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('recibo_lineas_recibo_idx').on(t.reciboId)],
)

/** Small key-value store for app state (e.g. the last backup timestamp). */
export const ajustes = sqliteTable('ajustes', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
})
