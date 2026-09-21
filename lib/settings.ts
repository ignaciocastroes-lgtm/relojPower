/**
 * Ajustes de la app. PURO: sin DOM ni React (el acceso a localStorage vive en
 * hooks/use-settings.ts). Solo hay ajustes que hacen algo real: volumen y vibración.
 */

export const SETTINGS_KEY = "powerlock:settings:v1"

export interface AppSettings {
  /** 0–100. 0 silencia los avisos. */
  volume: number
  vibration: boolean
}

export const DEFAULT_SETTINGS: AppSettings = { volume: 75, vibration: true }

/** Ganancia máxima: deja margen para que las ondas cuadradas no saturen. */
const MAX_GAIN = 0.9

/**
 * Volumen (0–100) a ganancia de audio. Curva cuadrática: el oído percibe el volumen de forma
 * no lineal, así el control se siente parejo. 0 = silencio absoluto; 75 ≈ 0.5 (el nivel original).
 */
export function volumeToGain(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100
  return v <= 0 ? 0 : MAX_GAIN * v * v
}

function sanitize(raw: Record<string, unknown>): AppSettings {
  const v = raw.volume
  const volume = typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_SETTINGS.volume
  const vibration = typeof raw.vibration === "boolean" ? raw.vibration : DEFAULT_SETTINGS.vibration
  return { volume, vibration }
}

export function normalizeSettings(s: AppSettings): AppSettings {
  return sanitize({ ...s })
}

export function serializeSettings(s: AppSettings): string {
  return JSON.stringify({ version: 1, settings: normalizeSettings(s) })
}

/** Nunca lanza: cualquier cosa inválida cae a los valores por defecto (campo a campo). */
export function parseSettings(raw: string | null): AppSettings {
  if (raw === null) return { ...DEFAULT_SETTINGS }
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== "object" || data === null || Array.isArray(data)) return { ...DEFAULT_SETTINGS }
    const d = data as Record<string, unknown>
    if (d.version !== 1 || typeof d.settings !== "object" || d.settings === null || Array.isArray(d.settings)) return { ...DEFAULT_SETTINGS }
    return sanitize(d.settings as Record<string, unknown>)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}
