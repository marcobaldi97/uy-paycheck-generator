// Live preview: the real receipt template (A4, original + copy), scaled down to the column width.

import { Box } from '@mantine/core'
import { useElementSize } from '@mantine/hooks'
import type { ReciboImpresion } from '@shared/types'
import { Recibo } from '../../components/Recibo'

// 210 × 297 mm at 96 dpi.
const HOJA_ANCHO_PX = (210 / 25.4) * 96
const HOJA_ALTO_PX = (297 / 25.4) * 96
/** Used until the container has been measured (and in jsdom, which has no layout). */
const ESCALA_INICIAL = 0.6

export function ReciboPreview({ datos, actualizando }: { datos: ReciboImpresion; actualizando: boolean }) {
  const { ref, width } = useElementSize()
  const escala = width > 0 ? Math.min(1, width / HOJA_ANCHO_PX) : ESCALA_INICIAL

  return (
    <Box ref={ref} w="100%" aria-label="Vista previa del recibo" role="region" aria-busy={actualizando}>
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
