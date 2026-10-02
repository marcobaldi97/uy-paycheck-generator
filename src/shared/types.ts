// Domain types shared by main, preload and renderer. CONTRACT: frozen after T0.
// Everything here must stay serializable (it crosses IPC): no Decimal, no Date, no classes.

/** Integer amount in cents (pesos × 100). */
export type Cents = number
/** Rate as a decimal string, e.g. "0.15" for 15%. Never a float. */
export type Rate = string
/** Non-money decimal as a string, e.g. "2.5" (BPC multiples). */
export type DecimalString = string
/** ISO date, `YYYY-MM-DD`. */
export type IsoDate = string
/** ISO date-time, e.g. `2026-09-28T14:05:00.000Z`. */
export type IsoDateTime = string
/** Liquidation period, `YYYY-MM`. */
export type Periodo = string

// ---------------------------------------------------------------- empresa

export interface Empresa {
  nombre: string
  direccion: string
  rut: string
  nroMtss: string
  grupo: string
  subgrupo: string
}

// ---------------------------------------------------------------- trabajadores

export interface Trabajador {
  id: number
  numero: number
  ci: string
  nombre: string
  cargo: string
  fechaIngreso: IsoDate
  afiliacionBps: string
  carpetaBse: string
  activo: boolean
}

export type TrabajadorInput = Omit<Trabajador, 'id'>

export type IrpfPctAtribucion = 100 | 50

/** One version of a worker's salary conditions. Rows are never edited once created. */
export interface Condicion {
  id: number
  trabajadorId: number
  vigenteDesde: IsoDate
  sueldoNominal: Cents
  fonasaConyuge: boolean
  fonasaHijos: boolean
  /** Replaces the computed FONASA rate for this worker when set. */
  fonasaTasaManual: Rate | null
  irpfHijos: number
  irpfHijosDiscapacidad: number
  irpfPctAtribucion: IrpfPctAtribucion
  /** Monthly amount. */
  irpfOtrasDeducciones: Cents
}

export type CondicionInput = Omit<Condicion, 'id' | 'trabajadorId'>

export interface TrabajadorDetalle {
  trabajador: Trabajador
  /** Newest first. */
  condiciones: Condicion[]
}

/** FONASA rate main would pick for a sueldo and family flags, under the parámetros in force. */
export interface TasaFonasaPreview {
  tasa: Rate
  /** True when the sueldo is above `fonasaUmbralBpc` × BPC. */
  bandaAlta: boolean
  /** vigenteDesde of the parámetros version used. */
  parametrosVigenteDesde: IsoDate
}

// ---------------------------------------------------------------- parámetros

export interface FranjaIrpf {
  desdeBpc: DecimalString
  /** null = no upper bound. */
  hastaBpc: DecimalString | null
  tasa: Rate
}

export interface Parametros {
  vigenteDesde: IsoDate
  bpc: Cents
  montepio: Rate
  frl: Rate
  /** Cap on the montepío base; null = no cap. */
  topeMontepio: Cents | null
  fonasaUmbralBpc: DecimalString
  fonasaBajoSinConyuge: Rate
  fonasaBajoConConyuge: Rate
  fonasaAltoSinCargas: Rate
  fonasaAltoHijos: Rate
  fonasaAltoConyuge: Rate
  fonasaAltoConyugeHijos: Rate
  irpfIncrementoUmbralBpc: DecimalString
  irpfIncremento: Rate
  irpfDeduccionUmbralBpc: DecimalString
  irpfTasaDeduccionBaja: Rate
  irpfTasaDeduccionAlta: Rate
  irpfHijoBpcAnual: DecimalString
  irpfHijoDiscBpcAnual: DecimalString
}

/** A parameter version together with its IRPF brackets (ordered by desdeBpc). */
export interface ParametrosVersion extends Parametros {
  franjas: FranjaIrpf[]
}

// ---------------------------------------------------------------- conceptos and receipt lines

export type TipoConcepto = 'haber' | 'descuento'

/** Codes of the seeded conceptos. */
export type CodigoConcepto =
  | 'SUELDO'
  | 'DIAS_NO_TRABAJADOS'
  | 'MONTEPIO'
  | 'FONASA'
  | 'FRL'
  | 'IRPF'
  | 'REDONDEO'

