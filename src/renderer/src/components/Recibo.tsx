// Receipt template: one A4 sheet with the original on top and the copy below.
// Used by the print route (PDF and printing, T7) and the live preview in the editor (T12).
// Pure presentation: every number comes from main in `ReciboImpresion`; nothing is computed here
// except formatting. `Linea.override` is deliberately never rendered.

import { formatMoney, formatRatePercent } from '@shared/money'
import type { CodigoConcepto, IsoDate, Linea, Periodo, ReciboImpresion } from '@shared/types'
import classes from './Recibo.module.css'

export type Ejemplar = 'ORIGINAL' | 'COPIA'

const EJEMPLARES: readonly Ejemplar[] = ['ORIGINAL', 'COPIA']

/** Lines whose `cantidad` is a rate (decimal string such as "0.15"), printed as a percent. */
const CODIGOS_TASA: ReadonlySet<CodigoConcepto> = new Set(['MONTEPIO', 'FONASA', 'FRL'])

/** Fixed: the app only produces liquidaciones tipo N (monthly salary). */
const TIPO_LIQUIDACION = 'N'

export interface ReciboProps {
  datos: ReciboImpresion
  className?: string
}

/** A full A4 sheet: original + copy. */
export function Recibo({ datos, className }: ReciboProps) {
  return (
    <div
      className={className ? `${classes.hoja} ${className}` : classes.hoja}
      data-recibo-id={datos.reciboId}
      data-testid="recibo-hoja"
    >
      {EJEMPLARES.map((ejemplar) => (
        <ReciboEjemplar key={ejemplar} datos={datos} ejemplar={ejemplar} />
      ))}
    </div>
  )
}

