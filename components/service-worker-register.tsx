"use client"

import { useEffect } from "react"

/**
 * Registra el service worker (solo en producción) para que la app abra sin conexión.
 * Tras activarse le envía la lista de archivos que la página ya cargó (JS, CSS, fuentes) para que la primera
 * apertura offline también funcione. Si el navegador no soporta service workers la app funciona igual, sin offline.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"

    const start = async () => {
      try {
        await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" })
        const ready = await navigator.serviceWorker.ready
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(window.location.origin))
        ready.active?.postMessage({ type: "CACHE_URLS", urls })
      } catch {
        // sin service worker todo sigue funcionando, solo que no sin conexión
      }
    }

    if (document.readyState === "complete") void start()
    else window.addEventListener("load", start, { once: true })
    return () => window.removeEventListener("load", start)
  }, [])

  return null
}
