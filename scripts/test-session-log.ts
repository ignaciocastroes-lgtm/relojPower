import assert from "node:assert/strict"
import {
  MAX_SESSIONS, MIN_SESSION_SECONDS, checkpointToSession, computeStats, computeStreak, dayLabel, dayKey,
  formatDuration, formatTotalTime, normalizeSessions, parseCheckpoint, parseSessions, roundsLabel,
  serializeCheckpoint, serializeSessions, sessionTitle, startOfWeek, timeOfDay, upsertSession,
  type SessionCheckpoint, type SessionRecord,
} from "../lib/session-log.ts"

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e }
}

/** Sesión cuyo inicio es una fecha LOCAL (independiente de la zona horaria del equipo). */
function at(y: number, m: number, d: number, h = 10, min = 0, over: Partial<SessionRecord> = {}): SessionRecord {
  const start = new Date(y, m - 1, d, h, min)
  return {
    id: `s-${y}${m}${d}-${h}${min}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt: start.toISOString(), endedAt: new Date(start.getTime() + 600_000).toISOString(),
    durationSeconds: 600, kind: "tabata", rounds: 8, completed: true, ...over,
  }
}
const wrap = (sessions: unknown[], version: unknown = 1) => JSON.stringify({ version, sessions })
console.log(`Zona horaria de esta corrida: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`)

console.log("Persistencia")
test("Ida y vuelta conserva todos los campos", () => {
  const s = at(2026, 9, 23, 18, 30, { kind: "routine", routineId: "r1", routineName: "Piernas", rounds: 12, durationSeconds: 1815, completed: false })
  const back = parseSessions(serializeSessions([s]))
  assert.deepEqual(back.sessions, [s]); assert.equal(back.corrupt, false); assert.equal(back.dropped, 0)
})
test("Sin nada guardado: vacío y NO corrupto", () => assert.deepEqual(parseSessions(null), { sessions: [], dropped: 0, corrupt: false }))
for (const [label, raw] of [["JSON inválido", "{nope"], ["array", "[]"], ["null", "null"], ["versión desconocida", wrap([], 9)], ["sin versión", JSON.stringify({ sessions: [] })], ["sessions no es array", JSON.stringify({ version: 1, sessions: 3 })]] as const)
  test(`Contenido dañado (${label}): corrupto sin excepción`, () => { const r = parseSessions(raw); assert.equal(r.corrupt, true); assert.deepEqual(r.sessions, []) })
test("Descarta entradas inválidas y las cuenta", () => {
  const good = at(2026, 9, 23)
  const r = parseSessions(wrap([good, null, 5, "x", { id: "" }, { ...good, id: "a", startedAt: "no-fecha" }, { ...good, id: "b", kind: "yoga" }, { ...good, id: "c", durationSeconds: "9" }, { ...good, id: "d", rounds: null }]))
  assert.equal(r.sessions.length, 1); assert.equal(r.dropped, 8)
})
test("Descarta ids duplicados (queda el primero)", () => {
  const a = at(2026, 9, 23, 10, 0, { id: "dup", durationSeconds: 100 }); const b = at(2026, 9, 22, 10, 0, { id: "dup", durationSeconds: 999 })
  const r = parseSessions(wrap([a, b])); assert.equal(r.sessions.length, 1); assert.equal(r.sessions[0].durationSeconds, 100); assert.equal(r.dropped, 1)
})
test("Acota valores absurdos (duración 10 días, 99999 rondas, negativos)", () => {
  const r = parseSessions(wrap([{ ...at(2026, 9, 23), durationSeconds: 999_999_999, rounds: 99_999 }, { ...at(2026, 9, 22), id: "n", durationSeconds: -50, rounds: -3 }]))
  const byId = Object.fromEntries(r.sessions.map((s) => [s.id, s]))
  assert.equal(r.sessions.find((s) => s.rounds === 9999)?.durationSeconds, 48 * 3600)
  assert.deepEqual([byId["n"].durationSeconds, byId["n"].rounds], [0, 0])
})
test("Normaliza fechas a ISO y solo `true` cuenta como completada", () => {
  const r = parseSessions(wrap([{ ...at(2026, 9, 23), startedAt: "2026-09-23T10:00:00-03:00", completed: "yes" }]))
  assert.equal(r.sessions[0].startedAt, "2026-09-23T13:00:00.000Z"); assert.equal(r.sessions[0].completed, false)
})
test("Ignora campos desconocidos", () => {
  const r = parseSessions(wrap([{ ...at(2026, 9, 23), hack: "<script>", volumenKg: 12500 }]))
  assert.equal("hack" in r.sessions[0], false); assert.equal("volumenKg" in r.sessions[0], false)
})
test("Orden: más reciente primero, sin importar cómo vengan", () => {
  const a = at(2026, 9, 1), b = at(2026, 9, 20), c = at(2026, 9, 10)
  assert.deepEqual(parseSessions(wrap([a, b, c])).sessions.map((s) => s.startedAt), [b, c, a].map((s) => s.startedAt))
})
test(`Tope de ${MAX_SESSIONS}: se descartan las MÁS ANTIGUAS`, () => {
  const many = Array.from({ length: MAX_SESSIONS + 5 }, (_, i) => at(2020, 1, 1, 0, 0, { id: `id${i}`, startedAt: new Date(2020, 0, 1, 0, i).toISOString() }))
  const out = normalizeSessions(many)
  assert.equal(out.length, MAX_SESSIONS); assert.ok(out.some((s) => s.id === `id${MAX_SESSIONS + 4}`)); assert.ok(!out.some((s) => s.id === "id0"))
})
test("Idempotente: parsear lo ya normalizado no cambia nada", () => {
  const once = parseSessions(wrap([at(2026, 9, 1), at(2026, 9, 2)])); const twice = parseSessions(serializeSessions(once.sessions))
  assert.deepEqual(twice.sessions, once.sessions); assert.equal(twice.dropped, 0)
})
test("upsert: mismo id REEMPLAZA (no duplica); id nuevo se inserta ordenado", () => {
  const a = at(2026, 9, 20, 10, 0, { id: "x", completed: false, durationSeconds: 60 })
  const done = { ...a, completed: true, durationSeconds: 235 }
  const list = upsertSession([a], done); assert.equal(list.length, 1); assert.equal(list[0].durationSeconds, 235); assert.equal(list[0].completed, true)
  const newer = at(2026, 9, 21, 10, 0, { id: "y" }); assert.deepEqual(upsertSession(list, newer).map((s) => s.id), ["y", "x"])
})

console.log("Checkpoint (sesión que quedó a medias)")
const cp = (o: Partial<SessionCheckpoint> = {}): SessionCheckpoint => ({ id: "cp1", startedAt: "2026-09-23T21:30:00.000Z", lastSeenAt: "2026-09-23T21:32:00.000Z", durationSeconds: 120, kind: "tabata", rounds: 3, ...o })
test("Ida y vuelta del checkpoint (con y sin datos de rutina)", () => {
  const norm = (x: unknown) => JSON.parse(JSON.stringify(x)) // lo que realmente se guarda
  const withR = cp({ routineId: "r1", routineName: "Piernas", kind: "routine" })
  assert.deepEqual(norm(parseCheckpoint(serializeCheckpoint(withR))), norm(withR))
  assert.deepEqual(norm(parseCheckpoint(serializeCheckpoint(cp()))), norm(cp()))
})
for (const [label, raw] of [["null", null], ["no json", "{x"], ["sin versión", JSON.stringify({ checkpoint: cp() })], ["sin id", JSON.stringify({ version: 1, checkpoint: { ...cp(), id: "" } })], ["kind inválido", JSON.stringify({ version: 1, checkpoint: { ...cp(), kind: "x" } })], ["fecha inválida", JSON.stringify({ version: 1, checkpoint: { ...cp(), startedAt: "zzz" } })]] as const)
  test(`Checkpoint inválido (${label}) -> null sin excepción`, () => assert.equal(parseCheckpoint(raw), null))
test("Recuperación: se convierte en sesión PARCIAL, con el mismo id y fin = último registro", () => {
  const s = checkpointToSession(cp())!
  assert.deepEqual([s.id, s.completed, s.endedAt, s.durationSeconds, s.rounds], ["cp1", false, "2026-09-23T21:32:00.000Z", 120, 3])
})
test(`Checkpoint de menos de ${MIN_SESSION_SECONDS} s se descarta`, () => { assert.equal(checkpointToSession(cp({ durationSeconds: MIN_SESSION_SECONDS - 1 })), null); assert.notEqual(checkpointToSession(cp({ durationSeconds: MIN_SESSION_SECONDS })), null) })
test("Registrar la sesión final después de recuperar el checkpoint no duplica (mismo id)", () => {
  const recovered = checkpointToSession(cp())!; const final = { ...recovered, completed: true, durationSeconds: 235 }
  assert.equal(upsertSession([recovered], final).length, 1)
})

console.log("Semana y estadísticas")
test("La semana empieza en LUNES (miércoles -> lunes; domingo -> lunes anterior; lunes -> él mismo)", () => {
  assert.equal(dayKey(startOfWeek(new Date(2026, 8, 23, 15, 0))), "2026-09-21") // miércoles
  assert.equal(dayKey(startOfWeek(new Date(2026, 8, 20, 23, 59))), "2026-09-14") // domingo 20
  assert.equal(dayKey(startOfWeek(new Date(2026, 8, 21, 0, 0))), "2026-09-21") // lunes 00:00
})
test("Bordes de la semana: dom 23:59 dentro; lun 00:00 siguiente, fuera", () => {
  const now = new Date(2026, 8, 23, 12, 0) // semana del 21 al 27
  const s = computeStats([at(2026, 9, 27, 23, 59), at(2026, 9, 28, 0, 0), at(2026, 9, 21, 0, 0), at(2026, 9, 20, 23, 59)], now)
  assert.equal(s.weekSessions, 2); assert.equal(s.totalSessions, 4)
})
test("Suma el tiempo de la semana con segundos reales", () => {
  const s = computeStats([at(2026, 9, 22, 10, 0, { durationSeconds: 235 }), at(2026, 9, 23, 10, 0, { durationSeconds: 65 }), at(2026, 9, 10, 10, 0, { durationSeconds: 9999 })], new Date(2026, 8, 23, 20, 0))
  assert.equal(s.weekSeconds, 300)
})
test("Sin sesiones: todo en cero (nada inventado)", () => assert.deepEqual(computeStats([], new Date(2026, 8, 23)), { weekSessions: 0, weekSeconds: 0, streakDays: 0, totalSessions: 0 }))

console.log("Racha")
const now = new Date(2026, 8, 23, 20, 0)
test("Hoy + ayer + anteayer = 3", () => assert.equal(computeStreak([at(2026, 9, 23), at(2026, 9, 22), at(2026, 9, 21)], now), 3))
test("Sin sesión hoy pero sí ayer: sigue viva (aún puedes entrenar hoy)", () => assert.equal(computeStreak([at(2026, 9, 22), at(2026, 9, 21)], now), 2))
test("Última sesión hace 2 días: racha rota = 0", () => assert.equal(computeStreak([at(2026, 9, 21), at(2026, 9, 20)], now), 0))
test("Un hueco corta la racha (hoy, ayer, [falta 21], 20) = 2", () => assert.equal(computeStreak([at(2026, 9, 23), at(2026, 9, 22), at(2026, 9, 20)], now), 2))
test("Varias sesiones el mismo día cuentan como 1 día", () => assert.equal(computeStreak([at(2026, 9, 23, 8), at(2026, 9, 23, 12), at(2026, 9, 23, 19)], now), 1))
test("23:59 y 00:01 son días distintos", () => assert.equal(computeStreak([at(2026, 9, 22, 23, 59), at(2026, 9, 23, 0, 1)], now), 2))
test("Sin sesiones = 0", () => assert.equal(computeStreak([], now), 0))
test("Cruza el fin de mes y de año", () => {
  assert.equal(computeStreak([at(2026, 1, 1), at(2025, 12, 31), at(2025, 12, 30)], new Date(2026, 0, 1, 12)), 3)
  assert.equal(computeStreak([at(2026, 3, 1), at(2026, 2, 28), at(2026, 2, 27)], new Date(2026, 2, 1, 12)), 3)
})
test("CAMBIO DE HORA: sesiones en días consecutivos alrededor de un cambio de hora siguen siendo racha", () => {
  // Europa: 25/oct/2026 (día de 25 h). Chile: 6/sep/2026 (día de 23 h). EE. UU.: 1/nov/2026 (25 h).
  for (const [y, m, d] of [[2026, 10, 25], [2026, 9, 6], [2026, 11, 1], [2026, 3, 29], [2026, 3, 8]] as const) {
    const around = [at(y, m, d - 1, 23, 30), at(y, m, d, 0, 30), at(y, m, d, 23, 30), at(y, m, d + 1, 0, 30)]
    assert.equal(computeStreak(around, new Date(y, m - 1, d + 1, 12)), 3, `racha rota alrededor de ${y}-${m}-${d}`)
  }
})
test("CAMBIO DE HORA: el límite semanal no se corre", () => {
  const s = computeStats([at(2026, 10, 26, 0, 30), at(2026, 10, 25, 23, 30)], new Date(2026, 9, 27, 12))
  assert.equal(s.weekSessions, 1) // lunes 26 dentro; domingo 25 es de la semana anterior
})

console.log("Formato")
test("formatDuration", () => { assert.equal(formatDuration(0), "0:00"); assert.equal(formatDuration(235), "3:55"); assert.equal(formatDuration(59), "0:59"); assert.equal(formatDuration(3600), "1:00:00"); assert.equal(formatDuration(3725), "1:02:05"); assert.equal(formatDuration(-5), "0:00") })
test("formatTotalTime: <1 h en minutos, si no h:mm", () => {
  assert.deepEqual(formatTotalTime(0), { value: "0", unit: "min" }); assert.deepEqual(formatTotalTime(235), { value: "3", unit: "min" })
  assert.deepEqual(formatTotalTime(3599), { value: "59", unit: "min" }); assert.deepEqual(formatTotalTime(3600), { value: "1:00", unit: "horas" }); assert.deepEqual(formatTotalTime(13500), { value: "3:45", unit: "horas" })
})
test("timeOfDay usa 24 h con ceros", () => { assert.equal(timeOfDay(new Date(2026, 8, 23, 7, 5).toISOString()), "07:05"); assert.equal(timeOfDay(new Date(2026, 8, 23, 18, 30).toISOString()), "18:30") })
test("dayLabel: Hoy / Ayer / Hace N días / fecha", () => {
  const n = new Date(2026, 8, 23, 20, 0)
  const L = (y: number, m: number, d: number, h = 9) => dayLabel(new Date(y, m - 1, d, h).toISOString(), n)
  assert.equal(L(2026, 9, 23), "Hoy"); assert.equal(L(2026, 9, 22, 23), "Ayer"); assert.equal(L(2026, 9, 21), "Hace 2 días"); assert.equal(L(2026, 9, 17), "Hace 6 días")
  assert.notEqual(L(2026, 9, 16), "Hace 7 días"); assert.ok(L(2026, 9, 16).length > 0)
})
test("dayLabel correcto con sesión a las 00:30 y ahora 23:59 (mismo día) y cruzando cambio de hora", () => {
  assert.equal(dayLabel(new Date(2026, 8, 23, 0, 30).toISOString(), new Date(2026, 8, 23, 23, 59)), "Hoy")
  assert.equal(dayLabel(new Date(2026, 9, 24, 12).toISOString(), new Date(2026, 9, 26, 12)), "Hace 2 días") // pasa por el cambio de hora europeo
})
test("roundsLabel y sessionTitle", () => {
  assert.equal(roundsLabel({ kind: "tabata", rounds: 8 }), "8 rondas"); assert.equal(roundsLabel({ kind: "routine", rounds: 1 }), "1 serie"); assert.equal(roundsLabel({ kind: "routine", rounds: 12 }), "12 series")
  assert.equal(roundsLabel({ kind: "stopwatch", rounds: 0 }), null); assert.equal(roundsLabel({ kind: "emom", rounds: 0 }), null)
  assert.equal(sessionTitle({ kind: "tabata" }), "Tabata"); assert.equal(sessionTitle({ kind: "stopwatch" }), "Cronómetro"); assert.equal(sessionTitle({ kind: "routine", routineName: "Piernas" }), "Piernas"); assert.equal(sessionTitle({ kind: "routine" }), "Rutina")
})

console.log(`\n${passed} pruebas OK`)
