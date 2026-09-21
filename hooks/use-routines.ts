"use client"

import { useCallback, useEffect, useState } from "react"
import { parseRoutines, serializeRoutines, STORAGE_KEY } from "@/lib/routine-storage"
import type { SavedRoutine } from "@/lib/types"

/**
 * Rutinas persistidas en localStorage.
 *
 * - Se lee DESPUÉS de montar (en un efecto), no durante el render: el servidor no tiene
 *   localStorage y leerlo antes causaría error de hidratación.
 * - No se escribe nada hasta haber leído (`loaded`), para no pisar lo guardado con [].
 * - Si el contenido está dañado, se conserva una copia en `${STORAGE_KEY}:corrupt`
 *   antes de que un guardado posterior lo sobrescriba.
 */
export function useRoutines() {
  const [routines, setRoutines] = useState<SavedRoutine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      setNotice("No se pudo leer el almacenamiento del navegador. Las rutinas no se guardarán.")
    }

    const result = parseRoutines(raw)
    if (result.corrupt && raw !== null) {
      try {
        window.localStorage.setItem(`${STORAGE_KEY}:corrupt`, raw)
      } catch {
        // sin espacio o sin permiso: no hay nada más que hacer
      }
      setNotice("Los datos guardados estaban dañados y se reiniciaron.")
    } else if (result.dropped > 0) {
      setNotice(`Se omitieron ${result.dropped} elemento(s) dañado(s) al cargar tus rutinas.`)
    }

    setRoutines(result.routines)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeRoutines(routines))
      setSaveFailed(false)
    } catch {
      setSaveFailed(true) // modo privado o almacenamiento lleno
    }
  }, [routines, loaded])

  const addRoutine = useCallback((routine: SavedRoutine) => {
    setRoutines((prev) => [routine, ...prev])
  }, [])

  const updateRoutine = useCallback((routine: SavedRoutine) => {
    setRoutines((prev) => prev.map((r) => (r.id === routine.id ? routine : r)))
  }, [])

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id))
  }, [])

  /** Sustituye todas las rutinas (restaurar una copia de seguridad). */
  const replaceAll = useCallback((list: SavedRoutine[]) => setRoutines(list), [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return { routines, loaded, notice, saveFailed, addRoutine, updateRoutine, deleteRoutine, replaceAll, dismissNotice }
}
