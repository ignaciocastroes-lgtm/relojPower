/**
 * Service worker y manifiesto (app instalable y sin conexión).
 * Ejecuta el propio public/sw.js dentro de un entorno simulado (caché, red y eventos), sin navegador.
 * Uso: pnpm test:pwa
 */
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"
import manifest from "../app/manifest.ts"

const ROOT = process.cwd()
if (!existsSync(join(ROOT, "public", "sw.js"))) throw new Error(`Ejecuta esto desde la raíz del proyecto (cwd actual: ${ROOT})`)
const SW_SOURCE = readFileSync(join(ROOT, "public", "sw.js"), "utf-8")
const ORIGIN = "https://app.test"

let passed = 0
const queue: { name: string; fn: () => Promise<void> | void }[] = []
function test(name: string, fn: () => Promise<void> | void) { queue.push({ name, fn }) }
const abs = (u: string) => new URL(u, ORIGIN).href

type Net = (url: string, init?: RequestInit) => Response | Promise<Response>
interface Stored { status: number; headers: [string, string][]; body: string }

function loadSw(version: string, net: Net, existing?: Map<string, Map<string, Stored>>) {
  const listeners: Record<string, ((e: unknown) => void)[]> = {}
  const store = existing ?? new Map<string, Map<string, Stored>>()
  const calls: { url: string; init?: RequestInit }[] = []
  const keyOf = (r: unknown) => abs(typeof r === "string" ? r : (r as { url: string }).url)

  const openCache = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const m = store.get(name)!
    return {
      match: async (r: unknown) => { const s = m.get(keyOf(r)); return s ? new Response(s.body, { status: s.status, headers: s.headers }) : undefined },
      put: async (r: unknown, res: Response) => { m.set(keyOf(r), { status: res.status, headers: [...res.headers.entries()], body: await res.clone().text() }) },
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: unknown) => m.delete(keyOf(r)),
    }
  }
  const fakeFetch = async (input: string | { url: string }, init?: RequestInit) => {
    const url = abs(typeof input === "string" ? input : input.url)
    calls.push({ url, init })
    return net(url, init)
  }
  const self = {
    location: { href: `${ORIGIN}/sw.js?v=${version}`, origin: ORIGIN },
    addEventListener: (t: string, fn: (e: unknown) => void) => { (listeners[t] ??= []).push(fn) },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  }
  const ctx = vm.createContext({
    self, URL, Response, Promise, Error, Set, Array, Map, console,
    caches: { open: openCache, keys: async () => [...store.keys()], delete: async (n: string) => store.delete(n) },
    fetch: fakeFetch,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 15)), // acelera el tiempo de espera de la navegación
    clearTimeout,
  })
  vm.runInContext(SW_SOURCE, ctx)

  async function fire(type: string, ev: Record<string, unknown> = {}) {
    const waits: Promise<unknown>[] = []
    let responded: Promise<Response> | undefined
    const event = { ...ev, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => { responded = p } }
    for (const l of listeners[type] ?? []) l(event)
    await Promise.all(waits)
    return { intercepted: responded !== undefined, response: responded ? await responded : undefined }
  }
  const get = (url: string, extra: Record<string, unknown> = {}) => fire("fetch", { request: { url: abs(url), method: "GET", mode: "no-cors", destination: "", ...extra } })
  const cacheKeys = (name: string) => [...(store.get(name)?.keys() ?? [])]
  return { fire, get, store, calls, cacheKeys }
}

const HTML = `<html><head><link rel="stylesheet" href="/_next/static/css/app.css"><link rel="preload" as="font" href="/_next/static/media/inter.woff2"></head><body><script src="/_next/static/chunks/main.js"></script><script>self.__f=["/_next/static/chunks/page.js"]</script></body></html>`
const ok = (body = "ok", type = "text/plain") => new Response(body, { status: 200, headers: { "Content-Type": type } })
const online: Net = (url) => {
  const p = new URL(url)
  if (p.origin !== ORIGIN) return ok("img", "image/jpeg")
  if (p.pathname === "/") return ok(HTML, "text/html")
  return ok(`contenido de ${p.pathname}`)
}
const offline: Net = () => { throw new TypeError("Failed to fetch") }

