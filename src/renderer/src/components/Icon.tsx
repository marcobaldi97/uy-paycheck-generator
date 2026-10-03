// Stroke icons drawn inline, so the app needs no icon package.

const paths = {
  liquidaciones: 'M6 3h9l4 4v14H6z M14 3v5h5M9 13h6M9 17h6',
  trabajadores:
    'M9 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M18 14.4c2.2.7 3.5 2.6 3.5 5.6',
  parametros: 'M4 7h10M18 7h2M4 17h2M10 17h10 M16 5a2 2 0 100 4 2 2 0 000-4z M8 15a2 2 0 100 4 2 2 0 000-4z',
  empresa: 'M4 21V5l8-2v18M12 9h8v12M4 21h16',
  respaldo: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  colapsar: 'M4 4v16M15 7l-5 5 5 5M10 12h10',
  expandir: 'M4 4v16M15 7l5 5-5 5M8 12h12',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
