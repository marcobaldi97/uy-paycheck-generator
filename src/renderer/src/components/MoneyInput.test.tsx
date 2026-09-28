import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderUi } from '../test/render'
import { MoneyInput } from './MoneyInput'

function Controlled({ initial, onValue }: { initial: number | null; onValue?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <MoneyInput
        label="Sueldo"
        value={value}
        onChange={(v) => {
          setValue(v)
          onValue?.(v)
        }}
      />
      <output data-testid="cents">{String(value)}</output>
      <button type="button" onClick={() => setValue(123456)}>
        externo
      </button>
    </>
  )
}

describe('MoneyInput', () => {
  it('displays cents in Uruguayan format', () => {
    renderUi(<MoneyInput label="Sueldo" value={3000000} />)
    expect(screen.getByLabelText('Sueldo')).toHaveValue('30.000,00')
  })

  it('round-trips "30.000,00" to 3000000 cents and back', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    renderUi(<Controlled initial={null} onValue={onValue} />)
    const input = screen.getByLabelText('Sueldo')

    await user.type(input, '30.000,00')
    expect(onValue).toHaveBeenLastCalledWith(3000000)
    expect(screen.getByTestId('cents')).toHaveTextContent('3000000')

    await user.tab()
    expect(input).toHaveValue('30.000,00')
  })

  it('normalizes plain digits on blur', async () => {
    const user = userEvent.setup()
    renderUi(<Controlled initial={null} />)
    const input = screen.getByLabelText('Sueldo')

    await user.type(input, '1234,5')
    await user.tab()
    expect(input).toHaveValue('1.234,50')
    expect(screen.getByTestId('cents')).toHaveTextContent('123450')
  })

  it('emits null when cleared', async () => {
    const user = userEvent.setup()
    renderUi(<Controlled initial={500} />)
    await user.clear(screen.getByLabelText('Sueldo'))
    expect(screen.getByTestId('cents')).toHaveTextContent('null')
  })

  it('keeps the last valid value for invalid text and reverts on blur', async () => {
    const user = userEvent.setup()
    renderUi(<Controlled initial={100} />)
    const input = screen.getByLabelText('Sueldo')

    await user.clear(input)
    await user.type(input, '12,345')
    expect(screen.getByText('Importe inválido (ej.: 30.000,00)')).toBeInTheDocument()
    expect(screen.getByTestId('cents')).toHaveTextContent('1234')

    await user.tab()
    expect(input).toHaveValue('12,34')
    expect(screen.queryByText('Importe inválido (ej.: 30.000,00)')).not.toBeInTheDocument()
  })

  it('rejects negatives unless allowed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderUi(
      <>
        <MoneyInput label="A" value={null} onChange={onChange} />
        <MoneyInput label="B" value={null} onChange={onChange} allowNegative />
      </>,
    )
    await user.type(screen.getByLabelText('A'), '-5')
    expect(onChange).not.toHaveBeenCalledWith(-500)
    await user.type(screen.getByLabelText('B'), '-5')
    expect(onChange).toHaveBeenLastCalledWith(-500)
  })

  it('follows external value changes', async () => {
    const user = userEvent.setup()
    renderUi(<Controlled initial={0} />)
    await user.click(screen.getByRole('button', { name: 'externo' }))
    expect(screen.getByLabelText('Sueldo')).toHaveValue('1.234,56')
  })
})