/* -------------------------------- Instalación -------------------------------- */

test("Instalar guarda la página, el manifiesto, los iconos y los archivos que la página lista (JS, CSS, fuentes)", async () => {
  const sw = loadSw("v1", online)
  await sw.fire("install")
  const keys = sw.cacheKeys("powerlock-shell-v1")
  for (const p of ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/_next/static/css/app.css", "/_next/static/media/inter.woff2", "/_next/static/chunks/main.js", "/_next/static/chunks/page.js"]) {
    assert.ok(keys.includes(abs(p)), `falta en la caché: ${p}`)
  }
})
test("La caché lleva la versión del despliegue (?v=) y la instalación sin red no falla", async () => {
  const sw = loadSw("abc123", offline)
  await sw.fire("install") // no debe lanzar
  assert.deepEqual([...sw.store.keys()], ["powerlock-shell-abc123"])
})
test("No se guardan respuestas de error (404/500) en la instalación", async () => {
  const sw = loadSw("v1", (url) => (new URL(url).pathname === "/" ? ok(HTML, "text/html") : new Response("no", { status: 404 })))
  await sw.fire("install")
  assert.deepEqual(sw.cacheKeys("powerlock-shell-v1"), [abs("/")])
})
test("Activar borra las cachés de versiones anteriores, pero conserva la de fotos", async () => {
  const store = new Map<string, Map<string, Stored>>([["powerlock-shell-old", new Map()], ["powerlock-shell-v2", new Map()], ["powerlock-img-v1", new Map()], ["ajena", new Map()]])
  const sw = loadSw("v2", online, store)
  await sw.fire("activate")
  assert.deepEqual([...store.keys()].sort(), ["ajena", "powerlock-img-v1", "powerlock-shell-v2"])
})

/* -------------------------------- Navegación -------------------------------- */

test("Con red: sirve la página y actualiza la copia guardada", async () => {
  const sw = loadSw("v1", online)
  const r = await sw.get("/", { mode: "navigate" })
  assert.ok(r.intercepted)
  assert.equal(await r.response!.text(), HTML)
  assert.ok(sw.cacheKeys("powerlock-shell-v1").includes(abs("/")))
})
test("SIN red: abre la última copia de la página (la app arranca offline)", async () => {
  const sw = loadSw("v1", online)
  await sw.fire("install")
  const store = sw.store
  const off = loadSw("v1", offline, store)
  const r = await off.get("/", { mode: "navigate" })
  assert.equal(r.response!.status, 200)
  assert.equal(await r.response!.text(), HTML)
})
test("SIN red y sin copia: mensaje claro (503), no una pantalla en blanco", async () => {
  const sw = loadSw("v1", offline)
  const r = await sw.get("/", { mode: "navigate" })
  assert.equal(r.response!.status, 503)
  assert.match(await r.response!.text(), /Sin conexión/)
})
test("Red muy lenta: pasado el tiempo de espera usa la copia guardada", async () => {
  const seed = loadSw("v1", online)
  await seed.fire("install")
  const slow = loadSw("v1", () => new Promise<Response>(() => {}), seed.store) // nunca responde
  const r = await slow.get("/", { mode: "navigate" })
  assert.equal(await r.response!.text(), HTML)
})
test("Una respuesta de error del servidor no sobrescribe la copia buena", async () => {
  const seed = loadSw("v1", online)
  await seed.fire("install")
  const broken = loadSw("v1", () => new Response("error", { status: 500 }), seed.store)
  await broken.get("/", { mode: "navigate" })
  const later = loadSw("v1", offline, seed.store)
  assert.equal(await (await later.get("/", { mode: "navigate" })).response!.text(), HTML)
})

/* ----------------------------- Archivos estáticos ----------------------------- */

