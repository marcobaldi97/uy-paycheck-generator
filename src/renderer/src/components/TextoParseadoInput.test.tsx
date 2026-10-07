import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderUi } from '../test/render'
import { TextoParseadoInput } from './TextoParseadoInput'

// A whole number with "#" as its canonical text: "#12". Empty is null; anything else invalid.
const parse = (text: string): number | null | undefined => {
  const t = text.trim().replace(/^#/, '')
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : undefined
}
const format = (value: number | null) => (value === null ? '' : `#${value}`)

function Controlled({ initial, onValue }: { initial: number | null; onValue?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <TextoParseadoInput
        label="Número"
        value={value}
        parse={parse}
        format={format}
        mensajeInvalido="Número inválido"
        onChange={(v) => {
          setValue(v)
          onValue?.(v)
        }}
      />
      <output data-testid="valor">{String(value)}</output>
      <button type="button" onClick={() => setValue(99)}>
        externo
      </button>
    </>
  )
}

describe('TextoParseadoInput', () => {
  it('shows the value in its canonical format', () => {
    renderUi(<Controlled initial={12} />)
    expect(screen.getByLabelText('Número')).toHaveValue('#12')
  })

  it('propagates valid text and keeps what the user typed until blur', async () => {
    const onValue = vi.fn()
    renderUi(<Controlled initial={null} onValue={onValue} />)
    const input = screen.getByLabelText('Número')

    await userEvent.type(input, '42')
    expect(onValue).toHaveBeenLastCalledWith(42)
    expect(input).toHaveValue('42')

    await userEvent.tab()
    expect(input).toHaveValue('#42')
  })

  it('flags invalid text without propagating it, and reverts it on blur', async () => {
    const onValue = vi.fn()
    renderUi(<Controlled initial={7} onValue={onValue} />)
    const input = screen.getByLabelText('Número')

    await userEvent.clear(input)
    expect(onValue).toHaveBeenLastCalledWith(null)
    await userEvent.type(input, 'x')

    expect(screen.getByText('Número inválido')).toBeInTheDocument()
    expect(screen.getByTestId('valor')).toHaveTextContent('null')

    await userEvent.tab()
    expect(input).toHaveValue('')
    expect(screen.queryByText('Número inválido')).not.toBeInTheDocument()
  })

  it('does not call onChange when the text means the same value', async () => {
    const onValue = vi.fn()
    renderUi(<Controlled initial={5} onValue={onValue} />)
    const input = screen.getByLabelText('Número')

    await userEvent.clear(input)
    await userEvent.type(input, '5')
    expect(onValue.mock.calls).toEqual([[null], [5]])

    // "#5" → "5" is the same value: the backspace over "#" doesn't propagate.
    await userEvent.tab()
    expect(input).toHaveValue('#5')
    await userEvent.type(input, '{Home}{Delete}')
    expect(input).toHaveValue('5')
    expect(onValue).toHaveBeenCalledTimes(2)
  })

  it('resyncs when the value changes from outside', async () => {
    renderUi(<Controlled initial={1} />)
    const input = screen.getByLabelText('Número')

    await userEvent.type(input, 'z')
    expect(screen.getByText('Número inválido')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'externo' }))

    expect(input).toHaveValue('#99')
    expect(screen.queryByText('Número inválido')).not.toBeInTheDocument()
  })

  it('lets a given error win over the invalid message', async () => {
    renderUi(
      <TextoParseadoInput
        label="Número"
        value={null}
        parse={parse}
        format={format}
        mensajeInvalido="Número inválido"
        error="Requerido"
      />,
    )
    await userEvent.type(screen.getByLabelText('Número'), 'x')
    expect(screen.getByText('Requerido')).toBeInTheDocument()
    expect(screen.queryByText('Número inválido')).not.toBeInTheDocument()
  })
})
