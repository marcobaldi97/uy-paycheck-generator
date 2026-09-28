import { AppShell, NavLink, ScrollArea, Stack } from '@mantine/core'
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

export function Layout() {
  const { pathname } = useLocation()
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`)

  return (
    <AppShell
      navbar={{ width: 248, breakpoint: 0 }}
      padding={{ base: 'lg', lg: 40 }}
      styles={{ main: { background: 'transparent' } }}
    >
      <AppShell.Navbar p="md" className={classes.navbar}>
        <AppShell.Section>
          <div className={classes.brand}>
            <div className={classes.mark} aria-hidden="true">
              R
            </div>
            <div className={classes.brandName}>
              Recibos
              <br />
              de sueldo
            </div>
          </div>
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {mainLinks.map((link) => (
              <NavLink
                key={link.to}
                className={classes.link}
                component={Link}
                to={link.to}
                label={link.label}
                leftSection={<Icon name={link.icon} />}
                active={isActive(link.to)}
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section className={classes.footer}>
          <NavLink
            className={classes.link}
            component={Link}
            to={paths.respaldo()}
            label="Respaldo"
            leftSection={<Icon name="respaldo" />}
            active={isActive(paths.respaldo())}
          />
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
