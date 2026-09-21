/**
 * Copia de seguridad: exportar, restaurar (combinar / reemplazar), validación y rechazo de archivos ajenos.
 * Uso: pnpm test:backup
 */
import assert from "node:assert/strict"
import { BACKUP_FORMAT, MAX_BACKUP_BYTES, backupFileName, createBackup, countBackup, daysSinceBackup, mergeBackups, parseBackup, type BackupData } from "../lib/backup.ts"
import { installState } from "../lib/install.ts"
import { makeSet } from "../lib/set-log.ts"
import { DEFAULT_SETTINGS } from "../lib/settings.ts"
import type { SavedRoutine } from "../lib/types.ts"
import type { SessionRecord } from "../lib/session-log.ts"

let passed = 0
function test(name: string, fn: () => void) { try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e } }

const routine = (id: string, name = "Push"): SavedRoutine => ({
  id, name, description: "d", createdAt: new Date("2026-09-01T10:00:00Z"), estimatedDuration: 0,
  exercises: [{ id: `b-${id}`, exerciseId: "bench", exerciseName: "Press de Banca", sets: 3, reps: 8, restTime: 60, isTime: false, duration: 30 }],
})
const session = (id: string, extra: Partial<SessionRecord> = {}): SessionRecord => ({
  id, startedAt: "2026-09-20T10:00:00.000Z", endedAt: "2026-09-20T10:30:00.000Z", durationSeconds: 1800, kind: "routine", routineName: "Push", rounds: 9, completed: true, ...extra,
})
const setOf = (id: string, sessionId = "s1") => makeSet({ sessionId, exerciseId: "bench", exerciseName: "Press de Banca", setNumber: 1, weightKg: 60, reps: 8 }, new Date("2026-09-20T10:10:00Z"), id)!
const sample = (): BackupData => ({ routines: [routine("r1")], sessions: [session("s1", { avgBpm: 140, maxBpm: 170 })], sets: [setOf("t1"), setOf("t2")], settings: { volume: 40, vibration: false } })
const NOW = new Date(2026, 8, 21, 9, 30)

test("Exportar y volver a leer devuelve exactamente lo mismo (ida y vuelta)", () => {
  const original = sample()
  const parsed = parseBackup(createBackup(original, NOW))
  assert.ok(parsed.ok)
  if (!parsed.ok) return
  assert.equal(parsed.dropped, 0)
  assert.deepEqual(parsed.counts, { routines: 1, sessions: 1, sets: 2 })
  assert.equal(parsed.data.routines[0].name, "Push")
  assert.equal(parsed.data.routines[0].exercises[0].exerciseName, "Press de Banca")
  assert.equal(parsed.data.sessions[0].avgBpm, 140, "el pulso de la sesión sobrevive")
  assert.deepEqual(parsed.data.sets.map((s) => s.id).sort(), ["t1", "t2"])
  assert.deepEqual(parsed.data.settings, { volume: 40, vibration: false })
  assert.equal(parsed.exportedAt, NOW.toISOString())
})
test("El archivo lleva la marca de la app, la versión y el recuento", () => {
  const f = JSON.parse(createBackup(sample(), NOW))
  assert.equal(f.app, "powerlock")
  assert.equal(f.format, BACKUP_FORMAT)
  assert.deepEqual(f.counts, countBackup(sample()))
})
test("Una copia vacía es válida (0 elementos), con los ajustes por defecto si faltan", () => {
  const r = parseBackup(JSON.stringify({ app: "powerlock", format: 1, data: {} }))
  assert.ok(r.ok)
  if (r.ok) { assert.deepEqual(r.counts, { routines: 0, sessions: 0, sets: 0 }); assert.deepEqual(r.data.settings, DEFAULT_SETTINGS) }
})

console.log("Rechazo de archivos que no son una copia")
test("Texto que no es JSON, JSON de otra cosa, array, null y número se rechazan con mensaje claro", () => {
  for (const bad of ["hola", "", "{", "[]", "null", "42", JSON.stringify({ hello: 1 }), JSON.stringify({ app: "otra-app", format: 1, data: {} })]) {
    const r = parseBackup(bad)
    assert.equal(r.ok, false, bad)
    if (!r.ok) assert.ok(r.error.length > 10)
  }
})
test("Versión futura: se rechaza y pide actualizar; sin versión o versión inválida: se rechaza", () => {
  const future = parseBackup(JSON.stringify({ app: "powerlock", format: BACKUP_FORMAT + 1, data: {} }))
  assert.equal(future.ok, false)
  if (!future.ok) assert.match(future.error, /más nueva/)
  for (const f of [undefined, "1", 0, -1, 1.5]) assert.equal(parseBackup(JSON.stringify({ app: "powerlock", format: f, data: {} })).ok, false, String(f))
})
test("Sin bloque de datos se rechaza", () => {
  assert.equal(parseBackup(JSON.stringify({ app: "powerlock", format: 1 })).ok, false)
  assert.equal(parseBackup(JSON.stringify({ app: "powerlock", format: 1, data: [] })).ok, false)
})
test("Un archivo enorme se rechaza sin intentar procesarlo", () => {
  const r = parseBackup("x".repeat(MAX_BACKUP_BYTES + 1))
  assert.equal(r.ok, false)
})

