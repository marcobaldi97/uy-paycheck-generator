// Trabajadores service: identity data and versioned salary conditions, plus the FONASA rate
// preview shown while editing a condición.

import dayjs from 'dayjs'
import { fonasaBandaAlta, tasaFonasa } from '@engine/index'
import { AppError, type ApiInput } from '@shared/api'
import type {
  Condicion,
  CondicionInput,
  TasaFonasaPreview,
  Trabajador,
  TrabajadorDetalle,
  TrabajadorInput,
} from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { parametrosRepo } from '../repos/parametros'
import { trabajadoresRepo } from '../repos/trabajadores'

export type TasaFonasaInput = ApiInput<'trabajadores', 'tasaFonasa'>

export function trabajadoresService(db: Conn = getDb()) {
  return {
    /** Ordered by numero. */
    listar(opts: { soloActivos: boolean }): Trabajador[] {
      return trabajadoresRepo(db).list(opts)
    },

    /** The worker with every condición, newest first. Throws NO_ENCONTRADO. */
    obtener(id: number): TrabajadorDetalle {
      return db.transaction((tx) => {
        const repo = trabajadoresRepo(tx)
        const trabajador = repo.get(id)
        if (!trabajador) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
        return { trabajador, condiciones: repo.listCondiciones(id) }
      })
    },

    /** Throws CONFLICTO when `numero` is taken. */
    crear(input: TrabajadorInput): Trabajador {
      return trabajadoresRepo(db).create(input)
    },

    /** Throws NO_ENCONTRADO or CONFLICTO. */
    actualizar(id: number, datos: TrabajadorInput): Trabajador {
      return trabajadoresRepo(db).update(id, datos)
    },

    /**
     * Always inserts a new version; existing condiciones are never edited. Throws NO_ENCONTRADO
     * for an unknown worker and CONFLICTO when the vigenteDesde exists.
     */
    nuevaCondicion(trabajadorId: number, condicion: CondicionInput): Condicion {
      return trabajadoresRepo(db).addCondicion(trabajadorId, condicion)
    },

    /** Preview of the computed FONASA rate for a condition, using the parámetros in force on `fecha`. */
    tasaFonasa({ fecha, sueldoNominal, fonasaConyuge, fonasaHijos }: TasaFonasaInput): TasaFonasaPreview {
      const p = parametrosRepo(db).vigente(fecha)
      if (!p) {
        throw new AppError(
          'SIN_PARAMETROS',
          `No hay parámetros vigentes para la fecha ${dayjs(fecha).format('DD/MM/YYYY')}`,
          { fecha },
        )
      }
      return {
        tasa: tasaFonasa(sueldoNominal, { fonasaConyuge, fonasaHijos }, p),
        bandaAlta: fonasaBandaAlta(sueldoNominal, p),
        parametrosVigenteDesde: p.vigenteDesde,
      }
    },
  }
}

export type TrabajadoresService = ReturnType<typeof trabajadoresService>
