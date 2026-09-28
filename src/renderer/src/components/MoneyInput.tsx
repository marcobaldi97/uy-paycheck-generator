// Money input in Uruguayan format ("30.000,00"). The value is integer cents (or null when
// empty). Works with @mantine/form: `<MoneyInput {...form.getInputProps('sueldoNominal')} />`.

import { TextInput, type TextInputProps } from '@mantine/core'
import { formatMoney, parseMoney } from '@shared/money'
import type { Cents } from '@shared/types'
import { useState, type FocusEvent } from 'react'

export interface MoneyInputProps extends Omit<TextInputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  value?: Cents | null
  /** Called with cents for valid text, null for empty text. Not called while the text is invalid. */
  onChange?: (value: Cents | null) => void
  /** Accept negative amounts. Default false. */
  allowNegative?: boolean
}

const display = (value: Cents | null | undefined) => (value === null || value === undefined ? '' : formatMoney(value))

export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  onBlur,
  error,
  styles,
  ...props
}: MoneyInputProps) {
  const [text, setText] = useState(() => display(value))
  const [invalid, setInvalid] = useState(false)
  // Sync external changes (form reset, data load) without clobbering what the user is typing.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (parse(text, allowNegative) !== (value ?? null)) {
      setText(display(value))
      setInvalid(false)
    }
  }

  function handleChange(next: string) {
    setText(next)
    const parsed = parse(next, allowNegative)
    if (parsed === undefined) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (parsed !== (value ?? null)) onChange?.(parsed)
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    // Normalize to the canonical format; invalid text reverts to the last valid value.
    setText(display(value))
    setInvalid(false)
    onBlur?.(event)
  }

  return (
    <TextInput
      inputMode="decimal"
      autoComplete="off"
      {...props}
      styles={styles ?? { input: { textAlign: 'right' } }}
      value={text}
      error={error ?? (invalid ? 'Importe inválido (ej.: 30.000,00)' : undefined)}
      onChange={(event) => handleChange(event.currentTarget.value)}
      onBlur={handleBlur}
    />
  )
}

/** Cents, null for empty, undefined for invalid. */
function parse(text: string, allowNegative: boolean): Cents | null | undefined {
  if (text.trim() === '') return null
  const cents = parseMoney(text)
  if (cents === null || (!allowNegative && cents < 0)) return undefined
  return cents
}
