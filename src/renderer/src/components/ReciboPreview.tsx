// Preview of the real receipt template (A4, original + copy), scaled down to the container width.
// Used by the recibo editor (live) and the liquidación preview before exporting.

import { Box } from '@mantine/core'
import { useElementSize } from '@mantine/hooks'
import type { ReciboImpresion } from '@shared/types'
import { Recibo } from './Recibo'

// 210 × 297 mm at 96 dpi.
const HOJA_ANCHO_PX = (210 / 25.4) * 96
const HOJA_ALTO_PX = (297 / 25.4) * 96
/** Used until the container has been measured (and in jsdom, which has no layout). */
const ESCALA_INICIAL = 0.6

export interface ReciboPreviewProps {
  datos: ReciboImpresion
  actualizando?: boolean
  etiqueta?: string
}

export function ReciboPreview({ datos, actualizando = false, etiqueta = 'Vista previa del recibo' }: ReciboPreviewProps) {
  const { ref, width } = useElementSize()
  const escala = width > 0 ? Math.min(1, width / HOJA_ANCHO_PX) : ESCALA_INICIAL

  return (
    <Box ref={ref} w="100%" aria-label={etiqueta} role="region" aria-busy={actualizando}>
      <Box
        style={{
          width: HOJA_ANCHO_PX * escala,
          height: HOJA_ALTO_PX * escala,
          overflow: 'hidden',
          boxShadow: 'var(--mantine-shadow-md)',
          border: '1px solid var(--mantine-color-gray-3)',
          opacity: actualizando ? 0.6 : 1,
          transition: 'opacity 150ms',
        }}
      >
        <Box style={{ width: HOJA_ANCHO_PX, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
          <Recibo datos={datos} />
        </Box>
      </Box>
    </Box>
  )
}