/** Half a sheet: one printed receipt. */
export function ReciboEjemplar({ datos, ejemplar }: { datos: ReciboImpresion; ejemplar: Ejemplar }) {
  const { empresa, trabajador, liquidacion, totales } = datos
  const lineas = [...datos.lineas].sort((a, b) => a.orden - b.orden)

  return (
    <section className={classes.copia} data-ejemplar={ejemplar} aria-label={`Recibo ${ejemplar.toLowerCase()}`}>
      <header className={classes.encabezado}>
        <div className={classes.empresa}>
          <p className={classes.empresaNombre}>{empresa.nombre}</p>
          <p className={classes.linea}>{empresa.direccion}</p>
          <p className={classes.linea}>
            <Etiqueta>RUT:</Etiqueta> {empresa.rut}
            {' · '}
            <Etiqueta>Nº MTSS:</Etiqueta> {empresa.nroMtss}
          </p>
          <p className={classes.linea}>
            <Etiqueta>Grupo:</Etiqueta> {empresa.grupo}
            {' · '}
            <Etiqueta>Subgrupo:</Etiqueta> {empresa.subgrupo}
          </p>
          <p className={classes.linea}>
            <Etiqueta>Afiliación BPS:</Etiqueta> {empresa.afiliacionBps}
            {' · '}
            <Etiqueta>Carpeta BSE:</Etiqueta> {empresa.carpetaBse}
          </p>
        </div>
        <div className={classes.titulo}>
          <p className={classes.tituloTexto}>RECIBO DE SUELDO</p>
          <span className={classes.ejemplar}>{ejemplar}</span>
          <p className={classes.linea}>
            <Etiqueta>Remuneración:</Etiqueta> {formatPeriodo(liquidacion.periodo)}
          </p>
          <p className={classes.linea}>
            <Etiqueta>Tipo de liquidación:</Etiqueta> {TIPO_LIQUIDACION}
          </p>
          <p className={classes.linea}>
            <Etiqueta>Fecha de cargo:</Etiqueta> {formatFecha(liquidacion.fechaCargo)}
          </p>
          <p className={classes.linea}>
            <Etiqueta>Fecha de pago:</Etiqueta> {formatFecha(liquidacion.fechaPago)}
          </p>
        </div>
      </header>

      <div className={classes.trabajador}>
        <Campo etiqueta="Nombre:" valor={trabajador.nombre} ancho />
        <Campo etiqueta="C.I.:" valor={formatCi(trabajador.ci)} />
        <Campo etiqueta="Cargo y categoría:" valor={trabajador.cargo} ancho />
        <Campo etiqueta="Fecha de ingreso:" valor={formatFecha(trabajador.fechaIngreso)} />
        <Campo etiqueta="Sueldo nominal:" valor={formatMoney(trabajador.sueldoNominal)} />
      </div>

      <div className={classes.cuerpo}>
        <table className={classes.tabla}>
          <colgroup>
            <col className={classes.colConcepto} />
            <col className={classes.colCantidad} />
            <col className={classes.colValor} />
            <col className={classes.colImporte} />
            <col className={classes.colImporte} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col" className={classes.num}>
                Cantidad
              </th>
              <th scope="col" className={classes.num}>
                Valor unit.
              </th>
              <th scope="col" className={classes.num}>
                Haberes
              </th>
              <th scope="col" className={classes.num}>
                Descuentos
              </th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea, index) => (
              <tr key={`${linea.orden}-${index}`} data-codigo={linea.codigo ?? 'MANUAL'}>
                <td>{linea.descripcion}</td>
                <td className={classes.num}>{formatCantidad(linea)}</td>
                <td className={classes.num}>
                  {linea.valorUnitario === null ? '' : formatMoney(linea.valorUnitario)}
                </td>
                <td className={classes.num}>{linea.tipo === 'haber' ? formatMoney(linea.importe) : ''}</td>
                <td className={classes.num}>
                  {linea.tipo === 'descuento' ? formatMoney(linea.importe) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Totales</td>
              <td className={classes.num} data-total="haberes">
                {formatMoney(totales.totalHaberes)}
              </td>
              <td className={classes.num} data-total="descuentos">
                {formatMoney(totales.totalDescuentos)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <footer>
        <div className={classes.pie}>
          <div className={classes.imponibles}>
            <p className={classes.linea}>
              <Etiqueta>Imponible IRPF:</Etiqueta> {formatMoney(totales.imponibleIrpf)}
            </p>
          </div>
          <div className={classes.liquido} data-total="liquido">
            LÍQUIDO A COBRAR: $ {formatMoney(totales.liquido)}
          </div>
        </div>
        <div className={classes.firma}>
          <div className={classes.declaracion}>
            <p className={classes.linea}>
              Recibí conforme el importe neto de esta liquidación y una copia de la misma.
            </p>
            <p className={classes.linea}>
              La empresa declara haber efectuado los aportes de seguridad social correspondientes al mes
              anterior.
            </p>
          </div>
          <div>
            <div className={classes.firmaLinea}>Firma del trabajador</div>
            <p className={classes.firmaFecha}>
              <Etiqueta>Fecha:</Etiqueta> {formatFecha(liquidacion.fechaPago)}
            </p>
          </div>
        </div>
      </footer>
    </section>
  )
}

function Etiqueta({ children }: { children: string }) {
  return <span className={classes.etiqueta}>{children}</span>
}

function Campo({ etiqueta, valor, ancho = false }: { etiqueta: string; valor: string; ancho?: boolean }) {
  return (
    <p className={ancho ? `${classes.campo} ${classes.campoAncho}` : classes.campo}>
      <Etiqueta>{etiqueta}</Etiqueta> {valor}
    </p>
  )
}

// ---------------------------------------------------------------- formatting (display only)

/** "2024-08" → "08/2024". */
export function formatPeriodo(periodo: Periodo): string {
  const [anio, mes] = periodo.split('-')
  return mes && anio ? `${mes}/${anio}` : periodo
}

/** "2024-09-01" → "01/09/2024". */
export function formatFecha(fecha: IsoDate): string {
  const [anio, mes, dia] = fecha.split('-')
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha
}

/** "51681437" → "5.168.143-7" (7 digits → "123.456-7"); anything else unchanged. */
export function formatCi(ci: string): string {
  const digitos = ci.replace(/\D/g, '')
  if (digitos.length !== 7 && digitos.length !== 8) return ci
  const cuerpo = digitos.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${digitos.slice(-1)}`
}

/** Rates as "15%" / "0,125%"; days and other quantities as "2" / "1,5". */
export function formatCantidad(linea: Pick<Linea, 'codigo' | 'cantidad'>): string {
  if (linea.cantidad === null) return ''
  if (linea.codigo !== null && CODIGOS_TASA.has(linea.codigo)) {
    return `${formatRatePercent(linea.cantidad)}%`
  }
  return linea.cantidad.replace('.', ',')
}
