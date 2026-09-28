// Receipt editor (T12). Left: días no trabajados, manual lines, computed lines with overrides.
// Right: live preview. Edits autosave; main recomputes and returns the recibo, which feeds the
// computed lines and the preview. Read-only while the liquidación is emitida.

import { Alert, Anchor, Badge, Grid, Group, Loader, NumberInput, Paper, Stack, Text, Title } from '@mantine/core'
import type { Overrides, ReciboDetalle, ReciboEntradas } from '@shared/types'
import { formatMoney } from '@shared/money'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage } from '../../api/client'
import { useRecibo } from '../../api/hooks'
import { PersonAvatar } from '../../components/PersonAvatar'
import { PageHeader } from '../../components/PageHeader'
import { paths } from '../../paths'
import { conOverride, type OverrideKey } from './entradas'
import { LineasAuto } from './LineasAuto'
import { LineasManuales } from './LineasManuales'
import { ReciboPreview } from '../../components/ReciboPreview'
import { useAutosave, type EstadoGuardado } from './useAutosave'

export interface ReciboEditorPageProps {
  /** Debounce before an edit is saved, in ms. */
  autosaveMs?: number
}

export function ReciboEditorPage({ autosaveMs = 600 }: ReciboEditorPageProps) {
  const params = useParams()
  const liquidacionId = parseId(params.liquidacionId)
  const reciboId = parseId(params.reciboId)

  if (liquidacionId === null || reciboId === null) {
    return (
      <Alert color="red" role="alert" title="Recibo no encontrado">
        La dirección no corresponde a un recibo.
      </Alert>
    )
  }
  // Keyed so switching recibos starts a fresh editor (draft, autosave queue).
  return <ReciboEditorCarga key={reciboId} liquidacionId={liquidacionId} reciboId={reciboId} autosaveMs={autosaveMs} />
}

function ReciboEditorCarga({
  liquidacionId,
  reciboId,
  autosaveMs,
}: {
  liquidacionId: number
  reciboId: number
  autosaveMs: number
}) {
  const recibo = useRecibo(reciboId)
  const volver = (
    <Anchor component={Link} to={paths.liquidacion(liquidacionId)} size="sm" c="dimmed" underline="hover">
      ← Volver a la liquidación
    </Anchor>
  )

  if (recibo.isPending) {
    return (
      <Stack>
        {volver}
        <Group>
          <Loader size="sm" />
          <Text>Cargando recibo…</Text>
        </Group>
      </Stack>
    )
  }
  if (recibo.isError) {
    return (
      <Stack>
        {volver}
        <Alert color="red" role="alert" title="No se pudo cargar el recibo">
          {errorMessage(recibo.error)}
        </Alert>
      </Stack>
    )
  }
  return (
    <ReciboEditor
      detalle={recibo.data}
      volver={volver}
      autosaveMs={autosaveMs}
      onEmitida={() => void recibo.refetch()}
    />
  )
}

interface ReciboEditorProps {
  detalle: ReciboDetalle
  volver: ReactNode
  autosaveMs: number
  onEmitida: () => void
}

