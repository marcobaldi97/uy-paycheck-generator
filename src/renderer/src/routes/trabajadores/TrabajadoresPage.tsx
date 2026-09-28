// Worker list with an "only active" filter. Rows open the detail screen.

import { Alert, Badge, Button, Group, Loader, Paper, Stack, Switch, Table, Text, TextInput } from '@mantine/core'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage } from '../../api/client'
import { useTrabajadores } from '../../api/hooks'
import { PersonAvatar } from '../../components/PersonAvatar'
import { PageHeader } from '../../components/PageHeader'
import { paths } from '../../paths'
import { formatFecha } from './forms'

export function TrabajadoresPage() {
  const [soloActivos, setSoloActivos] = useState(true)
  const { data: trabajadores, error, isPending } = useTrabajadores(soloActivos)
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!trabajadores || q === '') return trabajadores
    return trabajadores.filter((t) => t.nombre.toLowerCase().includes(q) || t.ci.toLowerCase().includes(q))
  }, [trabajadores, busqueda])

  return (
    <Stack>
      <PageHeader
        title="Trabajadores"
        actions={
          <Button component={Link} to={paths.trabajador('nuevo')} size="lg">
            Nuevo trabajador
          </Button>
        }
      />

      <Group justify="space-between">
        <TextInput
          aria-label="Buscar trabajador"
          placeholder="Buscar por nombre o C.I."
          size="md"
          w={360}
          value={busqueda}
          onChange={(event) => setBusqueda(event.currentTarget.value)}
        />
        <Switch
          label="Solo activos"
          checked={soloActivos}
          onChange={(event) => setSoloActivos(event.currentTarget.checked)}
        />
      </Group>

      {isPending ? (
        <Loader aria-label="Cargando" />
      ) : error ? (
        <Alert color="red" title="No se pudo cargar la lista">
          {errorMessage(error)}
        </Alert>
      ) : trabajadores.length === 0 || visibles?.length === 0 ? (
        <Text c="dimmed">
          {busqueda.trim() !== ''
            ? 'Ningún trabajador coincide con la búsqueda.'
            : soloActivos
              ? 'No hay trabajadores activos.'
              : 'Todavía no hay trabajadores.'}
        </Text>
      ) : (
        <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
        <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nº</Table.Th>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>C.I.</Table.Th>
              <Table.Th>Cargo</Table.Th>
              <Table.Th>Ingreso</Table.Th>
              <Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibles?.map((t) => (
              <Table.Tr
                key={t.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(paths.trabajador(t.id))}
              >
                <Table.Td>{t.numero}</Table.Td>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <PersonAvatar nombre={t.nombre} size={32} />
                    <Link
                      to={paths.trabajador(t.id)}
                      onClick={(event) => event.stopPropagation()}
                      style={{ color: 'inherit', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {t.nombre}
                    </Link>
                  </Group>
                </Table.Td>
                <Table.Td>{t.ci}</Table.Td>
                <Table.Td>{t.cargo}</Table.Td>
                <Table.Td>{formatFecha(t.fechaIngreso)}</Table.Td>
                <Table.Td>
                  {t.activo ? (
                    <Badge color="forest" variant="light" size="lg">
                      Activo
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light" size="lg">
                      Inactivo
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </Paper>
      )}
    </Stack>
  )
}
