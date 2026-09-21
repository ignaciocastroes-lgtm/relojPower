"use client"

import { useCallback, useEffect, useState } from "react"
import { SETS_KEY, addSet as addToList, normalizeSets, parseSets, removeSessionSets, removeSet as removeFromList, serializeSets, type SetLog } from "@/lib/set-log"

/**
 * Series registradas (peso y repeticiones) en localStorage. Mismas garantías que useSessions:
 * se lee tras montar (sin romper la hidratación), no se escribe nada antes de leer, y lo dañado se
 * respalda antes de sobrescribirse. Cada serie se guarda en cuanto el usuario la confirma.
 */
export function useSetLogs() {
  const [sets, setSets] = useState<SetLog[]>([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(SETS_KEY)
    } catch {
      setNotice("No se pudo leer el almacenamiento del navegador. Las series no se guardarán.")
    }
    const result = parseSets(raw)
    if (result.corrupt && raw !== null) {
      try {
        window.localStorage.setItem(`${SETS_KEY}:corrupt`, raw)
      } catch {
        // sin espacio: nada más que hacer
      }
      setNotice("Las series guardadas estaban dañadas y se reiniciaron.")
    } else if (result.dropped > 0) {
      setNotice(`Se omitieron ${result.dropped} serie(s) dañada(s) al cargar.`)
    }
    setSets(result.sets)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(SETS_KEY, serializeSets(sets))
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [sets, loaded])

  const addSet = useCallback((set: SetLog) => setSets((prev) => addToList(prev, set)), [])
  const removeSet = useCallback((id: string) => setSets((prev) => removeFromList(prev, id)), [])
  const removeForSession = useCallback((sessionId: string) => setSets((prev) => removeSessionSets(prev, sessionId)), [])
  const replaceAll = useCallback((list: SetLog[]) => setSets(normalizeSets(list)), [])
  const dismissNotice = useCallback(() => setNotice(null), [])

  return { sets, loaded, notice, saveFailed, addSet, removeSet, removeForSession, replaceAll, dismissNotice }
}
