/**
 * Higiene del proyecto (Ronda 5). Cada regla corresponde a un problema real que tuvo la app:
 *  - dependencias y componentes que nadie usaba (~60 archivos de shadcn/ui, ~30 paquetes),
 *  - clases de CSS usadas pero nunca definidas (no hacían nada),
 *  - zoom bloqueado, `ignoreBuildErrors`, `min-h-screen` (se corta bajo la barra del navegador móvil),
 *  - lockfile desincronizado con package.json (rompió el despliegue en Vercel).
 * Uso: pnpm test:hygiene
 */
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

const ROOT = process.cwd()
if (!existsSync(join(ROOT, "app")) || !existsSync(join(ROOT, "package.json"))) throw new Error(`Ejecuta esto desde la raíz del proyecto (cwd actual: ${ROOT})`)

let passed = 0
function test(name: string, fn: () => void) { try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e } }
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")

function walk(dir: string, exts: RegExp): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name)
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel, exts) : exts.test(name) ? [rel] : []
  })
}

const SRC_DIRS = ["app", "components", "hooks", "lib"]
const srcFiles = SRC_DIRS.flatMap((d) => walk(d, /\.(ts|tsx)$/))
const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
const deps = pkg.dependencies ?? {}
const devDeps = pkg.devDependencies ?? {}

/* ------------------------------ Lockfile ------------------------------ */

/** Lee los specifiers del importador raíz de pnpm-lock.yaml (sin dependencias externas). */
export function lockfileSpecifiers(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = text.split("\n")
  let inRoot = false
  let section = false
  let current: string | null = null
  for (const line of lines) {
    if (/^importers:/.test(line)) { inRoot = false; continue }
    if (/^ {2}\.:\s*$/.test(line)) { inRoot = true; continue }
    if (/^ {2}\S/.test(line) && !/^ {2}\.:/.test(line)) inRoot = false
    if (/^\S/.test(line) && !/^importers:/.test(line)) inRoot = false
    if (!inRoot) continue
    if (/^ {4}(dependencies|devDependencies|optionalDependencies):/.test(line)) { section = true; continue }
    const name = line.match(/^ {6}'?([^':]+)'?:\s*$/)
    if (section && name) { current = name[1]; continue }
    const spec = line.match(/^ {8}specifier: (.+)$/)
    if (section && current && spec) out[current] = spec[1].replace(/^'|'$/g, "")
  }
  return out
}

test("pnpm-lock.yaml existe (si falta: ejecuta `pnpm install` y súbelo)", () => {
  assert.ok(existsSync(join(ROOT, "pnpm-lock.yaml")), "No hay pnpm-lock.yaml. Ejecuta `pnpm install` y haz commit del archivo generado.")
})

test("El lockfile coincide con package.json (Vercel instala con --frozen-lockfile y falla si no)", () => {
  if (!existsSync(join(ROOT, "pnpm-lock.yaml"))) throw new Error("No hay pnpm-lock.yaml")
  const locked = lockfileSpecifiers(read("pnpm-lock.yaml"))
  const wanted = { ...deps, ...devDeps }
  const problems: string[] = []
  for (const [name, spec] of Object.entries(wanted)) {
    if (!(name in locked)) problems.push(`falta en el lockfile: ${name}@${spec}`)
    else if (locked[name] !== spec) problems.push(`versión distinta: ${name} (package.json ${spec} / lockfile ${locked[name]})`)
  }
  for (const name of Object.keys(locked)) if (!(name in wanted)) problems.push(`sobra en el lockfile: ${name}`)
  assert.deepEqual(problems, [], `Ejecuta \`pnpm install\` y sube pnpm-lock.yaml:\n  ${problems.join("\n  ")}`)
})

/* ------------------------- Configuración de compilación ------------------------- */

test("next.config no oculta errores de tipos (sin ignoreBuildErrors)", () => {
  assert.ok(!/ignoreBuildErrors/.test(read("next.config.mjs")))
})
test("El viewport no bloquea el zoom (accesibilidad)", () => {
  const layout = read("app/layout.tsx")
  assert.ok(!/userScalable\s*:\s*false/.test(layout), "userScalable: false")
  assert.ok(!/maximumScale/.test(layout), "maximumScale limita el zoom")
})
test("Existe configuración de eslint y el script lint la usa", () => {
  assert.ok(existsSync(join(ROOT, "eslint.config.mjs")))
  assert.ok(devDeps.eslint && devDeps["eslint-config-next"], "eslint / eslint-config-next no están en devDependencies")
})

