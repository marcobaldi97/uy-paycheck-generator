import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paths } from '../../paths'
import { renderUi } from '../../test/render'
import { instalarApi, ok, quitarApi } from '../../test/fakeApi'
import { detalle } from '../liquidaciones/testApi'
import { NavegacionRecibos } from './NavegacionRecibos'

afterEach(quitarApi)

describe('NavegacionRecibos', () => {
  it('links to the next receipt and disables "anterior" on the first one', async () => {
    const { liquidacion, recibos } = detalle()
    instalarApi({ liquidaciones: { obtener: vi.fn().mockResolvedValue(ok(detalle())) } })
    renderUi(<NavegacionRecibos liquidacionId={liquidacion.id} reciboId={recibos[0]!.id} />)

    expect(await screen.findByText(`1 de ${recibos.length}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recibo anterior' })).toBeDisabled()
    expect(screen.getByRole('link', { name: `Recibo siguiente: ${recibos[1]!.trabajadorNombre}` })).toHaveAttribute(
      'href',
      paths.recibo(liquidacion.id, recibos[1]!.id),
    )
  })
})
