"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { installState, type InstallState } from "@/lib/install"

/** Evento no estándar que Chrome dispara cuando la app se puede instalar. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Estado real de instalación. El navegador solo ofrece instalar cuando quiere (`beforeinstallprompt`); si aún no
 * lo hizo, el estado es "manual" (se instala desde el menú de Chrome). Se guarda el evento para poder disparar
 * la instalación desde un botón nuestro.
 */
export function useInstallPrompt(): { state: InstallState; install: () => Promise<void> } {
  const eventRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [hasPrompt, setHasPrompt] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [secure, setSecure] = useState(true)

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)")
    const update = () => setStandalone(media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
    update()
    setSecure(window.isSecureContext)

    const onBefore = (e: Event) => {
      e.preventDefault() // lo guardamos para ofrecerlo desde Ajustes en vez de que salga solo
      eventRef.current = e as BeforeInstallPromptEvent
      setHasPrompt(true)
    }
    const onInstalled = () => {
      eventRef.current = null
      setHasPrompt(false)
      setStandalone(true)
    }
    window.addEventListener("beforeinstallprompt", onBefore)
    window.addEventListener("appinstalled", onInstalled)
    media.addEventListener("change", update)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore)
      window.removeEventListener("appinstalled", onInstalled)
      media.removeEventListener("change", update)
    }
  }, [])

  const install = useCallback(async () => {
    const event = eventRef.current
    if (!event) return
    await event.prompt()
    await event.userChoice
    eventRef.current = null
    setHasPrompt(false)
  }, [])

  return { state: installState({ standalone, hasPrompt, secure }), install }
}
