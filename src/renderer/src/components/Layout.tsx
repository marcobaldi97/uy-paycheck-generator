import { AppShell, NavLink, ScrollArea, Stack, Title } from '@mantine/core'
import { Link, Outlet, useLocation } from 'react-router'
import { paths } from '../paths'

const mainLinks = [
  { label: 'Liquidaciones', to: paths.liquidaciones() },
  { label: 'Trabajadores', to: paths.trabajadores() },
  { label: 'Parámetros', to: paths.parametros() },
  { label: 'Empresa', to: paths.empresa() },
]

export function Layout() {
  const { pathname } = useLocation()
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`)

  return (
    <AppShell navbar={{ width: 220, breakpoint: 0 }} padding="lg">
      <AppShell.Navbar p="sm">
        <AppShell.Section>
          <Title order={4} px="sm" py="xs">
            Recibos de sueldo
          </Title>
        </AppShell.Section>
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={2}>
            {mainLinks.map((link) => (
              <NavLink
                key={link.to}
                component={Link}
                to={link.to}
                label={link.label}
                active={isActive(link.to)}
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <NavLink
            component={Link}
            to={paths.respaldo()}
            label="Respaldo"
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
