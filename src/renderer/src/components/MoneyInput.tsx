// Money input in Uruguayan format ("30.000,00"). The value is integer cents (or null when
// empty). Works with @mantine/form: `<MoneyInput {...form.getInputProps('sueldoNominal')} />`.

import { formatMoney, parseMoney } from '@shared/money'
import type { Cents } from '@shared/types'
import { TextoParseadoInput, type TextoParseadoInputProps } from './TextoParseadoInput'

export interface MoneyInputProps
  extends Omit<TextoParseadoInputProps<Cents | null>, 'value' | 'onChange' | 'parse' | 'format' | 'mensajeInvalido'> {
  value?: Cents | null
  /** Called with cents for valid text, null for empty text. Not called while the text is invalid. */
  onChange?: (value: Cents | null) => void
  /** Accept negative amounts. Default false. */
  allowNegative?: boolean
}

const display = (value: Cents | null) => (value === null ? '' : formatMoney(value))

export function MoneyInput({ value, allowNegative = false, ...props }: MoneyInputProps) {
  return (
    <TextoParseadoInput
      {...props}
      value={value ?? null}
      parse={(text) => parse(text, allowNegative)}
      format={display}
      mensajeInvalido="Importe inválido (ej.: 30.000,00)"
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
