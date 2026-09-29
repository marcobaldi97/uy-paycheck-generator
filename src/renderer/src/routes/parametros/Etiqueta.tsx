// Field label with a small help icon. Hovering (or tapping) the icon shows what the parameter means.
// The icon is decorative: screen readers get the same text through `aria-description` on the input.

import { Tooltip } from '@mantine/core'

export function Etiqueta({ texto, ayuda }: { texto: string; ayuda: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {texto}
      <Tooltip label={ayuda} multiline w={300} withArrow openDelay={100} events={{ hover: true, focus: false, touch: true }}>
        <span
          aria-hidden="true"
          data-ayuda="true"
          style={{ display: 'inline-flex', cursor: 'help', color: 'var(--mantine-color-dimmed)' }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.01" />
          </svg>
        </span>
      </Tooltip>
    </span>
  )
}