console.log("Validación del contenido (nunca se confía en el archivo)")
test("Elementos dañados se descartan y se cuentan; los buenos se restauran", () => {
  const f = JSON.parse(createBackup(sample(), NOW))
  f.data.routines.push({ id: "", name: "" }, "basura")
  f.data.sessions.push({ id: "x", kind: "no-existe" })
  f.data.sets.push({ ...f.data.sets[0], id: "mala", weightKg: -3 }, { ...f.data.sets[0], id: "mala2", reps: 0 })
  const r = parseBackup(JSON.stringify(f))
  assert.ok(r.ok)
  if (r.ok) {
    assert.deepEqual(r.counts, { routines: 1, sessions: 1, sets: 2 })
    assert.equal(r.dropped, 5)
  }
})
test("Pulso dudoso dentro de una sesión se descarta pero la sesión se conserva", () => {
  const f = JSON.parse(createBackup(sample(), NOW))
  f.data.sessions[0].avgBpm = 500
  const r = parseBackup(JSON.stringify(f))
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.data.sessions.length, 1); assert.ok(!("avgBpm" in r.data.sessions[0])) }
})
test("Ajustes fuera de rango se saneen (volumen limitado a 0-100)", () => {
  const f = JSON.parse(createBackup(sample(), NOW))
  f.data.settings = { volume: 9999, vibration: "sí" }
  const r = parseBackup(JSON.stringify(f))
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.data.settings, { volume: 100, vibration: DEFAULT_SETTINGS.vibration })
})
test("Campos peligrosos o extra no se propagan (__proto__ / claves desconocidas)", () => {
  const evil = '{"app":"powerlock","format":1,"data":{"routines":[],"sessions":[],"sets":[],"settings":{"__proto__":{"polluted":true},"volume":50}},"__proto__":{"x":1}}'
  const r = parseBackup(evil)
  assert.ok(r.ok)
  assert.equal(({} as Record<string, unknown>).polluted, undefined)
  assert.equal(({} as Record<string, unknown>).x, undefined)
})

console.log("Combinar vs reemplazar")
test("Combinar añade lo que falta, no duplica, no pisa lo actual y conserva los ajustes actuales", () => {
  const current: BackupData = { routines: [routine("r1", "MI VERSIÓN")], sessions: [session("s1")], sets: [setOf("t1")], settings: { volume: 10, vibration: true } }
  const incoming: BackupData = { routines: [routine("r1", "OTRA"), routine("r2")], sessions: [session("s1", { durationSeconds: 1 }), session("s2")], sets: [setOf("t1"), setOf("t3")], settings: { volume: 99, vibration: false } }
  const m = mergeBackups(current, incoming)
  assert.deepEqual(m.routines.map((r) => r.id), ["r1", "r2"])
  assert.equal(m.routines[0].name, "MI VERSIÓN")
  assert.deepEqual(m.sessions.map((s) => s.id).sort(), ["s1", "s2"])
  assert.equal(m.sessions.find((s) => s.id === "s1")!.durationSeconds, 1800, "no pisa la sesión existente")
  assert.deepEqual(m.sets.map((s) => s.id).sort(), ["t1", "t3"])
  assert.deepEqual(m.settings, { volume: 10, vibration: true })
})
test("Combinar dos veces la misma copia no cambia nada (idempotente)", () => {
  const cur = sample()
  const once = mergeBackups(cur, sample())
  const twice = mergeBackups(once, sample())
  assert.deepEqual(countBackup(twice), countBackup(once))
  assert.deepEqual(countBackup(once), countBackup(cur))
})
test("Combinar sobre datos vacíos equivale a restaurar", () => {
  const empty: BackupData = { routines: [], sessions: [], sets: [], settings: DEFAULT_SETTINGS }
  assert.deepEqual(countBackup(mergeBackups(empty, sample())), countBackup(sample()))
})

console.log("Utilidades")
test("Nombre de archivo con fecha LOCAL", () => assert.equal(backupFileName(new Date(2026, 0, 5, 23, 59)), "powerlock-copia-2026-01-05.json"))
test("Días desde la última copia", () => {
  assert.equal(daysSinceBackup(null, NOW), null)
  assert.equal(daysSinceBackup("basura", NOW), null)
  assert.equal(daysSinceBackup(new Date(NOW.getTime() - 3 * 86_400_000).toISOString(), NOW), 3)
  assert.equal(daysSinceBackup(new Date(NOW.getTime() + 86_400_000).toISOString(), NOW), 0, "una fecha futura no da días negativos")
})
test("Estado de instalación", () => {
  assert.equal(installState({ standalone: true, hasPrompt: true, secure: true }), "installed")
  assert.equal(installState({ standalone: false, hasPrompt: true, secure: true }), "available")
  assert.equal(installState({ standalone: false, hasPrompt: false, secure: true }), "manual")
  assert.equal(installState({ standalone: false, hasPrompt: true, secure: false }), "unavailable")
})

console.log(`${passed} pruebas OK`)
