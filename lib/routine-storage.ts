/**
 * Guardado de rutinas en localStorage. Este archivo es PURO (sin DOM ni React):
 * solo serializa y valida. El acceso real a localStorage vive en hooks/use-routines.ts.
 *
 * Regla: lo que venga del almacenamiento no es de fiar. Todo se valida y se sanea;
 * lo dañado se descarta y se cuenta, pero nunca rompe la app.
 */

import { estimateRoutineMinutes } from "./timer-engine"
import type { ExerciseBlock, SavedRoutine } from "./types"

export const STORAGE_KEY = "powerlock:routines:v1"
export const STORAGE_VERSION = 1

export interface ParseResult {
  routines: SavedRoutine[]
  /** Rutinas o ejercicios descartados por estar dañados. */
  dropped: number
  /** El contenido completo no se pudo interpretar. */
  corrupt: boolean
}

export function serializeRoutines(routines: SavedRoutine[]): string {
  return JSON.stringify({ version: STORAGE_VERSION, routines })
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined
}

function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined
}

/** Número entero acotado; si no es un número válido devuelve `fallback`. */
function int(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function newId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${uuid}`
}

function sanitizeBlock(raw: unknown): ExerciseBlock | null {
  if (!isRecord(raw)) return null
  const exerciseName = str(raw.exerciseName)
  if (!exerciseName) return null
  return {
    id: str(raw.id) ?? newId("block"),
    exerciseId: str(raw.exerciseId) ?? exerciseName,
    exerciseName,
    bodyPart: optStr(raw.bodyPart),
    equipment: optStr(raw.equipment),
    imageUrl: optStr(raw.imageUrl),
    sets: int(raw.sets, 1, 99, 3),
    reps: int(raw.reps, 1, 999, 12),
    restTime: int(raw.restTime, 0, 3600, 60),
    isTime: raw.isTime === true,
    duration: int(raw.duration, 1, 3600, 30),
  }
}

function sanitizeRoutine(raw: unknown): { routine: SavedRoutine | null; droppedBlocks: number } {
  if (!isRecord(raw)) return { routine: null, droppedBlocks: 0 }
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return { routine: null, droppedBlocks: 0 }

  const rawBlocks = Array.isArray(raw.exercises) ? raw.exercises : []
  const exercises = rawBlocks.map(sanitizeBlock).filter((b): b is ExerciseBlock => b !== null)

  const created = typeof raw.createdAt === "string" || typeof raw.createdAt === "number" ? new Date(raw.createdAt) : null
  return {
    routine: {
      id,
      name,
      description: typeof raw.description === "string" ? raw.description : "",
      exercises,
      createdAt: created && !Number.isNaN(created.getTime()) ? created : new Date(0),
      // Nunca se confía en el valor guardado: se recalcula con la misma fórmula del reloj.
      estimatedDuration: estimateRoutineMinutes(exercises),
    },
    droppedBlocks: rawBlocks.length - exercises.length,
  }
}

export function parseRoutines(raw: string | null): ParseResult {
  if (raw === null) return { routines: [], dropped: 0, corrupt: false }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { routines: [], dropped: 0, corrupt: true }
  }

  if (!isRecord(data) || data.version !== STORAGE_VERSION || !Array.isArray(data.routines)) {
    return { routines: [], dropped: 0, corrupt: true }
  }

  const routines: SavedRoutine[] = []
  const seen = new Set<string>()
  let dropped = 0
  for (const item of data.routines) {
    const { routine, droppedBlocks } = sanitizeRoutine(item)
    dropped += droppedBlocks
    if (!routine || seen.has(routine.id)) {
      dropped += 1
      continue
    }
    seen.add(routine.id)
    routines.push(routine)
  }
  return { routines, dropped, corrupt: false }
}
