// Worker list with an "only active" filter. Rows open the detail screen.

import { Alert, Badge, Button, Group, Loader, Stack, Switch, Table, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { errorMessage } from '../../api/client'
import { useTrabajadores } from '../../api/hooks'
import { paths } from '../../paths'
import { formatFecha } from './forms'

export function TrabajadoresPage() {
  const [soloActivos, setSoloActivos] = useState(true)
  const { data: trabajadores, error, isPending } = useTrabajadores(soloActivos)
  const navigate = useNavigate()

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Trabajadores</Title>
        <Button component={Link} to={paths.trabajador('nuevo')}>
          Nuevo trabajador
        </Button>
      </Group>

      <Switch
        label="Solo activos"
        checked={soloActivos}
        onChange={(event) => setSoloActivos(event.currentTarget.checked)}
      />

      {isPending ? (
        <Loader aria-label="Cargando" />
      ) : error ? (
        <Alert color="red" title="No se pudo cargar la lista">
          {errorMessage(error)}
        </Alert>
      ) : trabajadores.length === 0 ? (
        <Text c="dimmed">
          {soloActivos ? 'No hay trabajadores activos.' : 'Todavía no hay trabajadores.'}
        </Text>
      ) : (
        <Table highlightOnHover striped>
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
            {trabajadores.map((t) => (
              <Table.Tr
                key={t.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(paths.trabajador(t.id))}
              >
                <Table.Td>{t.numero}</Table.Td>
                <Table.Td>
                  <Link to={paths.trabajador(t.id)} onClick={(event) => event.stopPropagation()}>
                    {t.nombre}
                  </Link>
                </Table.Td>
                <Table.Td>{t.ci}</Table.Td>
                <Table.Td>{t.cargo}</Table.Td>
                <Table.Td>{formatFecha(t.fechaIngreso)}</Table.Td>
                <Table.Td>
                  {t.activo ? (
                    <Badge color="green" variant="light">
                      Activo
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light">
                      Inactivo
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
