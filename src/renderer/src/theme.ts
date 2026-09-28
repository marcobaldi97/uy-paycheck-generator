// App theme: warm paper ground, deep green primary, amber for borrador/ajustes, serif headings.
// Fraunces and Instrument Sans lead the stacks; the fallbacks keep the look if the font files are missing.

import { Button, createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core'

const forest: MantineColorsTuple = [
  '#E3EFEA',
  '#C9E0D7',
  '#A8CDBF',
  '#82B5A2',
  '#5E9C87',
  '#3F836D',
  '#2B6E5B',
  '#1F5C4D',
  '#17493D',
  '#0F362D',
]

const amber: MantineColorsTuple = [
  '#FFF8E6',
  '#FBEFD5',
  '#F5DDA5',
  '#EBC470',
  '#DFAB45',
  '#C98A0B',
  '#7A4E00',
  '#6A4200',
  '#553500',
  '#3E2700',
]

export const colors = {
  paper: '#F6F3EC',
  ink: '#17211E',
  border: '#E2DDD0',
  muted: '#5F6B66',
}

export const fontSans = "'Instrument Sans', 'Segoe UI', system-ui, sans-serif"
export const fontSerif = "'Fraunces', Georgia, 'Times New Roman', serif"

export const theme = createTheme({
  colors: { forest, amber },
  primaryColor: 'forest',
  primaryShade: 7,
  fontFamily: fontSans,
  headings: { fontFamily: fontSerif, fontWeight: '500' },
  defaultRadius: 'md',
  radius: { sm: '8px', md: '12px', lg: '16px', xl: '20px' },
  components: {
    Button: Button.extend({ defaultProps: { size: 'md', fw: 600 } }),
  },
})

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    // Cards and tables sit on white; the page ground is set on body in theme.css.
    '--mantine-color-body': '#FFFFFF',
    '--mantine-color-text': '#1B2421',
    '--mantine-color-dimmed': colors.muted,
    '--mantine-color-default-border': '#CFC9B9',
  },
  dark: {},
})
