// Print route `/print/:liquidacionId/:reciboId?`, rendered outside the app shell in a hidden
// window by main (T7). Loads the receipts, renders one A4 sheet (original + copy) per receipt
// with page breaks, then calls `pdf.listo()` exactly once so main can print or printToPDF.
//
// If loading fails, an error message is rendered and `listo` is NOT called; main should apply
// its own timeout.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { Recibo } from '../../components/Recibo'
import { fuenteWindowApi, type FuenteImpresion } from './fuente'
import classes from './PrintPage.module.css'

export interface PrintPageProps {
  /** Injected in tests; defaults to `window.api.pdf` through the typed client. */
  fuente?: FuenteImpresion
}

export function PrintPage({ fuente = fuenteWindowApi }: PrintPageProps) {
  const params = useParams()
  const liquidacionId = parseId(params.liquidacionId)
  const reciboId = params.reciboId === undefined ? null : parseId(params.reciboId)
  const paramsValidos = liquidacionId !== null && (params.reciboId === undefined || reciboId !== null)

  const query = useQuery({
    queryKey: ['pdf', 'datosImpresion', { liquidacionId, reciboId }],
    enabled: paramsValidos,
    queryFn: async () => {
      const result = await fuente.datosImpresion({ liquidacionId: liquidacionId!, reciboId })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    staleTime: Infinity,
    gcTime: 0,
  })

  const recibos = query.data
  const senalado = useRef(false)

  useEffect(() => {
    if (!recibos || senalado.current) return
    // The flag is set only when the signal is actually sent, so a StrictMode
    // mount/unmount/mount cancels the first attempt and the second one still fires.
    let cancelado = false
    void esperarRender().then(() => {
      if (cancelado || senalado.current) return
      senalado.current = true
      void fuente.listo()
    })
    return () => {
      cancelado = true
    }
  }, [recibos, fuente])

  if (!paramsValidos) {
    return <p className={classes.mensaje}>Ruta de impresión inválida.</p>
  }
  if (query.isError) {
    return (
      <p className={classes.mensaje} role="alert">
        No se pudieron cargar los recibos: {query.error.message}
      </p>
    )
  }
  if (!recibos) {
    return <p className={classes.mensaje}>Cargando recibos…</p>
  }
  if (recibos.length === 0) {
    return <p className={classes.mensaje}>La liquidación no tiene recibos.</p>
  }

  return (
    <main className={classes.pagina} data-recibos={recibos.length}>
      {recibos.map((datos) => (
        <Recibo key={datos.reciboId} datos={datos} className={classes.hoja} />
      ))}
    </main>
  )
}

function parseId(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Resolves once fonts are loaded and the committed DOM has settled. Deliberately not
 * requestAnimationFrame: it never fires in a hidden window (`show: false`), which is exactly
 * where main renders this route. printToPDF lays out the page itself.
 */
async function esperarRender(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