test("/_next/static: la 2.ª vez sale de la caché sin tocar la red", async () => {
  const sw = loadSw("v1", online)
  await sw.get("/_next/static/chunks/a.js")
  const before = sw.calls.length
  const r = await sw.get("/_next/static/chunks/a.js")
  assert.equal(sw.calls.length, before, "no debe volver a pedirlo")
  assert.match(await r.response!.text(), /a\.js/)
})
test("Iconos y otros archivos propios: sirven lo guardado y se actualizan en segundo plano", async () => {
  const sw = loadSw("v1", online)
  await sw.get("/icons/icon-192.png")
  const r = await sw.get("/icons/icon-192.png")
  assert.ok(r.intercepted)
  assert.equal(r.response!.status, 200)
})
test("Sin red y sin caché en un archivo propio: falla limpio (no se cuelga)", async () => {
  const sw = loadSw("v1", offline)
  const r = await sw.get("/icons/nada.png")
  assert.equal(r.response!.type, "error")
})

/* ------------------------------- Lo que NO se toca ------------------------------- */

test("No intercepta: POST, el propio sw.js, analítica, /api, YouTube, esquemas raros", async () => {
  const sw = loadSw("v1", online)
  assert.equal((await sw.fire("fetch", { request: { url: abs("/x"), method: "POST", mode: "cors", destination: "" } })).intercepted, false)
  for (const u of ["/sw.js", "/_vercel/insights/script.js", "/api/algo", "https://www.youtube.com/embed/abc", "chrome-extension://x/y.js", "https://api.terceros.com/data.json"]) {
    assert.equal((await sw.get(u)).intercepted, false, u)
  }
})

/* --------------------------------- Fotos de terceros --------------------------------- */

test("Foto de terceros con CORS: se guarda y la 2.ª vez sale de la caché", async () => {
  const sw = loadSw("v1", online)
  const url = "https://images.unsplash.com/photo-1?w=400"
  const r1 = await sw.get(url, { destination: "image" })
  assert.equal(await r1.response!.text(), "img")
  assert.equal(sw.calls.at(-1)!.init?.mode, "cors", "debe pedirla en modo CORS (nunca opaca)")
  const calls = sw.calls.length
  await sw.get(url, { destination: "image" })
  assert.equal(sw.calls.length, calls)
  assert.ok(sw.cacheKeys("powerlock-img-v1").includes(url))
})
test("Foto sin CORS: pasa directa, NO se guarda (evita respuestas opacas)", async () => {
  const net: Net = (url, init) => { if (init?.mode === "cors") throw new TypeError("CORS"); return ok("img-no-cors", "image/jpeg") }
  const sw = loadSw("v1", net)
  const url = "https://img.youtube.com/vi/abc/0.jpg"
  const r = await sw.get(url, { destination: "image" })
  assert.equal(await r.response!.text(), "img-no-cors")
  assert.deepEqual(sw.cacheKeys("powerlock-img-v1"), [])
})
test("Las fotos guardadas se ven sin conexión", async () => {
  const seed = loadSw("v1", online)
  const url = "https://images.unsplash.com/photo-2?w=400"
  await seed.get(url, { destination: "image" })
  const off = loadSw("v1", offline, seed.store)
  assert.equal(await (await off.get(url, { destination: "image" })).response!.text(), "img")
})
test("Un recurso de terceros que no es imagen no se toca", async () => {
  assert.equal((await loadSw("v1", online).get("https://cdn.otro.com/lib.js", { destination: "script" })).intercepted, false)
})
test("Las fotos guardadas tienen tope (150): se descartan las más antiguas", async () => {
  const sw = loadSw("v1", online)
  for (let i = 0; i < 160; i++) await sw.get(`https://images.unsplash.com/photo-${i}`, { destination: "image" })
  const keys = sw.cacheKeys("powerlock-img-v1")
  assert.equal(keys.length, 150)
  assert.ok(!keys.includes("https://images.unsplash.com/photo-0"))
  assert.ok(keys.includes("https://images.unsplash.com/photo-159"))
})

/* ------------------------------ Mensaje de la página ------------------------------ */

