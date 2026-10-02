import { and, asc, desc, eq, lte, ne } from 'drizzle-orm'
import { AppError } from '@shared/api'
import type { Condicion, CondicionInput, IsoDate, Trabajador, TrabajadorInput } from '@shared/types'
import { getDb, type Conn } from '../db/connection'
import { trabajadorCondiciones, trabajadores } from '../db/schema'

function pickTrabajador(input: TrabajadorInput): TrabajadorInput {
  return {
    numero: input.numero,
    ci: input.ci,
    nombre: input.nombre,
    cargo: input.cargo,
    fechaIngreso: input.fechaIngreso,
    afiliacionBps: input.afiliacionBps,
    carpetaBse: input.carpetaBse,
    activo: input.activo,
  }
}

export function trabajadoresRepo(db: Conn = getDb()) {
  function assertNumeroLibre(numero: number, exceptId?: number): void {
    const clash = db
      .select({ id: trabajadores.id })
      .from(trabajadores)
      .where(
        exceptId === undefined
          ? eq(trabajadores.numero, numero)
          : and(eq(trabajadores.numero, numero), ne(trabajadores.id, exceptId)),
      )
      .get()
    if (clash) {
      throw new AppError('CONFLICTO', `Ya existe un trabajador con el número ${numero}`)
    }
  }

  return {
    /** Ordered by numero. */
    list(opts: { soloActivos: boolean } = { soloActivos: false }): Trabajador[] {
      return db
        .select()
        .from(trabajadores)
        .where(opts.soloActivos ? eq(trabajadores.activo, true) : undefined)
        .orderBy(asc(trabajadores.numero))
        .all()
    },

    get(id: number): Trabajador | null {
      return db.select().from(trabajadores).where(eq(trabajadores.id, id)).get() ?? null
    },

    /** Throws CONFLICTO when `numero` is taken. */
    create(input: TrabajadorInput): Trabajador {
      assertNumeroLibre(input.numero)
      return db.insert(trabajadores).values(pickTrabajador(input)).returning().get()
    },

    /** Throws NO_ENCONTRADO or CONFLICTO. */
    update(id: number, input: TrabajadorInput): Trabajador {
      assertNumeroLibre(input.numero, id)
      const row = db
        .update(trabajadores)
        .set(pickTrabajador(input))
        .where(eq(trabajadores.id, id))
        .returning()
        .get()
      if (!row) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
      return row
    },

    /** Newest first. */
    listCondiciones(trabajadorId: number): Condicion[] {
      return db
        .select()
        .from(trabajadorCondiciones)
        .where(eq(trabajadorCondiciones.trabajadorId, trabajadorId))
        .orderBy(desc(trabajadorCondiciones.vigenteDesde))
        .all()
    },

    /** The condition in force on `fecha`: newest vigenteDesde <= fecha. */
    condicionVigente(trabajadorId: number, fecha: IsoDate): Condicion | null {
      return (
        db
          .select()
          .from(trabajadorCondiciones)
          .where(
            and(
              eq(trabajadorCondiciones.trabajadorId, trabajadorId),
              lte(trabajadorCondiciones.vigenteDesde, fecha),
            ),
          )
          .orderBy(desc(trabajadorCondiciones.vigenteDesde))
          .limit(1)
          .get() ?? null
      )
    },

    /**
     * Adds a new version; never edits existing rows. Throws NO_ENCONTRADO for an unknown worker
     * and CONFLICTO when a version with the same vigenteDesde exists.
     */
    addCondicion(trabajadorId: number, input: CondicionInput): Condicion {
      return db.transaction((tx) => {
        const worker = tx
          .select({ id: trabajadores.id })
          .from(trabajadores)
          .where(eq(trabajadores.id, trabajadorId))
          .get()
        if (!worker) throw new AppError('NO_ENCONTRADO', 'Trabajador no encontrado')
        const clash = tx
          .select({ id: trabajadorCondiciones.id })
          .from(trabajadorCondiciones)
          .where(
            and(
              eq(trabajadorCondiciones.trabajadorId, trabajadorId),
              eq(trabajadorCondiciones.vigenteDesde, input.vigenteDesde),
            ),
          )
          .get()
        if (clash) {
          throw new AppError('CONFLICTO', `Ya existe una condición vigente desde ${input.vigenteDesde}`)
        }
        return tx
          .insert(trabajadorCondiciones)
          .values({
            trabajadorId,
            vigenteDesde: input.vigenteDesde,
            sueldoNominal: input.sueldoNominal,
            fonasaConyuge: input.fonasaConyuge,
            fonasaHijos: input.fonasaHijos,
            fonasaTasaManual: input.fonasaTasaManual,
            irpfHijos: input.irpfHijos,
            irpfHijosDiscapacidad: input.irpfHijosDiscapacidad,
            irpfPctAtribucion: input.irpfPctAtribucion,
            irpfOtrasDeducciones: input.irpfOtrasDeducciones,
          })
          .returning()
          .get()
      })
    },
  }
}

export type TrabajadoresRepo = ReturnType<typeof trabajadoresRepo>
