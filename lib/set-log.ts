/**
 * Registro de series: peso y repeticiones REALES que el usuario confirma. PURO: sin DOM ni React
 * (el acceso a localStorage vive en hooks/use-set-logs.ts).
 *
 * Reglas:
 *  - Solo se guarda lo que el usuario confirma. Las sugerencias (último peso usado, reps del plan)
 *    rellenan los campos, pero nunca se guardan solas.
 *  - Volumen = peso x repeticiones. Una serie por tiempo (reps = null) no aporta volumen.
 *  - Lo dañado se descarta y se cuenta; nunca rompe la app.
 */

import { newId } from "./routine-storage"
import { startOfWeek } from "./session-log"

export const SETS_KEY = "powerlock:sets:v1"
export const SETS_VERSION = 1
/** Tope de series guardadas (~2 MB): localStorage tiene ~5 MB y se comparte con rutinas e historial. */
export const MAX_SETS = 10_000
export const MAX_WEIGHT_KG = 1000
export const MAX_REPS = 999

export interface SetLog {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  /** 1-based, dentro de ese ejercicio en la sesión. */
  setNumber: number
  /** 0 = peso corporal / sin carga. */
  weightKg: number
  /** null = serie por tiempo (no hay repeticiones que contar). */
  reps: number | null
  loggedAt: string // ISO
}

export interface SetInput {
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  weightKg: number
  reps: number | null
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function newSetId(): string {
  return newId("set")
}

/** Valida lo que escribió el usuario. null = no es válido (no se guarda nada). */
export function makeSet(input: SetInput, now: Date, id: string = newSetId()): SetLog | null {
  const { weightKg, reps } = input
  if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > MAX_WEIGHT_KG) return null
  if (reps !== null && (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS)) return null
  if (!input.sessionId || !input.exerciseId || !input.exerciseName.trim()) return null
  if (!Number.isInteger(input.setNumber) || input.setNumber < 1 || input.setNumber > 99) return null
  return {
    id,
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName.trim().slice(0, 120),
    setNumber: input.setNumber,
    weightKg: round2(weightKg),
    reps,
    loggedAt: now.toISOString(),
  }
}

/* ----------------------------- Persistencia ----------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null
}

export function sanitizeSet(raw: unknown): SetLog | null {
  if (!isRecord(raw)) return null
  const id = text(raw.id, 200)
  const sessionId = text(raw.sessionId, 200)
  const exerciseId = text(raw.exerciseId, 200)
  const exerciseName = text(raw.exerciseName, 120)
  const loggedMs = typeof raw.loggedAt === "string" ? Date.parse(raw.loggedAt) : NaN
  if (!id || !sessionId || !exerciseId || !exerciseName || Number.isNaN(loggedMs)) return null
  const setNumber = raw.setNumber
  if (typeof setNumber !== "number" || !Number.isInteger(setNumber) || setNumber < 1 || setNumber > 99) return null
  const weight = raw.weightKg
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT_KG) return null
  const reps = raw.reps
  if (reps !== null && (typeof reps !== "number" || !Number.isInteger(reps) || reps < 1 || reps > MAX_REPS)) return null
  return {
    id,
    sessionId,
    exerciseId,
    exerciseName,
    setNumber,
    weightKg: round2(weight),
    reps: reps === null ? null : reps,
    loggedAt: new Date(loggedMs).toISOString(),
  }
}

/** Más reciente primero, sin ids repetidos, con tope. */
export function normalizeSets(list: SetLog[]): SetLog[] {
  const seen = new Set<string>()
  const unique: SetLog[] = []
  for (const s of list) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    unique.push(s)
  }
  unique.sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt))
  return unique.slice(0, MAX_SETS)
}

export function serializeSets(sets: SetLog[]): string {
  return JSON.stringify({ version: SETS_VERSION, sets })
}

export interface ParseSetsResult {
  sets: SetLog[]
  dropped: number
  corrupt: boolean
}