test("La página puede pedir guardar sus archivos (fuentes, CSS): solo los estáticos propios y los iconos", async () => {
  const sw = loadSw("v1", online)
  await sw.fire("message", { data: { type: "CACHE_URLS", urls: ["/_next/static/media/x.woff2", "/icons/icon-192.png", "https://evil.com/_next/static/x.js", "/api/secreto", "/admin", 42, null, "//evil.com/_next/static/y.js"] } })
  assert.deepEqual(sw.cacheKeys("powerlock-shell-v1").sort(), [abs("/_next/static/media/x.woff2"), abs("/icons/icon-192.png")].sort())
})
test("Mensajes mal formados se ignoran sin fallar", async () => {
  const sw = loadSw("v1", online)
  for (const data of [undefined, null, "hola", { type: "OTRA" }, { type: "CACHE_URLS" }, { type: "CACHE_URLS", urls: "no-array" }]) await sw.fire("message", { data })
  assert.deepEqual([...sw.store.keys()].flatMap((k) => sw.cacheKeys(k)), [])
})

/* -------------------------------------- Manifiesto -------------------------------------- */

const pngSize = (file: string) => { const b = readFileSync(join(ROOT, "public", file)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sig: b.subarray(1, 4).toString() } }

test("Manifiesto: instalable (nombre, start_url, scope, display standalone, colores, idioma)", () => {
  const m = manifest()
  assert.equal(m.start_url, "/")
  assert.equal(m.scope, "/")
  assert.equal(m.display, "standalone")
  assert.ok(m.name && m.short_name && m.short_name.length <= 12, "short_name corto")
  assert.match(String(m.background_color), /^#[0-9a-f]{6}$/i)
  assert.match(String(m.theme_color), /^#[0-9a-f]{6}$/i)
  assert.equal(m.lang, "es")
})
test("Manifiesto: iconos 192 y 512 'any' + 512 'maskable'; los archivos existen y miden lo que declaran", () => {
  const icons = manifest().icons ?? []
  const has = (size: string, purpose: string) => icons.some((i) => i.sizes === size && i.purpose === purpose)
  assert.ok(has("192x192", "any") && has("512x512", "any") && has("512x512", "maskable"))
  for (const i of icons) {
    const file = i.src.replace(/^\//, "")
    assert.ok(existsSync(join(ROOT, "public", file)), `falta ${i.src}`)
    const { w, h, sig } = pngSize(file)
    assert.equal(sig, "PNG")
    assert.equal(`${w}x${h}`, i.sizes, `${i.src} declara ${i.sizes} pero mide ${w}x${h}`)
  }
})
test("El color del tema del manifiesto coincide con el del layout", () => {
  const layout = readFileSync(join(ROOT, "app", "layout.tsx"), "utf-8")
  assert.match(layout, new RegExp(`themeColor: '${String(manifest().theme_color)}'`, "i"))
})
test("El icono de Apple existe y mide 180x180", () => {
  const { w, h } = pngSize("apple-icon.png")
  assert.deepEqual([w, h], [180, 180])
})

const TEST_TIMEOUT_MS = 4000
async function main() {
  // Si una prueba se cuelga (una promesa que nunca se resuelve) el proceso terminaría en silencio con código 0:
  // por eso cada prueba tiene límite de tiempo y, al salir, se comprueba que se ejecutaron todas.
  process.on("exit", (code) => {
    if (code === 0 && passed !== queue.length) { console.error(`FAIL  solo se completaron ${passed} de ${queue.length} pruebas`); process.exitCode = 1 }
  })
  for (const t of queue) {
    try {
      await Promise.race([
        Promise.resolve().then(() => t.fn()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`tiempo agotado (${TEST_TIMEOUT_MS} ms): la prueba no termina`)), TEST_TIMEOUT_MS)),
      ])
      passed++
      console.log(`  ok  ${t.name}`)
    } catch (e) { console.error(`FAIL  ${t.name}`); throw e }
  }
  console.log(`${passed} pruebas OK`)
}
main().catch((e) => { console.error(e); process.exit(1) })
