import classes from './PersonAvatar.module.css'

function iniciales(nombre: string): string {
  const partes = nombre.split(/[\s,]+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

/** Decorative circle with a worker's initials. The name is always shown as text next to it. */
export function PersonAvatar({ nombre, size = 32 }: { nombre: string; size?: number }) {
  return (
    <div
      className={classes.avatar}
      data-initials={iniciales(nombre)}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    />
  )
}
