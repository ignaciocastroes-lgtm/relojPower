/**
 * Historial de sesiones. PURO: sin DOM ni React (el acceso a localStorage vive en
 * hooks/use-sessions.ts). Todo lo que se muestra en Historial se calcula desde aquí,
 * a partir de sesiones realmente registradas por el reloj.
 *
 * Reglas de qué es una sesión:
 * - Termina sola (llega al final del plan)            -> completa.
 * - Se detiene con Reiniciar / cambio de modo / cierre -> "parcial" si tenía plan;
 *   el cronómetro no tiene meta, así que al detenerlo cuenta como completo.
 * - Menos de MIN_SESSION_SECONDS de tiempo activo no se guarda (toques accidentales),
 *   salvo que la sesión haya terminado sola.
 */

import { newId } from "./routine-storage"

export const SESSIONS_KEY = "powerlock:sessions:v1"
export const CHECKPOINT_KEY = "powerlock:active-session:v1"
export const SESSIONS_VERSION = 1

/** Tiempo activo mínimo para que una sesión abandonada quede registrada. */
export const MIN_SESSION_SECONDS = 30
/** Tope de sesiones guardadas (las más antiguas se descartan). ~5 años a diario. */
export const MAX_SESSIONS = 3000
const MAX_DURATION_SECONDS = 48 * 3600

export type SessionKind = "tabata" | "emom" | "fgb" | "stopwatch" | "routine"

export const SESSION_KINDS: readonly SessionKind[] = ["tabata", "emom", "fgb", "stopwatch", "routine"]

export const KIND_LABEL: Record<Exclude<SessionKind, "routine">, string> = {
  tabata: "Tabata",
  emom: "EMOM",
  fgb: "FGB",
  stopwatch: "Cronómetro",
}

export interface SessionRecord {
  id: string
  startedAt: string // ISO
  endedAt: string // ISO
  /** Tiempo activo en segundos: es exactamente el "Tiempo total" que mostraba el reloj. */
  durationSeconds: number
  kind: SessionKind
  routineId?: string
  routineName?: string
  /** Rondas (Tabata/EMOM/FGB) o series (rutina) superadas. 0 en cronómetro. */
  rounds: number
  completed: boolean
}

/** Foto de una sesión en curso, guardada cada pocos segundos para poder recuperarla. */
export interface SessionCheckpoint {
  id: string
  startedAt: string
  lastSeenAt: string
  durationSeconds: number
  kind: SessionKind
  routineId?: string
  routineName?: string
  rounds: number
}

export function newSessionId(): string {
  return newId("session")
}

export function sessionTitle(s: Pick<SessionRecord, "kind" | "routineName">): string {
  if (s.kind === "routine") return s.routineName || "Rutina"
  return KIND_LABEL[s.kind]
}

/* ----------------------------- Persistencia ----------------------------- */

export interface ParseSessionsResult {
  sessions: SessionRecord[]
  dropped: number
  corrupt: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function intIn(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, Math.round(v)))
}

function optText(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.slice(0, 120) : undefined
}

function isKind(v: unknown): v is SessionKind {
  return typeof v === "string" && (SESSION_KINDS as readonly string[]).includes(v)
}

function sanitizeSession(raw: unknown): SessionRecord | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === "string" && raw.id !== "" ? raw.id : null
  const startedAt = isoOrNull(raw.startedAt)
  const endedAt = isoOrNull(raw.endedAt)
  const durationSeconds = intIn(raw.durationSeconds, 0, MAX_DURATION_SECONDS)
  const rounds = intIn(raw.rounds, 0, 9999)
  if (!id || !startedAt || !endedAt || durationSeconds === null || rounds === null || !isKind(raw.kind)) return null
  return {
    id,
    startedAt,
    endedAt,
    durationSeconds,
    kind: raw.kind,
    routineId: optText(raw.routineId),
    routineName: optText(raw.routineName),
    rounds,
    completed: raw.completed === true,
  }
}

/** Más reciente primero, sin ids repetidos, con tope. Devuelve una lista nueva. */
export function normalizeSessions(list: SessionRecord[]): SessionRecord[] {
  const seen = new Set<string>()
  const unique: SessionRecord[] = []
  for (const s of list) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    unique.push(s)
  }
  unique.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
  return unique.slice(0, MAX_SESSIONS)
}

export function serializeSessions(sessions: SessionRecord[]): string {
  return JSON.stringify({ version: SESSIONS_VERSION, sessions })
}

export function parseSessions(raw: string | null): ParseSessionsResult {
  if (raw === null) return { sessions: [], dropped: 0, corrupt: false }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { sessions: [], dropped: 0, corrupt: true }
  }
  if (!isRecord(data) || data.version !== SESSIONS_VERSION || !Array.isArray(data.sessions)) {
    return { sessions: [], dropped: 0, corrupt: true }
  }

  const valid: SessionRecord[] = []
  let dropped = 0
  const seen = new Set<string>()
  for (const item of data.sessions) {
    const s = sanitizeSession(item)
    if (!s || seen.has(s.id)) {
      dropped++
      continue
    }
    seen.add(s.id)
    valid.push(s)
  }
  return { sessions: normalizeSessions(valid), dropped, corrupt: false }
}

