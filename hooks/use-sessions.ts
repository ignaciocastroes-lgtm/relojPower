"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CHECKPOINT_KEY,
  SESSIONS_KEY,
  checkpointToSession,
  normalizeSessions,
  parseCheckpoint,
  parseSessions,
  serializeCheckpoint,
  serializeSessions,
  upsertSession,
  type SessionCheckpoint,
  type SessionRecord,
} from "@/lib/session-log"

/**
 * Historial de sesiones en localStorage. Mismas garantías que useRoutines:
 * lectura tras montar (sin romper la hidratación), nada se escribe antes de leer,
 * y lo dañado se respalda antes de sobrescribirse.
 *
 * Además recupera una sesión que quedó a medias: mientras entrenas, el reloj guarda una
 * "foto" (checkpoint) cada pocos segundos. Si la app se cierra o el sistema la mata,
 * al abrirla esa foto se convierte en una sesión parcial en vez de perderse.
 *
 * La carga es IDEMPOTENTE a propósito: en desarrollo React ejecuta los efectos dos veces
 * (StrictMode), así que la foto NO se borra al leerla, sino después de guardar con éxito
 * el historial que ya la incluye.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const clearCheckpointAfterSave = useRef(false)

  useEffect(() => {
    let raw: string | null = null
    let rawCheckpoint: string | null = null
    try {
      raw = window.localStorage.getItem(SESSIONS_KEY)
      rawCheckpoint = window.localStorage.getItem(CHECKPOINT_KEY)
    } catch {
      setNotice("No se pudo leer el almacenamiento del navegador. El historial no se guardará.")
    }

    const result = parseSessions(raw)
    let list = result.sessions
    let message: string | null = null

    if (result.corrupt && raw !== null) {
      try {
        window.localStorage.setItem(`${SESSIONS_KEY}:corrupt`, raw)
      } catch {
        // sin espacio: nada más que hacer
      }
      message = "El historial guardado estaba dañado y se reinició."
    } else if (result.dropped > 0) {
      message = `Se omitieron ${result.dropped} sesión(es) dañada(s) del historial.`
    }

    if (rawCheckpoint !== null) {
      const checkpoint = parseCheckpoint(rawCheckpoint)
      const recovered = checkpoint ? checkpointToSession(checkpoint) : null
      if (recovered) {
        list = upsertSession(list, recovered)
        message = "Se recuperó una sesión que quedó a medias."
      }
      clearCheckpointAfterSave.current = true // se borra tras guardar (ver save effect)
    }

    if (message) setNotice(message)
    setSessions(list)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(SESSIONS_KEY, serializeSessions(sessions))
      setSaveFailed(false)
      if (clearCheckpointAfterSave.current) {
        clearCheckpointAfterSave.current = false
        window.localStorage.removeItem(CHECKPOINT_KEY)
      }
    } catch {
      setSaveFailed(true)
    }
  }, [sessions, loaded])

  /** Idempotente por id: registrar la misma sesión dos veces no la duplica. */
  const recordSession = useCallback((session: SessionRecord) => {
    setSessions((prev) => upsertSession(prev, session))
  }, [])

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  /** Sustituye todo el historial (restaurar una copia de seguridad). */
  const replaceAll = useCallback((list: SessionRecord[]) => {
    setSessions(normalizeSessions(list))
  }, [])

  /** Guarda (o borra, con null) la foto de la sesión en curso. Escritura directa: no toca el estado. */
  const saveCheckpoint = useCallback((checkpoint: SessionCheckpoint | null) => {
    try {
      if (checkpoint) window.localStorage.setItem(CHECKPOINT_KEY, serializeCheckpoint(checkpoint))
      else window.localStorage.removeItem(CHECKPOINT_KEY)
    } catch {
      // Sin almacenamiento el historial ya avisa con saveFailed al guardar; aquí no hay nada útil que hacer.
    }
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return { sessions, loaded, notice, saveFailed, recordSession, deleteSession, replaceAll, saveCheckpoint, dismissNotice }
}
