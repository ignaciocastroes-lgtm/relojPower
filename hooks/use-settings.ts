"use client"

import { useCallback, useEffect, useState } from "react"
import { configureBeeper } from "@/lib/beeper"
import { DEFAULT_SETTINGS, SETTINGS_KEY, normalizeSettings, parseSettings, serializeSettings, type AppSettings } from "@/lib/settings"

/**
 * Ajustes en localStorage. Se leen tras montar (sin romper la hidratación) y no se escribe
 * nada hasta haber leído. Si guardar falla el ajuste sigue valiendo durante la sesión.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(SETTINGS_KEY)
    } catch {
      // sin acceso al almacenamiento: se usan los valores por defecto
    }
    setSettings(parseSettings(raw))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    configureBeeper(settings)
    try {
      window.localStorage.setItem(SETTINGS_KEY, serializeSettings(settings))
    } catch {
      // modo privado / lleno: el ajuste rige en esta sesión aunque no persista
    }
  }, [settings, loaded])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => normalizeSettings({ ...prev, ...patch }))
  }, [])

  return { settings, updateSettings }
}
