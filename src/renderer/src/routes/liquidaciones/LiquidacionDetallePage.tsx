// One liquidación: a row per worker with haberes, descuentos and líquido, a totals footer,
// and the actions Recalcular, Emitir, Reabrir, Vista previa and one Exportar o imprimir menu.

import {
  Alert,
  Anchor,
 
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  VisuallyHidden,
} from '@mantine/core'
import { formatMoney } from '@shared/money'
import type { LiquidacionDetalle, ModoExportacion, ReciboResumen, ResultadoExportacion } from '@shared/types'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage, isApiErrorCode, type ApiRequestError } from '../../api/client'
import {
  useEmitirLiquidacion,
  useExportarPdf,
  useImprimir,
  useLiquidacion,
  useReabrirLiquidacion,
  useRecalcularLiquidacion,
} from '../../api/hooks'
import { PersonAvatar } from '../../components/PersonAvatar'
import { PageHeader } from '../../components/PageHeader'
import { formatFecha } from '../../components/Recibo'
import { StatCard } from '../../components/StatCard'
import { paths } from '../../paths'
import { ConfirmarModal } from './ConfirmarModal'
import { EstadoBadge } from './EstadoBadge'
import { nombrePeriodo } from './formato'
import { ImprimirModal } from './ImprimirModal'
import { VistaPreviaModal } from './VistaPreviaModal'

