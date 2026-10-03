import { AppShell, NavLink, ScrollArea, Stack, Tooltip } from '@mantine/core'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { paths } from '../paths'
import { Icon, type IconName } from './Icon'
import classes from './Layout.module.css'

const mainLinks: { label: string; to: string; icon: IconName }[] = [
  { label: 'Liquidaciones', to: paths.liquidaciones(), icon: 'liquidaciones' },
  { label: 'Trabajadores', to: paths.trabajadores(), icon: 'trabajadores' },
  { label: 'Parámetros', to: paths.parametros(), icon: 'parametros' },
  { label: 'Empresa', to: paths.empresa(), icon: 'empresa' },
]

const ANCHO = 248
const ANCHO_COLAPSADO = 76

export function Layout() {
  const { pathname } = useLocation()
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`)
  // Always starts open; collapsing lasts until the app closes.
  const [colapsado, setColapsado] = useState(false)

  // Collapsed: icon only, with the name as tooltip and accessible name.
  const enlace = (label: string, to: string, icon: IconName) => (
    <Tooltip key={to} label={label} position="right" disabled={!colapsado} withArrow>
      <NavLink
        className={classes.link}
        component={Link}
        to={to}
        label={colapsado ? undefined : label}
        aria-label={label}
        leftSection={<Icon name={icon} />}
        active={isActive(to)}
      />
    </Tooltip>
  )

  return (
    <AppShell
      navbar={{ width: colapsado ? ANCHO_COLAPSADO : ANCHO, breakpoint: 0 }}
      padding={{ base: 'lg', lg: 40 }}
      styles={{ main: { background: 'transparent' } }}
    >
      <AppShell.Navbar p="md" className={classes.navbar} data-colapsado={colapsado || undefined}>
        <AppShell.Section>
          <div className={classes.brand}>
            <div className={classes.mark} aria-hidden="true">
              R
            </div>
            {!colapsado && (
              <div className={classes.brandName}>
                Recibos
                <br />
                de sueldo
              </div>
            )}
          </div>
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>{mainLinks.map((link) => enlace(link.label, link.to, link.icon))}</Stack>
        </AppShell.Section>
        <AppShell.Section className={classes.footer}>
          {enlace('Respaldo', paths.respaldo(), 'respaldo')}
          <Tooltip label="Expandir menú" position="right" disabled={!colapsado} withArrow>
            <NavLink
              className={classes.link}
              component="button"
              label={colapsado ? undefined : 'Colapsar menú'}
              aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              aria-expanded={!colapsado}
              leftSection={<Icon name={colapsado ? 'expandir' : 'colapsar'} />}
              onClick={() => setColapsado((c) => !c)}
            />
          </Tooltip>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
