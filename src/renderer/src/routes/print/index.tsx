// Print route `/print/:liquidacionId/:reciboId?`, rendered outside the app shell in a hidden
// window by main (T7). Loads the receipts, renders one A4 sheet (original + copy) per receipt
// with page breaks, then calls `pdf.listo()` exactly once per route so main can print or
// printToPDF. Main may switch the hash to another receipt in the same window; the new route
// renders afresh and signals again.
//
// If loading fails, an error message is rendered and `listo` is NOT called; main should apply
// its own timeout.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { errorMessage, unwrap } from '../../api/client'
import { queryKeys } from '../../api/hooks'
import { Recibo } from '../../components/Recibo'
import { parseId } from '../../format'
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

  if (liquidacionId === null || (params.reciboId !== undefined && reciboId === null)) {
    return <p className={classes.mensaje}>Ruta de impresión inválida.</p>
  }
  // Keyed by route so each route mounts afresh and its `listo` latch starts unset.
  return (
    <Hojas
      key={`${liquidacionId}/${reciboId ?? ''}`}
      liquidacionId={liquidacionId}
      reciboId={reciboId}
      fuente={fuente}
    />
  )
}

interface HojasProps {
  liquidacionId: number
  reciboId: number | null
  fuente: FuenteImpresion
}

function Hojas({ liquidacionId, reciboId, fuente }: HojasProps) {
  const query = useQuery({
    queryKey: queryKeys.pdf.datosImpresion(liquidacionId, reciboId),
    // `unwrap` throws ApiRequestError, like every hook in api/hooks.ts.
    queryFn: async () => unwrap(await fuente.datosImpresion({ liquidacionId, reciboId })),
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

  if (query.isError) {
    return (
      <p className={classes.mensaje} role="alert">
        No se pudieron cargar los recibos: {errorMessage(query.error)}
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