export function parseSets(raw: string | null): ParseSetsResult {
  if (raw === null) return { sets: [], dropped: 0, corrupt: false }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { sets: [], dropped: 0, corrupt: true }
  }
  if (!isRecord(data) || data.version !== SETS_VERSION || !Array.isArray(data.sets)) return { sets: [], dropped: 0, corrupt: true }
  const valid: SetLog[] = []
  const seen = new Set<string>()
  let dropped = 0
  for (const item of data.sets) {
    const s = sanitizeSet(item)
    if (!s || seen.has(s.id)) {
      dropped++
      continue
    }
    seen.add(s.id)
    valid.push(s)
  }
  return { sets: normalizeSets(valid), dropped, corrupt: false }
}

export function addSet(list: SetLog[], set: SetLog): SetLog[] {
  return normalizeSets([set, ...list.filter((s) => s.id !== set.id)])
}
export function removeSet(list: SetLog[], id: string): SetLog[] {
  return list.filter((s) => s.id !== id)
}
/** Al borrar una sesión del historial se borran también sus series. */
export function removeSessionSets(list: SetLog[], sessionId: string): SetLog[] {
  return list.filter((s) => s.sessionId !== sessionId)
}
/** Une dos listas por id (para restaurar copias). */
export function mergeSets(current: SetLog[], incoming: SetLog[]): SetLog[] {
  const have = new Set(current.map((s) => s.id))
  return normalizeSets([...current, ...incoming.filter((s) => !have.has(s.id))])
}

/* ------------------------------- Cálculos ------------------------------- */

export function setVolume(s: Pick<SetLog, "weightKg" | "reps">): number {
  return s.reps === null ? 0 : round2(s.weightKg * s.reps)
}

export function totalVolume(sets: SetLog[]): number {
  return round2(sets.reduce((acc, s) => acc + setVolume(s), 0))
}

const byTimeAsc = (a: SetLog, b: SetLog) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt) || a.setNumber - b.setNumber

export interface SessionSetSummary {
  sets: number
  volumeKg: number
  /** En el orden en que se hicieron. */
  exercises: { exerciseId: string; name: string; sets: SetLog[] }[]
}

export function summarizeSessionSets(all: SetLog[], sessionId: string): SessionSetSummary | null {
  const mine = all.filter((s) => s.sessionId === sessionId).sort(byTimeAsc)
  if (mine.length === 0) return null
  const groups = new Map<string, { exerciseId: string; name: string; sets: SetLog[] }>()
  for (const s of mine) {
    const g = groups.get(s.exerciseId) ?? { exerciseId: s.exerciseId, name: s.exerciseName, sets: [] }
    g.sets.push(s)
    groups.set(s.exerciseId, g)
  }
  return { sets: mine.length, volumeKg: totalVolume(mine), exercises: [...groups.values()] }
}

/** Series de la semana en curso (lunes a domingo, hora local). */
export function weekSets(all: SetLog[], now: Date): SetLog[] {
  const weekStart = startOfWeek(now)
  const start = weekStart.getTime()
  const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7).getTime() // por calendario: sobrevive a cambios de hora
  return all.filter((s) => {
    const t = Date.parse(s.loggedAt)
    return t >= start && t < end
  })
}

/** Volumen de la semana en curso. */
export function weekVolumeKg(all: SetLog[], now: Date): number {
  return totalVolume(weekSets(all, now))
}

/** Lo último que el usuario hizo con ese ejercicio (para sugerir el peso). */
export function lastPerformance(all: SetLog[], exerciseId: string): { weightKg: number; reps: number | null; loggedAt: string } | null {
  let best: SetLog | null = null
  for (const s of all) if (s.exerciseId === exerciseId && (best === null || Date.parse(s.loggedAt) > Date.parse(best.loggedAt))) best = s
  return best ? { weightKg: best.weightKg, reps: best.reps, loggedAt: best.loggedAt } : null
}

/** Qué rellenar (NO guardar) en el formulario de una serie: el último peso usado y las reps del plan. */
export function suggestSet(all: SetLog[], block: { exerciseId: string; isTime: boolean; reps: number }): { weightKg: number; reps: number | null } {
  const last = lastPerformance(all, block.exerciseId)
  return { weightKg: last?.weightKg ?? 0, reps: block.isTime ? null : Math.max(1, block.reps) }
}

export interface ExerciseSummary {
  exerciseId: string
  name: string
  totalSets: number
  totalVolumeKg: number
  sessions: number
  /** Serie con más peso (a igualdad, la de más repeticiones, luego la más reciente). */
  bestWeight: { weightKg: number; reps: number | null; at: string }
  /** Serie con más volumen (peso x reps); null si solo hay series por tiempo. */
  bestSetVolume: { volumeKg: number; weightKg: number; reps: number; at: string } | null
  lastAt: string
}