/** Inserta o reemplaza por id (idempotente: registrar dos veces la misma sesión no duplica). */
export function upsertSession(list: SessionRecord[], session: SessionRecord): SessionRecord[] {
  return normalizeSessions([session, ...list.filter((s) => s.id !== session.id)])
}

/* ------------------------------ Checkpoint ------------------------------ */

export function serializeCheckpoint(cp: SessionCheckpoint): string {
  return JSON.stringify({ version: SESSIONS_VERSION, checkpoint: cp })
}

export function parseCheckpoint(raw: string | null): SessionCheckpoint | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data) || data.version !== SESSIONS_VERSION || !isRecord(data.checkpoint)) return null
  const c = data.checkpoint
  const id = typeof c.id === "string" && c.id !== "" ? c.id : null
  const startedAt = isoOrNull(c.startedAt)
  const lastSeenAt = isoOrNull(c.lastSeenAt)
  const durationSeconds = intIn(c.durationSeconds, 0, MAX_DURATION_SECONDS)
  const rounds = intIn(c.rounds, 0, 9999)
  if (!id || !startedAt || !lastSeenAt || durationSeconds === null || rounds === null || !isKind(c.kind)) return null
  return {
    id,
    startedAt,
    lastSeenAt,
    durationSeconds,
    kind: c.kind,
    routineId: optText(c.routineId),
    routineName: optText(c.routineName),
    rounds,
  }
}

/** Convierte una sesión que quedó a medias en un registro parcial, o null si fue demasiado corta. */
export function checkpointToSession(cp: SessionCheckpoint): SessionRecord | null {
  if (cp.durationSeconds < MIN_SESSION_SECONDS) return null
  return {
    id: cp.id,
    startedAt: cp.startedAt,
    endedAt: cp.lastSeenAt,
    durationSeconds: cp.durationSeconds,
    kind: cp.kind,
    routineId: cp.routineId,
    routineName: cp.routineName,
    rounds: cp.rounds,
    completed: false,
  }
}

/* ------------------------------ Fechas ------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, "0")

/** Clave de día en hora LOCAL: "2026-09-23". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Medianoche local de un día. Se construye por calendario (no restando 24 h) para sobrevivir a los cambios de hora. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Lunes 00:00 local de la semana de `d` (la semana empieza en lunes). */
export function startOfWeek(d: Date): Date {
  const daysSinceMonday = (d.getDay() + 6) % 7
  return addDays(startOfDay(d), -daysSinceMonday)
}

/** Días de calendario entre dos fechas (a - b), en hora local. */
function calendarDaysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcA - utcB) / 86_400_000)
}

/* ---------------------------- Estadísticas ---------------------------- */

export interface HistoryStats {
  weekSessions: number
  weekSeconds: number
  streakDays: number
  totalSessions: number
}

/** Días seguidos entrenando. Sigue viva si entrenaste hoy o ayer (todavía puedes entrenar hoy). */
export function computeStreak(sessions: SessionRecord[], now: Date): number {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))))
  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function computeStats(sessions: SessionRecord[], now: Date): HistoryStats {
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  let weekSessions = 0
  let weekSeconds = 0
  for (const s of sessions) {
    const t = new Date(s.startedAt)
    if (t >= weekStart && t < weekEnd) {
      weekSessions++
      weekSeconds += s.durationSeconds
    }
  }
  return { weekSessions, weekSeconds, streakDays: computeStreak(sessions, now), totalSessions: sessions.length }
}

/* ---------------------------- Formato ---------------------------- */

/** 235 -> "3:55"; 3725 -> "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`
}

/** Para la tarjeta de tiempo semanal: menos de 1 h en minutos, si no "h:mm". */
export function formatTotalTime(seconds: number): { value: string; unit: string } {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 3600) return { value: String(Math.floor(s / 60)), unit: "min" }
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return { value: `${h}:${pad2(m)}`, unit: "horas" }
}

export function timeOfDay(iso: string): string {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  const diff = calendarDaysBetween(now, d)
  if (diff <= 0) return "Hoy"
  if (diff === 1) return "Ayer"
  if (diff <= 6) return `Hace ${diff} días`
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(d)
}

export function roundsLabel(s: Pick<SessionRecord, "kind" | "rounds">): string | null {
  if (s.rounds <= 0 || s.kind === "stopwatch") return null
  const unit = s.kind === "routine" ? "serie" : "ronda"
  return `${s.rounds} ${unit}${s.rounds === 1 ? "" : "s"}`
}
