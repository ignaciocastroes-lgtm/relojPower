/**
 * Guarda anti-simulación: la app no debe fingir datos, conexiones ni funciones.
 * Escanea el código fuente en busca de los patrones que delataron lo simulado en la
 * auditoría original. Si una ronda futura los reintroduce, `pnpm test` falla.
 *
 * Excepciones legítimas se declaran en ALLOW con el motivo.
 */
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd() // los scripts de pnpm siempre corren desde la raíz del proyecto
if (!existsSync(join(ROOT, "app")) || !existsSync(join(ROOT, "lib"))) throw new Error(`Ejecuta esto desde la raíz del proyecto (cwd actual: ${ROOT})`)
const SCAN_DIRS = ["app", "components", "lib", "hooks"]
const SKIP_DIRS = new Set<string>() // ya no hay librería de UI genérica: se escanea todo

function walk(dir: string): string[] {
  if (SKIP_DIRS.has(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

const BANNED: { name: string; re: RegExp; why: string }[] = [
  { name: "proveedores de audio falsos", re: /mubert|fal\.ai|cassette/i, why: "servicios que nunca se llamaron de verdad" },
  { name: "motor Tone.js / CDN", re: /tone\.js|cdnjs|Tone\.Transport/i, why: "popup externo que cargaba un script de un CDN" },
  { name: "ventana emergente / mensajería entre ventanas", re: /window\.open\(|postMessage\(/, why: "puente con ventana externa" },
  { name: "API keys en el cliente", re: /api[ _-]?key/i, why: "las claves secretas nunca deben ir en el navegador" },
  { name: "IA / biométrico de mentira", re: /BiometricBeats|Beats Biom|generando ritmo|\(IA\)/i, why: "no había IA ni sensores" },
  { name: "datos aleatorios como si fueran reales", re: /Math\.random\(\)/, why: "las cifras mostradas deben venir de datos reales" },
  { name: "esperas artificiales", re: /setTimeout\(\s*(?:resolve|\(\)\s*=>\s*resolve)/, why: "fingían que algo cargaba" },
  { name: "'cal/min' inventado", re: /cal\/min/, why: "fórmula sin sentido (más BPM daba menos calorías)" },
  { name: "conexión marcada como activa por defecto", re: /useState\(true\)\s*\/\/.*(connect|bluetooth)|isBluetoothConnected\s*\]\s*=\s*useState\(true\)/i, why: "'Conectado' fijo sin conexión real" },
]

/** archivo (relativo) -> patrones permitidos, con motivo */
const ALLOW: Record<string, { name: string; reason: string }[]> = {
  "lib/routine-storage.ts": [{ name: "datos aleatorios como si fueran reales", reason: "respaldo para generar IDs únicos si no existe crypto.randomUUID" }],
  "components/service-worker-register.tsx": [{ name: "ventana emergente / mensajería entre ventanas", reason: "postMessage al service worker propio (lista de archivos a guardar para el modo sin conexión)" }],
}

const BANNED_FILES = [
  "components/heart-rate-monitor.tsx",
  "components/biometric-beats.tsx",
  "components/audio-settings-modal.tsx",
  "lib/exercises-data.ts",
  "components/routine-creator.tsx",
  "components/exercise-picker.tsx",
]

let passed = 0
function test(name: string, fn: () => void) { try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e } }

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
console.log(`Escaneando ${files.length} archivos de código`)

for (const rule of BANNED) {
  test(`Sin ${rule.name}`, () => {
    const hits: string[] = []
    for (const f of files) {
      const rel = relative(ROOT, f).replaceAll("\\", "/")
      if (ALLOW[rel]?.some((a) => a.name === rule.name)) continue
      readFileSync(f, "utf-8").split("\n").forEach((line, i) => { if (rule.re.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`) })
    }
    assert.deepEqual(hits, [], `${rule.why}:\n  ${hits.join("\n  ")}`)
  })
}

test("Los componentes simulados ya no existen", () => {
  const still = BANNED_FILES.filter((f) => existsSync(join(ROOT, f)))
  assert.deepEqual(still, [])
})

test("Cada excepción declarada sigue siendo necesaria (no se acumulan permisos muertos)", () => {
  for (const [file, allowed] of Object.entries(ALLOW)) {
    const src = readFileSync(join(ROOT, file), "utf-8")
    for (const a of allowed) {
      const rule = BANNED.find((r) => r.name === a.name)!
      assert.ok(rule.re.test(src), `${file}: la excepción "${a.name}" ya no hace falta`)
    }
  }
})

test("La app no hace peticiones de red propias (todo es local, salvo videos de YouTube y fotos)", () => {
  const hits: string[] = []
  for (const f of files) {
    const rel = relative(ROOT, f).replaceAll("\\", "/")
    readFileSync(f, "utf-8").split("\n").forEach((line, i) => { if (/\bfetch\(|XMLHttpRequest|new WebSocket\(|navigator\.sendBeacon/.test(line)) hits.push(`${rel}:${i + 1}`) })
  }
  assert.deepEqual(hits, [])
})

/* ---- Series (v2): el peso y las repeticiones solo los pone el usuario ---- */

test("Las series solo se crean al confirmarlas: makeSet / onLogSet únicamente dentro de handleSaveSet", () => {
  const timer = readFileSync(join(ROOT, "components/workout-timer.tsx"), "utf-8")
  const start = timer.indexOf("const handleSaveSet")
  assert.ok(start > 0, "no se encontró handleSaveSet")
  // Cuerpo exacto de la función: desde la primera "{" tras "=>" hasta su llave de cierre (coincidencia de llaves).
  const open = timer.indexOf("=> {", start)
  assert.ok(open > 0)
  let depth = 0
  let end = -1
  for (let i = open + 3; i < timer.length; i++) {
    if (timer[i] === "{") depth++
    else if (timer[i] === "}" && --depth === 0) { end = i + 1; break }
  }
  assert.ok(end > open, "no se pudo delimitar handleSaveSet")
  const inside = timer.slice(start, end)
  assert.ok(/\bmakeSet\(/.test(inside) && /\bonLogSet\(/.test(inside), "handleSaveSet debe crear y guardar la serie")
  const outside = timer.slice(0, start) + timer.slice(end)
  assert.ok(!/\b(makeSet|onLogSet)\(/.test(outside), "una serie se crea o guarda fuera de la confirmación del usuario")
  const usedElsewhere = files.map((f) => relative(ROOT, f).replaceAll("\\", "/")).filter((f) => !["components/workout-timer.tsx", "lib/set-log.ts"].includes(f) && /\bmakeSet\b/.test(readFileSync(join(ROOT, f), "utf-8")))
  assert.deepEqual(usedElsewhere, [], "makeSet solo debe usarse al confirmar una serie")
})

test("La tarjeta de registro solo guarda al pulsar 'Guardar serie' (nunca al abrirse ni al cambiar de serie)", () => {
  const card = readFileSync(join(ROOT, "components/set-log-card.tsx"), "utf-8")
  assert.equal((card.match(/onSave\(/g) ?? []).length, 1, "onSave debe llamarse en un solo sitio")
  assert.ok(/onClick=\{\(\) => onSave\(/.test(card), "onSave debe colgar de un onClick")
  assert.ok(!/useEffect/.test(card), "la tarjeta no debe tener efectos que guarden solos")
})

/* ---- Pulso cardíaco (Ronda 6): solo puede venir de un sensor Bluetooth real ---- */

const BLE_FILE = "lib/heart-rate-ble.ts"
const rel = (f: string) => relative(ROOT, f).replaceAll("\\", "/")

test("Solo lib/heart-rate-ble.ts habla con el sensor (requestDevice / startNotifications)", () => {
  const offenders = files.filter((f) => rel(f) !== BLE_FILE && /requestDevice\(|startNotifications\(|navigator\.bluetooth/.test(readFileSync(f, "utf-8")))
  assert.deepEqual(offenders.map(rel), [], "el pulso solo puede originarse en la conexión Bluetooth")
})

test("Cada lectura pasa por el decodificador del estándar (parseHeartRateMeasurement)", () => {
  assert.ok(/parseHeartRateMeasurement\(/.test(readFileSync(join(ROOT, BLE_FILE), "utf-8")))
})

test("Ningún archivo fija un pulso a mano (bpm: 72, setBpm(80), ...)", () => {
  const hits: string[] = []
  for (const f of files) {
    if (rel(f).startsWith("lib/exercise-db")) continue
    readFileSync(f, "utf-8").split("\n").forEach((line, i) => {
      if (/\b(bpm|heartRate|pulse)\w*\s*[:=]\s*\d{2,3}\b|setBpm\(\s*\d/i.test(line)) hits.push(`${rel(f)}:${i + 1}  ${line.trim().slice(0, 80)}`)
    })
  }
  assert.deepEqual(hits, [])
})

console.log(`\n${passed} pruebas OK`)