export function summarizeExercises(all: SetLog[]): ExerciseSummary[] {
  const groups = new Map<string, SetLog[]>()
  for (const s of all) groups.set(s.exerciseId, [...(groups.get(s.exerciseId) ?? []), s])
  const out: ExerciseSummary[] = []
  for (const [exerciseId, sets] of groups) {
    const newestFirst = [...sets].sort((a, b) => Date.parse(b.loggedAt) - Date.parse(a.loggedAt))
    let bestW = newestFirst[0]
    let bestV: SetLog | null = null
    for (const s of newestFirst) {
      if (s.weightKg > bestW.weightKg || (s.weightKg === bestW.weightKg && (s.reps ?? 0) > (bestW.reps ?? 0))) bestW = s
      if (s.reps !== null && (bestV === null || setVolume(s) > setVolume(bestV))) bestV = s
    }
    out.push({
      exerciseId,
      name: newestFirst[0].exerciseName,
      totalSets: sets.length,
      totalVolumeKg: totalVolume(sets),
      sessions: new Set(sets.map((s) => s.sessionId)).size,
      bestWeight: { weightKg: bestW.weightKg, reps: bestW.reps, at: bestW.loggedAt },
      bestSetVolume: bestV && bestV.reps !== null ? { volumeKg: setVolume(bestV), weightKg: bestV.weightKg, reps: bestV.reps, at: bestV.loggedAt } : null,
      lastAt: newestFirst[0].loggedAt,
    })
  }
  return out.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt))
}

export interface ProgressPoint {
  sessionId: string
  at: string
  maxWeightKg: number
  volumeKg: number
  sets: number
}

/** Una marca por sesión (la más antigua primero), para dibujar la evolución de un ejercicio. */
export function exerciseProgress(all: SetLog[], exerciseId: string, limit = 12): ProgressPoint[] {
  const bySession = new Map<string, SetLog[]>()
  for (const s of all) if (s.exerciseId === exerciseId) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s])
  const points: ProgressPoint[] = [...bySession.entries()].map(([sessionId, sets]) => ({
    sessionId,
    at: sets.reduce((min, s) => (Date.parse(s.loggedAt) < Date.parse(min) ? s.loggedAt : min), sets[0].loggedAt),
    maxWeightKg: Math.max(...sets.map((s) => s.weightKg)),
    volumeKg: totalVolume(sets),
    sets: sets.length,
  }))
  points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return points.slice(-Math.max(1, limit))
}

export interface RecordCheck {
  /** ¿Había historial previo de ese ejercicio? La primera vez no se celebra ningún récord. */
  hasHistory: boolean
  weight: boolean
  setVolume: boolean
}

/** Compara una serie NUEVA con el historial anterior del ejercicio (sin incluirla). */
export function detectRecords(history: SetLog[], candidate: { exerciseId: string; weightKg: number; reps: number | null }): RecordCheck {
  const prior = history.filter((s) => s.exerciseId === candidate.exerciseId)
  if (prior.length === 0) return { hasHistory: false, weight: false, setVolume: false }
  const maxWeight = Math.max(...prior.map((s) => s.weightKg))
  const maxVolume = Math.max(0, ...prior.map(setVolume))
  const vol = candidate.reps === null ? 0 : round2(candidate.weightKg * candidate.reps)
  return {
    hasHistory: true,
    weight: candidate.weightKg > 0 && candidate.weightKg > maxWeight,
    setVolume: candidate.weightKg > 0 && vol > maxVolume,
  }
}

/* -------------------------------- Formato -------------------------------- */

const kgFormat = new Intl.NumberFormat("es", { maximumFractionDigits: 2 })
export function formatKg(kg: number): string {
  return kgFormat.format(kg)
}

/** "60 kg × 8", "peso corporal × 12", "60 kg · por tiempo". */
export function setLabel(s: Pick<SetLog, "weightKg" | "reps">): string {
  const load = s.weightKg > 0 ? `${formatKg(s.weightKg)} kg` : "peso corporal"
  return s.reps === null ? `${load} · por tiempo` : `${load} × ${s.reps}`
}
