/**
 * Copia de seguridad: un archivo JSON con TODO lo que la app guarda (rutinas, historial, series y ajustes).
 * PURO: sin DOM ni React. El archivo se valida igual que el almacenamiento local: lo dañado se descarta y se
 * cuenta, y un archivo que no es de POWERLOCK se rechaza con un mensaje claro sin tocar nada.
 */

import { parseRoutines, serializeRoutines } from "./routine-storage"
import { mergeSets, parseSets, serializeSets, type SetLog } from "./set-log"
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type AppSettings } from "./settings"
import { parseSessions, serializeSessions, upsertSession, type SessionRecord } from "./session-log"
import type { SavedRoutine } from "./types"

export const BACKUP_APP = "powerlock"
export const BACKUP_FORMAT = 1
/** Un archivo mayor que esto no puede ser una copia razonable (y colgaría el móvil al leerlo). */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024
export const LAST_BACKUP_KEY = "powerlock:last-backup:v1"

export interface BackupData {
  routines: SavedRoutine[]
  sessions: SessionRecord[]
  sets: SetLog[]
  settings: AppSettings
}

export interface BackupCounts {
  routines: number
  sessions: number
  sets: number
}

export const countBackup = (d: BackupData): BackupCounts => ({ routines: d.routines.length, sessions: d.sessions.length, sets: d.sets.length })

export function createBackup(data: BackupData, now: Date): string {
  // Cada parte se serializa con su propio serializador (el mismo que usa el almacenamiento local).
  return JSON.stringify(
    {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      exportedAt: now.toISOString(),
      counts: countBackup(data),
      data: {
        routines: JSON.parse(serializeRoutines(data.routines)).routines,
        sessions: JSON.parse(serializeSessions(data.sessions)).sessions,
        sets: JSON.parse(serializeSets(data.sets)).sets,
        settings: JSON.parse(serializeSettings(data.settings)).settings,
      },
    },
    null,
    1
  )
}

export type ParsedBackup =
  | { ok: true; data: BackupData; counts: BackupCounts; dropped: number; exportedAt: string | null }
  | { ok: false; error: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "El archivo es demasiado grande para ser una copia de POWERLOCK." }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "El archivo no es una copia válida (no se puede leer)." }
  }
  if (!isRecord(raw) || raw.app !== BACKUP_APP) return { ok: false, error: "Este archivo no es una copia de POWERLOCK." }
  if (typeof raw.format !== "number" || !Number.isInteger(raw.format) || raw.format < 1) return { ok: false, error: "La copia no indica su versión." }
  if (raw.format > BACKUP_FORMAT) return { ok: false, error: "La copia se creó con una versión más nueva de POWERLOCK. Actualiza la app para restaurarla." }
  if (!isRecord(raw.data)) return { ok: false, error: "La copia no contiene datos." }

  const d = raw.data
  const routines = parseRoutines(JSON.stringify({ version: 1, routines: Array.isArray(d.routines) ? d.routines : [] }))
  const sessions = parseSessions(JSON.stringify({ version: 1, sessions: Array.isArray(d.sessions) ? d.sessions : [] }))
  const sets = parseSets(JSON.stringify({ version: 1, sets: Array.isArray(d.sets) ? d.sets : [] }))
  const settings = isRecord(d.settings) ? parseSettings(JSON.stringify({ version: 1, settings: d.settings })) : { ...DEFAULT_SETTINGS }

  const data: BackupData = { routines: routines.routines, sessions: sessions.sessions, sets: sets.sets, settings }
  const exportedMs = typeof raw.exportedAt === "string" ? Date.parse(raw.exportedAt) : NaN
  return {
    ok: true,
    data,
    counts: countBackup(data),
    dropped: routines.dropped + sessions.dropped + sets.dropped + (routines.corrupt || sessions.corrupt || sets.corrupt ? 1 : 0),
    exportedAt: Number.isNaN(exportedMs) ? null : new Date(exportedMs).toISOString(),
  }
}

/**
 * Combinar: añade lo que falta (por id) sin borrar ni pisar nada de lo actual. Los ajustes actuales se conservan.
 */
export function mergeBackups(current: BackupData, incoming: BackupData): BackupData {
  const haveRoutine = new Set(current.routines.map((r) => r.id))
  let sessions = current.sessions
  for (const s of incoming.sessions) if (!sessions.some((x) => x.id === s.id)) sessions = upsertSession(sessions, s)
  return {
    routines: [...current.routines, ...incoming.routines.filter((r) => !haveRoutine.has(r.id))],
    sessions,
    sets: mergeSets(current.sets, incoming.sets),
    settings: current.settings,
  }
}

/** "powerlock-copia-2026-09-21.json" (fecha LOCAL). */
export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `powerlock-copia-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}

/** Días desde la última copia, o null si nunca se hizo o la fecha no es válida. */
export function daysSinceBackup(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}