/* ------------------------------- CSS ------------------------------- */

const css = read("app/globals.css")
const tsxFiles = srcFiles.filter((f) => f.endsWith(".tsx"))

test("Ninguna pantalla usa min-h-screen / h-screen (usar dvh: 100vh se corta bajo la barra del navegador móvil)", () => {
  const hits = tsxFiles.filter((f) => /\b(min-h|max-h|h)-screen\b/.test(read(f)))
  assert.deepEqual(hits, [])
})
test("Toda utilidad propia usada en el código está definida con @utility", () => {
  const CUSTOM = ["scrollbar-hide", "pb-safe", "pb-nav", "bottom-nav", "pt-top", "pb-fab", "right-shell"]
  for (const name of CUSTOM) {
    const used = tsxFiles.some((f) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(read(f)))
    if (used) assert.ok(new RegExp(`@utility\\s+${name}\\b`).test(css), `"${name}" se usa pero no está definida en globals.css`)
  }
})
test("Todo @utility definido se usa (sin CSS muerto)", () => {
  for (const m of css.matchAll(/@utility\s+([\w-]+)/g)) {
    const name = m[1]
    assert.ok(tsxFiles.some((f) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(read(f))), `@utility ${name} no se usa`)
  }
})
test("Los prefijos responsivos usados existen (sm/md/lg/xl/2xl o un --breakpoint-* definido)", () => {
  const known = new Set(["sm", "md", "lg", "xl", "2xl"])
  for (const m of css.matchAll(/--breakpoint-([\w]+)\s*:/g)) known.add(m[1])
  const bad: string[] = []
  for (const f of tsxFiles) {
    for (const m of read(f).matchAll(/(?<![\w:-])(xs|3xl|4xl|5xl|tablet|phone|mobile)\s*:[a-z\[]/g)) if (!known.has(m[1])) bad.push(`${f}: ${m[1]}:`)
  }
  assert.deepEqual(bad, [])
})

/* ------------------- Layout multipantalla (Ronda 7: auditoría) ------------------- */
/* Sin navegador no se puede medir el render, pero sí impedir por código los defectos que se encontraron. */

const zOf = (line: string): number | null => {
  const m = line.match(/(?<![\w-])z-(?:\[(\d+)\]|(\d+))/)
  return m ? Number(m[1] ?? m[2]) : null
}
/** Líneas de `file` que cumplen `pick` y su z-index (null si no tiene). */
const zLines = (file: string, pick: RegExp) => read(file).split("\n").filter((l) => pick.test(l)).map((l) => ({ line: l.trim().slice(0, 80), z: zOf(l) }))

test("Capas: todo lo que cubre la pantalla (creador, modales, aviso, menú) queda POR ENCIMA de la barra inferior", () => {
  const navZ = zLines("components/bottom-navigation.tsx", /fixed bottom-0/)[0]?.z
  assert.ok(navZ !== null && navZ !== undefined, "la barra inferior debe declarar su z-index")
  const overlays: [string, RegExp][] = [
    ["components/routine-timeline-builder.tsx", /fixed inset-0/],
    ["components/settings-modal.tsx", /fixed inset-0/],
    ["components/video-demo-modal.tsx", /fixed inset-0/],
    ["components/routines-screen.tsx", /fixed inset-0/],
    ["app/page.tsx", /sticky top-/],
  ]
  for (const [file, pick] of overlays) {
    const found = zLines(file, pick)
    assert.ok(found.length > 0, `${file}: no se encontró la capa`)
    for (const f of found) assert.ok(f.z !== null && f.z > navZ, `${file}: z=${f.z} debe ser > ${navZ} (barra inferior): ${f.line}`)
  }
})
test("Capas: el botón flotante queda POR DEBAJO de cualquier modal o creador", () => {
  const fab = zLines("components/routines-screen.tsx", /fixed bottom-nav/)[0]
  assert.ok(fab && fab.z !== null, "el botón flotante debe declarar z-index")
  const minOverlay = Math.min(...zLines("components/routine-timeline-builder.tsx", /fixed inset-0/).map((f) => f.z ?? 0), ...zLines("components/settings-modal.tsx", /fixed inset-0/).map((f) => f.z ?? 0))
  assert.ok(fab.z! < minOverlay, `botón flotante z=${fab.z} vs modales z=${minOverlay}`)
})
test("El botón flotante se oculta con la lista vacía (ya hay un 'Crear Rutina' en pantalla y se pisarían)", () => {
  assert.match(read("components/routines-screen.tsx"), /!\(activeTab === "routines" && routines\.length === 0\)/)
})
test("Editor de rutinas: los controles bajan de línea en vez de recortarse en pantallas de 320-390 px", () => {
  const b = read("components/routine-timeline-builder.tsx")
  assert.match(b, /flex flex-wrap items-center gap-x-3 gap-y-4/, "fila Series/Reps sin flex-wrap")
  assert.equal((b.match(/flex-1 min-w-\[8\.5rem\]/g) ?? []).length, 2, "cada columna necesita un ancho mínimo para poder bajar de línea")
  assert.match(b, /flex flex-wrap items-center gap-x-3 gap-y-2 p-4/, "cabecera del ejercicio sin flex-wrap (el nombre queda ilegible)")
  assert.match(b, /min-w-\[7rem\]/, "el nombre del ejercicio necesita un ancho mínimo")
})
/** Etiquetas de apertura <button ...> completas (el `>` de una flecha `=>` dentro de llaves no las cierra). */
function buttonTags(src: string): string[] {
  const out: string[] = []
  let i = 0
  while ((i = src.indexOf("<button", i)) !== -1) {
    let depth = 0
    let quote: string | null = null
    let j = i + 7
    for (; j < src.length; j++) {
      const c = src[j]
      if (quote) { if (c === quote && src[j - 1] !== "\\") quote = null; continue }
      if (c === '"' || c === "'" || c === "`") quote = c
      else if (c === "{") depth++
      else if (c === "}") depth--
      else if (c === ">" && depth === 0) break
    }
    out.push(src.slice(i, j + 1))
    i = j + 1
  }
  return out
}

test("Ningún botón mide menos de 40 px (zona táctil); los interruptores (role=switch) están exentos", () => {
  const tooSmall = /(?<![\w-])[wh]-[1-9](?![\d./\w-])/
  const hits: string[] = []
  for (const f of tsxFiles) for (const tag of buttonTags(read(f))) {
    if (/role="switch"/.test(tag)) continue
    if (tooSmall.test(tag)) hits.push(`${f}: ${tag.replace(/\s+/g, " ").slice(0, 110)}`)
  }
  assert.deepEqual(hits, [])
})
test("El lector de botones funciona (encuentra los botones y respeta las flechas => dentro de onClick)", () => {
  const tags = buttonTags('<button onClick={() => set(1)} className="w-5 h-5">x</button><button className="a">y</button>')
  assert.equal(tags.length, 2)
  assert.match(tags[0], /w-5 h-5/)
})
test("Tarjeta de series: cada bloque peso/reps tiene ancho mínimo >= su contenido (40+6+64+6+40 = 156 px) para bajar de línea sin salirse", () => {
  const card = read("components/set-log-card.tsx")
  const m = card.match(/flex-1 min-w-\[([\d.]+)rem\]/)
  assert.ok(m, "el Stepper necesita min-w")
  assert.ok(Number(m![1]) * 16 >= 156, `min-w ${m![1]}rem = ${Number(m![1]) * 16}px < 156px`)
  assert.match(card, /flex flex-wrap gap-x-3 gap-y-3/, "los bloques deben poder bajar de línea")
})
test("Los modales caben en pantallas bajas (móvil en horizontal): hacen scroll en vez de cortarse", () => {
  const sound = read("components/settings-modal.tsx")
  assert.match(sound, /max-h-\[90dvh\][^"]*overflow-y-auto/)
  const video = read("components/video-demo-modal.tsx")
  assert.match(video, /fixed inset-0[^"]*overflow-y-auto/)
  assert.match(video, /100dvh/, "el video debe limitar su ancho según la altura disponible")
})
test("El número del reloj nunca se sale de la pantalla (tamaño según ancho y alto disponibles)", () => {
  const t = read("components/workout-timer.tsx")
  assert.ok(!/text-\[120px\]/.test(t), "tamaño fijo de 120px")
  assert.match(t, /timeFontSize/)
  assert.match(t, /100vw/)
  assert.match(t, /\bdvh\b/, "el número debe limitarse también por la altura de la pantalla")
})
test("Sin márgenes negativos en los componentes (montan un bloque sobre otro en pantallas pequeñas)", () => {
  const hits = tsxFiles.filter((f) => /(?<![\w-])-m[trblxy]?-\d/.test(read(f)))
  assert.deepEqual(hits, [])
})
test("Los bloques con posición fija respetan el ancho de la app en pantallas anchas (right-shell)", () => {
  assert.match(read("components/routines-screen.tsx"), /right-shell/)
  assert.match(read("app/page.tsx"), /max-w-lg/)
})

/* --------------------- Dependencias y módulos sin uso --------------------- */

/** Nombre de paquete de un import ("@radix-ui/react-x/sub" -> "@radix-ui/react-x"). */
function pkgName(spec: string): string {
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

const configFiles = ["next.config.mjs", "postcss.config.mjs", "eslint.config.mjs"].filter((f) => existsSync(join(ROOT, f)))
const importSpecs = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1])

test("Toda dependencia de package.json se usa", () => {
  const used = new Set<string>()
  for (const f of [...srcFiles, ...configFiles]) for (const s of importSpecs(read(f))) if (!s.startsWith(".") && !s.startsWith("@/") && !s.startsWith("node:")) used.add(pkgName(s))
  for (const m of css.matchAll(/@import\s+["']([^"']+)["']/g)) used.add(pkgName(m[1]))
  for (const m of read("postcss.config.mjs").matchAll(/["']([@\w/-]+)["']\s*:/g)) used.add(pkgName(m[1]))

  // Herramientas que no se importan pero que el proyecto necesita (motivo obligatorio).
  const TOOLING: Record<string, string> = {
    typescript: "compilador (tsc / next build)",
    tsx: "ejecuta los scripts de prueba",
    eslint: "pnpm lint",
    "@types/node": "tipos de Node",
    "@types/react": "tipos de React",
    "@types/react-dom": "tipos de React DOM",
    "react-dom": "lo carga Next.js",
    next: "framework",
  }
  const unused = Object.keys({ ...deps, ...devDeps }).filter((n) => !used.has(n) && !(n in TOOLING))
  assert.deepEqual(unused, [], `Dependencias sin usar: ${unused.join(", ")}`)
})

test("Todo módulo de components/, hooks/ y lib/ lo importa alguien (sin código muerto)", () => {
  const exists = (p: string) => ["", ".ts", ".tsx", "/index.ts", "/index.tsx"].map((e) => p + e).find((c) => existsSync(join(ROOT, c)) && statSync(join(ROOT, c)).isFile())
  const imported = new Set<string>()
  for (const f of srcFiles) {
    for (const spec of importSpecs(read(f))) {
      let base: string | null = null
      if (spec.startsWith("@/")) base = spec.slice(2)
      else if (spec.startsWith(".")) base = relative(ROOT, resolve(dirname(join(ROOT, f)), spec))
      const target = base && exists(base)
      if (target) imported.add(target.replace(/\\/g, "/"))
    }
  }
  const orphans = srcFiles.filter((f) => !f.startsWith("app/") && !imported.has(f.replace(/\\/g, "/")))
  assert.deepEqual(orphans, [], `Módulos que nadie importa: ${orphans.join(", ")}`)
})

test("No queda la librería shadcn/ui ni duplicados de estilos", () => {
  assert.ok(!existsSync(join(ROOT, "components", "ui")), "components/ui")
  assert.ok(!existsSync(join(ROOT, "styles")), "styles/ (duplicaba app/globals.css)")
})

console.log(`${passed} pruebas OK`)