function ReciboEditor({ detalle, volver, autosaveMs, onEmitida }: ReciboEditorProps) {
  const soloLectura = detalle.estado === 'emitida'
  const { estado, programar } = useAutosave(detalle.id, { delay: autosaveMs, onEmitida })

  // Local draft of what the user edits. Server lines/totals come from `detalle`.
  const [borrador, setBorrador] = useState<ReciboEntradas>(detalle.entradas)
  // After reabrir, start from what is stored rather than edits that were rejected.
  const [prevEstado, setPrevEstado] = useState(detalle.estado)
  if (detalle.estado !== prevEstado) {
    setPrevEstado(detalle.estado)
    if (detalle.estado === 'borrador') setBorrador(detalle.entradas)
  }
  const entradas = soloLectura ? detalle.entradas : borrador

  function editar(next: ReciboEntradas) {
    if (soloLectura) return
    setBorrador(next)
    programar(next)
  }

  function setOverride<K extends OverrideKey>(key: K, value: Overrides[K] | undefined) {
    editar({ ...entradas, overrides: conOverride(entradas.overrides, key, value) })
  }

  const { trabajador, liquidacion } = detalle.impresion

  return (
    <Stack gap="md">
      {volver}
      <Group gap="md" wrap="nowrap" align="center">
        <PersonAvatar nombre={trabajador.nombre} size={56} />
        <div style={{ flex: 1 }}>
          <PageHeader
            title={trabajador.nombre}
            subtitle={`Recibo del período ${formatPeriodo(liquidacion.periodo)}`}
            actions={
              soloLectura ? (
                <Badge color="gray" variant="light" size="lg">
                  Emitida · solo lectura
                </Badge>
              ) : (
                <IndicadorGuardado estado={estado} />
              )
            }
          />
        </div>
      </Group>

      {soloLectura && (
        <Alert color="blue" title="Liquidación emitida">
          Este recibo no se puede modificar. Reabrí la liquidación para editarlo.
        </Alert>
      )}
      {!soloLectura && (estado.tipo === 'error' || estado.tipo === 'invalido') && (
        <Alert color={estado.tipo === 'error' ? 'red' : 'yellow'} role="alert">
          {estado.mensaje}
        </Alert>
      )}

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Stack gap="md">
            <Paper withBorder radius="lg" p="lg">
              <NumberInput
                label="Días no trabajados"
                description="Se descuentan del sueldo mensual"
                w={220}
                min={0}
                max={30}
                allowDecimal={false}
                allowNegative={false}
                clampBehavior="strict"
                value={entradas.diasNoTrabajados}
                onChange={(value) => {
                  if (typeof value === 'number' && value !== entradas.diasNoTrabajados) {
                    editar({ ...entradas, diasNoTrabajados: value })
                  }
                }}
                disabled={soloLectura}
              />
            </Paper>

            <Paper withBorder radius="lg" p="lg">
              <Title order={3} fz={16} ff="var(--mantine-font-family)" fw={600} mb="sm">
                Líneas manuales
              </Title>
              <LineasManuales
                lineas={entradas.lineasManuales}
                onChange={(lineasManuales) => editar({ ...entradas, lineasManuales })}
                disabled={soloLectura}
              />
            </Paper>

            <Paper withBorder radius="lg" p="lg">
              <Title order={3} fz={16} ff="var(--mantine-font-family)" fw={600} mb="sm">
                Conceptos calculados
              </Title>
              <LineasAuto
                lineas={detalle.lineas}
                overrides={entradas.overrides}
                valoresCalculados={detalle.valoresCalculados}
                onOverride={setOverride}
                disabled={soloLectura}
              />
            </Paper>

            <Paper radius="lg" p="lg" style={{ background: '#17211E' }}>
              <Group justify="space-between" grow>
                <Total label="Total haberes" value={detalle.totales.totalHaberes} />
                <Total label="Total descuentos" value={detalle.totales.totalDescuentos} />
                <Total label="Líquido" value={detalle.totales.liquido} fuerte />
              </Group>
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <div style={{ position: 'sticky', top: 16 }}>
            <ReciboPreview datos={detalle.impresion} actualizando={estado.tipo === 'guardando'} />
          </div>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function IndicadorGuardado({ estado }: { estado: EstadoGuardado }) {
  const { label, color } = {
    guardado: { label: 'Cambios guardados', color: 'forest' },
    pendiente: { label: 'Cambios sin guardar', color: 'amber' },
    guardando: { label: 'Guardando…', color: 'blue' },
    invalido: { label: 'Datos incompletos', color: 'amber' },
    error: { label: 'Error al guardar', color: 'red' },
  }[estado.tipo]
  return (
    <Badge color={color} variant="light" size="lg" data-testid="estado-guardado">
      {label}
    </Badge>
  )
}

function Total({ label, value, fuerte = false }: { label: string; value: number; fuerte?: boolean }) {
  return (
    <div>
      <Text size="sm" c="#B9C6C0">
        {label}
      </Text>
      <Text
        c="white"
        fw={fuerte ? 500 : 600}
        fz={fuerte ? 28 : 20}
        ff={fuerte ? 'var(--mantine-font-family-headings)' : undefined}
        data-testid={`total-${label}`}
      >
        {formatMoney(value)}
      </Text>
    </div>
  )
}

function parseId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return id > 0 ? id : null
}

/** "2024-08" → "08/2024". */
function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-')
  return `${month}/${year}`
}
