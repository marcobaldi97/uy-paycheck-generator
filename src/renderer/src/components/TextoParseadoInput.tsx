// Text input for a value typed as text and stored parsed (money, rates, quantities). The user's
// text is kept while it is being typed; valid text propagates the parsed value, invalid text
// shows `mensajeInvalido` and propagates nothing. A value changed from outside (form reset,
// data load, "Restaurar") replaces the text unless the text already means that value. On blur
// the text is normalized to the canonical format, or reverts to the last valid value.

import { TextInput, type TextInputProps } from '@mantine/core'
import { useState, type FocusEvent } from 'react'

export interface TextoParseadoInputProps<T extends NonNullable<unknown> | null>
  extends Omit<TextInputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  value: T
  /** Called with the parsed value when valid text means something other than `value`. */
  onChange?: (value: T) => void
  /** Text → value; `undefined` when the text is invalid. */
  parse: (text: string) => T | undefined
  /** Value → canonical text. */
  format: (value: T) => string
  /** Error shown while the text is invalid (a given `error` takes precedence). */
  mensajeInvalido: string
}

export function TextoParseadoInput<T extends NonNullable<unknown> | null>({
  value,
  onChange,
  parse,
  format,
  mensajeInvalido,
  onBlur,
  error,
  styles,
  ...props
}: TextoParseadoInputProps<T>) {
  const [text, setText] = useState(() => format(value))
  const [invalid, setInvalid] = useState(false)
  // Sync external changes without clobbering what the user is typing.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (parse(text) !== value) {
      setText(format(value))
      setInvalid(false)
    }
  }

  function handleChange(next: string) {
    setText(next)
    const parsed = parse(next)
    if (parsed === undefined) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (parsed !== value) onChange?.(parsed)
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setText(format(value))
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
      error={error ?? (invalid ? mensajeInvalido : undefined)}
      onChange={(event) => handleChange(event.currentTarget.value)}
      onBlur={handleBlur}
    />
  )
}