export interface Concepto {
  id: number
  codigo: CodigoConcepto
  descripcion: string
  tipo: TipoConcepto
  gravadoBps: boolean
  gravadoIrpf: boolean
  calculo: 'auto' | 'manual'
  orden: number
}

/** A line the user adds by hand in the receipt editor. */
export interface LineaManual {
  descripcion: string
  tipo: TipoConcepto
  cantidad: DecimalString | null
  valorUnitario: Cents | null
  importe: Cents
  gravadoBps: boolean
  gravadoIrpf: boolean
}

/** A printed receipt line. */
export interface Linea {
  /** Seeded concepto code; null for manual lines. */
  codigo: CodigoConcepto | null
  descripcion: string
  /** Days, hours or a rate, depending on the line; null when not shown. */
  cantidad: DecimalString | null
  /** Unit value or base amount; null when not shown. */
  valorUnitario: Cents | null
  /** Always positive for normal lines; negative allowed (días no trabajados, redondeo). */
  importe: Cents
  tipo: TipoConcepto
  orden: number
  origen: 'auto' | 'manual'
  /** True when an override changed this line. Shown in the editor, never printed. */
  override: boolean
}

export interface Overrides {
  montepioTasa?: Rate
  fonasaTasa?: Rate
  frlTasa?: Rate
  irpfImporte?: Cents
}

// ---------------------------------------------------------------- liquidaciones and recibos

export type EstadoLiquidacion = 'borrador' | 'emitida'

export interface Liquidacion {
  id: number
  periodo: Periodo
  fechaCargo: IsoDate
  fechaPago: IsoDate
  estado: EstadoLiquidacion
}

export interface NuevaLiquidacionInput {
  periodo: Periodo
  fechaCargo: IsoDate
  fechaPago: IsoDate
}

export interface LiquidacionResumen extends Liquidacion {
  cantidadRecibos: number
  totalLiquido: Cents
}

export interface ReciboTotales {
  imponibleBps: Cents
  imponibleIrpf: Cents
  totalHaberes: Cents
  totalDescuentos: Cents
  liquido: Cents
}

export interface ReciboResumen {
  id: number
  trabajadorId: number
  trabajadorNombre: string
  totalHaberes: Cents
  totalDescuentos: Cents
  liquido: Cents
  tieneOverrides: boolean
}

export interface LiquidacionDetalle {
  liquidacion: Liquidacion
  recibos: ReciboResumen[]
  totales: {
    totalHaberes: Cents
    totalDescuentos: Cents
    liquido: Cents
  }
}

/** What the user edits on a receipt. Main recomputes lines from these. */
export interface ReciboEntradas {
  diasNoTrabajados: number
  lineasManuales: LineaManual[]
  overrides: Overrides | null
}

/** Values the engine computed without overrides, so the editor can show them and "restaurar". */
export interface ValoresCalculados {
  montepioTasa: Rate
  fonasaTasa: Rate
  frlTasa: Rate
  irpfImporte: Cents
}

/** Worker data as printed on a receipt (snapshotted when the liquidación is emitida). */
export interface TrabajadorSnapshot extends Omit<Trabajador, 'activo'> {
  sueldoNominal: Cents
}

/** Everything `Recibo.tsx` needs to render one receipt (original + copy). */
export interface ReciboImpresion {
  reciboId: number
  empresa: Empresa
  trabajador: TrabajadorSnapshot
  liquidacion: Pick<Liquidacion, 'periodo' | 'fechaCargo' | 'fechaPago'>
  lineas: Linea[]
  totales: ReciboTotales
}

export interface ReciboDetalle {
  id: number
  liquidacionId: number
  trabajadorId: number
  estado: EstadoLiquidacion
  entradas: ReciboEntradas
  valoresCalculados: ValoresCalculados
  lineas: Linea[]
  totales: ReciboTotales
  impresion: ReciboImpresion
}

// ---------------------------------------------------------------- pdf, print, respaldo

export type ModoExportacion = 'unico' | 'por_trabajador'

export interface ResultadoExportacion {
  cancelado: boolean
  /** Absolute paths of the written files. */
  archivos: string[]
}

export interface Impresora {
  nombre: string
  predeterminada: boolean
}

export interface RespaldoInfo {
  ultimoRespaldo: IsoDateTime | null
  ubicacionDb: string
}

export interface ResultadoRespaldo {
  cancelado: boolean
  archivo: string | null
}
