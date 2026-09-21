/* POWERLOCK — service worker (sin dependencias).
 *
 * Objetivo: que la app abra y funcione SIN conexión (gimnasio sin cobertura).
 *  - Página (navegación):   red primero (3,5 s) y, si falla, la última copia guardada de "/".
 *  - /_next/static/*:       caché primero (los archivos llevan hash: nunca cambian).
 *  - Resto del propio sitio: caché y actualización en segundo plano.
 *  - Fotos de terceros:     se guardan SOLO si el servidor permite CORS (evita respuestas "opacas", que
 *                           ocupan mucha cuota); si no, pasan directas y sin conexión se ve un icono.
 *  - Todo lo demás (videos de YouTube, analítica, POST): no se toca.
 * La versión llega en la URL de registro (?v=<commit>): cada despliegue tiene su caché y borra las viejas.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev"
const SHELL = "powerlock-shell-" + VERSION
const IMAGES = "powerlock-img-v1"
const MAX_IMAGES = 150
const NAV_TIMEOUT_MS = 3500
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/apple-icon.png", "/icon.svg"]

const ownOrigin = (url) => url.origin === self.location.origin
const isStatic = (url) => ownOrigin(url) && url.pathname.startsWith("/_next/static/")
const isCacheable = (res) => res && res.ok && (res.type === "basic" || res.type === "cors" || res.type === "default")

/** Archivos que el navegador puede pedir que guardemos (nada que no sea nuestro y estático). */
function allowedToCache(href) {
  let url
  try {
    url = new URL(href, self.location.href)
  } catch {
    return false
  }
  return isStatic(url) || (ownOrigin(url) && (url.pathname.startsWith("/icons/") || PRECACHE.includes(url.pathname)))
}

async function putSafe(cache, request, response) {
  try {
    if (isCacheable(response)) await cache.put(request, response)
  } catch {
    // cuota llena o respuesta no guardable: la app sigue funcionando sin caché
  }
}

async function trim(cache, max) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function precache() {
  const cache = await caches.open(SHELL)
  for (const path of PRECACHE) {
    try {
      const res = await fetch(path, { cache: "reload" })
      await putSafe(cache, path, res.clone())
      if (path === "/") {
        // La página lista los archivos que necesita: los guardamos también.
        const html = await res.text()
        const found = new Set(html.match(/\/_next\/static\/[^"'\s\\)<>]+/g) || [])
        for (const asset of found) {
          try {
            await putSafe(cache, asset, await fetch(asset))
          } catch {
            // se completará con las peticiones normales / el mensaje CACHE_URLS
          }
        }
      }
    } catch {
      // sin red durante la instalación: se reintentará en la siguiente actualización
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("powerlock-shell-") && name !== SHELL) await caches.delete(name)
      }
      await self.clients.claim()
    })()
  )
})

// La página nos manda la lista de lo que cargó (incluye fuentes y CSS) para poder abrir offline la 1.ª vez.
self.addEventListener("message", (event) => {
  const data = event.data
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      for (const href of data.urls.slice(0, 200)) {
        if (typeof href !== "string" || !allowedToCache(href)) continue
        if (await cache.match(href)) continue
        try {
          await putSafe(cache, href, await fetch(href))
        } catch {
          // sin red: se guardará en otra visita
        }
      }
    })()
  )
})

async function navigation(request) {
  const cache = await caches.open(SHELL)
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS)),
    ])
    if (res && res.ok) await putSafe(cache, "/", res.clone())
    return res
  } catch {
    const cached = await cache.match("/")
    return cached || new Response("Sin conexión y sin copia guardada. Abre la app una vez con internet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request.url)
  if (hit) return hit
  const res = await fetch(request)
  await putSafe(cache, request.url, res.clone())
  return res
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request.url)
  const network = fetch(request)
    .then(async (res) => {
      await putSafe(cache, request.url, res.clone())
      return res
    })
    .catch(() => null)
  return hit || (await network) || Response.error()
}

async function remoteImage(request) {
  const cache = await caches.open(IMAGES)
  const hit = await cache.match(request.url)
  if (hit) return hit
  try {
    const res = await fetch(request.url, { mode: "cors", credentials: "omit" })
    if (res.ok) {
      await putSafe(cache, request.url, res.clone())
      await trim(cache, MAX_IMAGES)
    }
    return res
  } catch {
    return fetch(request) // el servidor no permite CORS (o no hay red): pasa directo, sin guardar
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return

  if (ownOrigin(url)) {
    if (url.pathname === "/sw.js" || url.pathname.startsWith("/_vercel/") || url.pathname.startsWith("/api/")) return
    if (request.mode === "navigate") return event.respondWith(navigation(request))
    if (isStatic(url)) return event.respondWith(cacheFirst(request))
    return event.respondWith(staleWhileRevalidate(request))
  }
  if (request.destination === "image") return event.respondWith(remoteImage(request))
})