function parseId(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function LiquidacionDetallePage() {
  const { liquidacionId } = useParams()
  const id = parseId(liquidacionId)
  const detalle = useLiquidacion(id ?? 0, { enabled: id !== null })

  let contenido
  if (id === null) {
    contenido = <NoEncontrada mensaje="Liquidación no encontrada" />
  } else if (detalle.isPending) {
    contenido = (
      <Center py="xl">
        <Loader aria-label="Cargando" />
      </Center>
    )
  } else if (detalle.isError) {
    contenido = <NoEncontrada mensaje={errorMessage(detalle.error)} />
  } else {
    contenido = <Detalle detalle={detalle.data} refrescar={() => void detalle.refetch()} />
  }

  return (
    <Stack>
      <Anchor component={Link} to={paths.liquidaciones()} size="sm" c="dimmed" underline="hover">
        ← Liquidaciones
      </Anchor>
      {contenido}
    </Stack>
  )
}

function NoEncontrada({ mensaje }: { mensaje: string }) {
  return (
    <Alert color="red" title="No se pudo abrir la liquidación" role="alert">
      {mensaje}
    </Alert>
  )
}

type Aviso = { color: 'green' | 'red'; texto: string }
type Confirmacion = 'emitir' | 'reabrir' | null

/** Folder part of an absolute path (Windows or POSIX separators). */
function carpetaDe(archivo: string): string {
  const corte = Math.max(archivo.lastIndexOf('\\'), archivo.lastIndexOf('/'))
  return corte > 0 ? archivo.slice(0, corte) : archivo
}

function textoExportacion(resultado: ResultadoExportacion, modo: ModoExportacion): string {
  const { archivos } = resultado
  if (modo === 'unico' || archivos.length === 1) return `PDF guardado en ${archivos[0] ?? ''}`
  return `Se guardaron ${archivos.length} archivos PDF en ${carpetaDe(archivos[0] ?? '')}`
}

function Detalle({ detalle, refrescar }: { detalle: LiquidacionDetalle; refrescar: () => void }) {
  const { liquidacion, recibos, totales } = detalle
  const id = liquidacion.id
  const borrador = liquidacion.estado === 'borrador'
  const sinRecibos = recibos.length === 0

  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [confirmar, setConfirmar] = useState<Confirmacion>(null)
  // 'todos' prints the whole liquidación; a receipt prints only that worker's.
  const [aImprimir, setAImprimir] = useState<'todos' | ReciboResumen | null>(null)
  const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false)
  // Controlled: an uncontrolled Menu whose target gets disabled mid-click stays "open" while
  // hidden, and the next click on Exportar PDF only closes it.
  const [exportarAbierto, setExportarAbierto] = useState(false)

  const ok = (texto: string) => setAviso({ color: 'green', texto })
  const fallo = (error: ApiRequestError) => {
    setAviso({ color: 'red', texto: errorMessage(error) })
    // Someone else (another window, a stale screen) changed the estado: show the real one.
    if ((['LIQUIDACION_EMITIDA', 'CONFLICTO', 'NO_ENCONTRADO'] as const).some((c) => isApiErrorCode(error, c)))
      refrescar()
  }

  const recalcular = useRecalcularLiquidacion({
    onSuccess: () => ok('Liquidación recalculada.'),
    onError: fallo,
  })
  const emitir = useEmitirLiquidacion({
    onSuccess: () => ok('Liquidación emitida.'),
    onError: fallo,
  })
  const reabrir = useReabrirLiquidacion({
    onSuccess: () => ok('Liquidación reabierta. Volvió a borrador.'),
    onError: fallo,
  })
  const exportar = useExportarPdf({
    onSuccess: (resultado, { modo }) => {
      if (!resultado.cancelado) ok(textoExportacion(resultado, modo))
    },
    onError: fallo,
  })
  const imprimir = useImprimir({
    onSuccess: (_, { impresora, reciboId }) => {
      setAImprimir(null)
      // With the system dialog main can't tell a print from a cancel, so say nothing.
      if (impresora !== null) ok(`${reciboId === null ? 'Recibos enviados' : 'Recibo enviado'} a ${impresora}.`)
    },
    onError: (error) => {
      setAImprimir(null)
      fallo(error)
    },
  })

  const ocupado =
    recalcular.isPending || emitir.isPending || reabrir.isPending || exportar.isPending || imprimir.isPending

  const iniciar = (accion: () => void) => {
    setAviso(null)
    accion()
  }

  const exportarComo = (modo: ModoExportacion) => {
    setExportarAbierto(false)
    setVistaPreviaAbierta(false)
    iniciar(() => exportar.mutate({ liquidacionId: id, modo }))
  }

  return (
    <Stack>
      <PageHeader
        title={`Liquidación ${nombrePeriodo(liquidacion.periodo)}`}
        badge={<EstadoBadge estado={liquidacion.estado} />}
        subtitle={`Fecha de cargo ${formatFecha(liquidacion.fechaCargo)} · Fecha de pago ${formatFecha(liquidacion.fechaPago)}`}
        actions={
          <>
            {borrador && (
              <Button
                variant="default"
                loading={recalcular.isPending}
                disabled={ocupado}
                onClick={() => iniciar(() => recalcular.mutate({ id }))}
              >
                Recalcular
              </Button>
            )}
            {borrador ? (
              <Button
                size="md"
                loading={emitir.isPending}
                disabled={ocupado || sinRecibos}
                onClick={() => setConfirmar('emitir')}
              >
                Emitir
              </Button>
            ) : (
              <Button
                variant="default"
                loading={reabrir.isPending}
                disabled={ocupado}
                onClick={() => setConfirmar('reabrir')}
              >
                Reabrir
              </Button>
            )}
            <Button variant="default" disabled={ocupado || sinRecibos} onClick={() => setVistaPreviaAbierta(true)}>
              Vista previa
            </Button>
            <Menu position="bottom-end" opened={exportarAbierto} onChange={setExportarAbierto}>
              <Menu.Target>
                <Button
                  variant="default"
                  loading={exportar.isPending || imprimir.isPending}
                  disabled={ocupado || sinRecibos}
                  rightSection={<span aria-hidden="true">▾</span>}
                >
                  Exportar o imprimir
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Exportar PDF</Menu.Label>
                <Menu.Item onClick={() => exportarComo('unico')}>Un solo archivo</Menu.Item>
                <Menu.Item onClick={() => exportarComo('por_trabajador')}>Un archivo por trabajador</Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  onClick={() => {
                    setExportarAbierto(false)
                    setAviso(null)
                    setAImprimir('todos')
                  }}
                >
                  Imprimir…
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />

      {exportar.isPending && (
        <Text size="sm" c="dimmed">
          Generando PDF… puede tardar unos segundos.
        </Text>
      )}

      {aviso && (
        <Alert
          color={aviso.color}
          role={aviso.color === 'red' ? 'alert' : 'status'}
          withCloseButton
          onClose={() => setAviso(null)}
        >
          {aviso.texto}
        </Alert>
      )}

      {!borrador && (
        <Text size="sm" c="dimmed">
          La liquidación está emitida: los recibos no se pueden modificar. Reabrila para editarlos o recalcularla.
        </Text>
      )}

      {sinRecibos ? (
        <Text c="dimmed">Esta liquidación no tiene recibos.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <StatCard label="Total haberes" value={formatMoney(totales.totalHaberes)} />
            <StatCard label="Total descuentos" value={formatMoney(totales.totalDescuentos)} />
            <StatCard label="Total líquido" value={formatMoney(totales.liquido)} destacada />
          </SimpleGrid>
          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Trabajador</Table.Th>
                  <Table.Th ta="right">Haberes</Table.Th>
                  <Table.Th ta="right">Descuentos</Table.Th>
                  <Table.Th ta="right">Líquido</Table.Th>
                  <Table.Th w={1}>
                    <VisuallyHidden>Acciones</VisuallyHidden>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recibos.map((recibo) => (
                  <Table.Tr key={recibo.id} data-testid="recibo-fila">
                    <Table.Td>
                      <Group gap="sm">
                        <PersonAvatar nombre={recibo.trabajadorNombre} size={32} />
                        <Anchor
                          component={Link}
                          to={paths.recibo(id, recibo.id)}
                          fw={600}
                          c="inherit"
                          underline="hover"
                        >
                          {recibo.trabajadorNombre}
                        </Anchor>
                        {recibo.tieneOverrides && (
                          <Badge size="sm" variant="light" color="amber">
                            Ajustes manuales
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">{formatMoney(recibo.totalHaberes)}</Table.Td>
                    <Table.Td ta="right">{formatMoney(recibo.totalDescuentos)}</Table.Td>
                    <Table.Td ta="right">{formatMoney(recibo.liquido)}</Table.Td>
                    <Table.Td>
                      <Button
                        variant="subtle"
                        size="xs"
                        disabled={ocupado}
                        aria-label={`Imprimir recibo de ${recibo.trabajadorNombre}`}
                        onClick={() => {
                          setAviso(null)
                          setAImprimir(recibo)
                        }}
                      >
                        Imprimir
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr data-testid="totales-fila" fw={600} bg="#FBFAF6" style={{ borderTop: '2px solid #1B2421' }}>
                  <Table.Td>Totales</Table.Td>
                  <Table.Td ta="right">{formatMoney(totales.totalHaberes)}</Table.Td>
                  <Table.Td ta="right">{formatMoney(totales.totalDescuentos)}</Table.Td>
                  <Table.Td ta="right">{formatMoney(totales.liquido)}</Table.Td>
                  <Table.Td />
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Paper>
        </>
      )}

      <ConfirmarModal
        opened={confirmar === 'emitir'}
        titulo="Emitir liquidación"
        mensaje="Al emitir se guardan en cada recibo los datos actuales de la empresa y del trabajador, y los recibos dejan de poder editarse. Podés reabrirla más adelante."
        confirmar="Emitir"
        color="green"
        onConfirm={() => iniciar(() => emitir.mutate({ id }))}
        onClose={() => setConfirmar(null)}
      />
      <ConfirmarModal
        opened={confirmar === 'reabrir'}
        titulo="Reabrir liquidación"
        mensaje={`La liquidación de ${nombrePeriodo(liquidacion.periodo)} vuelve a borrador y sus recibos se podrán editar y recalcular. ¿Continuar?`}
        confirmar="Reabrir"
        onConfirm={() => iniciar(() => reabrir.mutate({ id }))}
        onClose={() => setConfirmar(null)}
      />
      <VistaPreviaModal
        opened={vistaPreviaAbierta}
        liquidacionId={id}
        titulo={`Vista previa · Liquidación ${nombrePeriodo(liquidacion.periodo)}`}
        onExportar={exportarComo}
        onClose={() => setVistaPreviaAbierta(false)}
      />
      <ImprimirModal
        opened={aImprimir !== null}
        cantidadRecibos={aImprimir === 'todos' ? recibos.length : 1}
        trabajadorNombre={aImprimir !== null && aImprimir !== 'todos' ? aImprimir.trabajadorNombre : undefined}
        imprimiendo={imprimir.isPending}
        onImprimir={(impresora) =>
          imprimir.mutate({
            liquidacionId: id,
            reciboId: aImprimir !== null && aImprimir !== 'todos' ? aImprimir.id : null,
            impresora,
          })
        }
        onClose={() => setAImprimir(null)}
      />
    </Stack>
  )
}
