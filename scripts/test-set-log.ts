/**
 * Registro de series (peso y repeticiones), volumen, récords y progreso.
 * Se ejecuta en varias zonas horarias (la semana y el día dependen de la hora local). Uso: pnpm test:sets
 */
import assert from "node:assert/strict"
import {
  MAX_SETS, addSet, detectRecords, exerciseProgress, formatKg, lastPerformance, makeSet, mergeSets, normalizeSets, parseSets,
  removeSessionSets, removeSet, sanitizeSet, serializeSets, setLabel, setVolume, suggestSet, summarizeExercises, summarizeSessionSets,
  totalVolume, weekVolumeKg, type SetInput, type SetLog,
} from "../lib/set-log.ts"
import { completedWorkIndices, createInitialState, buildRoutinePlan, advance, skipSegment } from "../lib/timer-engine.ts"

let passed = 0
function test(name: string, fn: () => void) { try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e } }

const at = (iso: string) => new Date(iso)
let n = 0
const mk = (o: Partial<SetInput> & { when?: string; id?: string }): SetLog => {
  const s = makeSet({ sessionId: "s1", exerciseId: "bench", exerciseName: "Press de Banca", setNumber: 1, weightKg: 60, reps: 8, ...o }, at(o.when ?? "2026-09-21T10:00:00.000Z"), o.id ?? `set-${++n}`)
  assert.ok(s, "la serie de prueba debe ser válida")
  return s
}

console.log("Validación de lo que escribe el usuario")
test("Una serie válida se guarda con peso redondeado a 2 decimales", () => {
  assert.equal(mk({ weightKg: 62.504 }).weightKg, 62.5)
  assert.equal(mk({ weightKg: 0 }).weightKg, 0)
})
test("Se rechaza (null): peso negativo/enorme/NaN, reps 0/decimales/enormes, ids vacíos, nº de serie inválido", () => {
  const base: SetInput = { sessionId: "s", exerciseId: "e", exerciseName: "X", setNumber: 1, weightKg: 50, reps: 5 }
  const bad: Partial<SetInput>[] = [{ weightKg: -1 }, { weightKg: 1001 }, { weightKg: NaN }, { weightKg: Infinity }, { reps: 0 }, { reps: 2.5 }, { reps: 1000 }, { reps: NaN },
    { sessionId: "" }, { exerciseId: "" }, { exerciseName: "  " }, { setNumber: 0 }, { setNumber: 100 }, { setNumber: 1.5 }]
  for (const b of bad) assert.equal(makeSet({ ...base, ...b }, new Date()), null, JSON.stringify(b))
})
test("Serie por tiempo: reps null es válido y no aporta volumen", () => {
  const s = mk({ reps: null, weightKg: 20 })
  assert.equal(s.reps, null)
  assert.equal(setVolume(s), 0)
})

console.log("Persistencia")
test("Guardar y leer conserva las series", () => {
  const a = mk({}), b = mk({ reps: null, weightKg: 0, when: "2026-09-22T10:00:00.000Z" })
  const r = parseSets(serializeSets([a, b]))
  assert.equal(r.dropped, 0)
  assert.deepEqual(r.sets.map((s) => s.id).sort(), [a.id, b.id].sort())
})
test("Sin datos = lista vacía; JSON roto = corrupto; versión desconocida = corrupto (sin lanzar)", () => {
  assert.deepEqual(parseSets(null), { sets: [], dropped: 0, corrupt: false })
  assert.equal(parseSets("{no json").corrupt, true)
  assert.equal(parseSets(JSON.stringify({ version: 99, sets: [] })).corrupt, true)
  assert.equal(parseSets(JSON.stringify([1, 2])).corrupt, true)
})
test("Lo dañado se descarta y se cuenta; lo bueno se conserva", () => {
  const good = mk({})
  const raw = JSON.stringify({ version: 1, sets: [good, { ...good, id: "x", weightKg: -5 }, { ...good, id: "y", reps: 0 }, "texto", null, { ...good, id: "z", loggedAt: "no-fecha" }, { ...good, id: "w", exerciseName: "" }] })
  const r = parseSets(raw)
  assert.equal(r.sets.length, 1)
  assert.equal(r.dropped, 6)
})
test("Los ids repetidos no se duplican", () => {
  const a = mk({ id: "dup" })
  assert.equal(parseSets(JSON.stringify({ version: 1, sets: [a, a] })).sets.length, 1)
  assert.equal(addSet([a], a).length, 1)
})
test("Más reciente primero y con tope MAX_SETS", () => {
  const many = Array.from({ length: MAX_SETS + 5 }, (_, i) => mk({ id: `m${i}`, when: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }))
  const out = normalizeSets(many)
  assert.equal(out.length, MAX_SETS)
  assert.ok(Date.parse(out[0].loggedAt) >= Date.parse(out[out.length - 1].loggedAt))
})
test("sanitizeSet no acepta reps 0 ni pesos fuera de rango al leer", () => {
  const g = mk({})
  assert.equal(sanitizeSet({ ...g, reps: 0 }), null)
  assert.equal(sanitizeSet({ ...g, weightKg: 5000 }), null)
  assert.notEqual(sanitizeSet({ ...g, reps: null }), null)
})
test("Borrar una sesión borra sus series; borrar una serie solo esa", () => {
  const a = mk({ sessionId: "A" }), b = mk({ sessionId: "A" }), c = mk({ sessionId: "B" })
  assert.deepEqual(removeSessionSets([a, b, c], "A").map((s) => s.id), [c.id])
  assert.deepEqual(removeSet([a, b, c], a.id).map((s) => s.id), [b.id, c.id])
})
test("mergeSets une por id sin pisar lo existente", () => {
  const a = mk({ id: "1", weightKg: 50 }), a2 = mk({ id: "1", weightKg: 99 }), b = mk({ id: "2" })
  const m = mergeSets([a], [a2, b])
  assert.equal(m.length, 2)
  assert.equal(m.find((s) => s.id === "1")!.weightKg, 50)
})

console.log("Volumen")
test("Volumen = peso x reps; series por tiempo suman 0; peso corporal (0 kg) suma 0", () => {
  assert.equal(setVolume(mk({ weightKg: 60, reps: 8 })), 480)
  assert.equal(setVolume(mk({ weightKg: 62.5, reps: 5 })), 312.5)
  assert.equal(setVolume(mk({ weightKg: 0, reps: 12 })), 0)
  assert.equal(totalVolume([mk({ weightKg: 60, reps: 8 }), mk({ weightKg: 60, reps: 6 }), mk({ reps: null, weightKg: 30 })]), 840)
})
test("Sin error de coma flotante (0.1 x 3 = 0.3)", () => {
  assert.equal(setVolume(mk({ weightKg: 0.1, reps: 3 })), 0.3)
})
test("Resumen de una sesión: series, volumen y ejercicios en el orden en que se hicieron", () => {
  const sets = [
    mk({ sessionId: "S", exerciseId: "sq", exerciseName: "Sentadilla", setNumber: 1, weightKg: 80, reps: 5, when: "2026-09-21T10:00:00Z" }),
    mk({ sessionId: "S", exerciseId: "bench", setNumber: 1, weightKg: 60, reps: 8, when: "2026-09-21T10:10:00Z" }),
    mk({ sessionId: "S", exerciseId: "sq", exerciseName: "Sentadilla", setNumber: 2, weightKg: 80, reps: 5, when: "2026-09-21T10:05:00Z" }),
    mk({ sessionId: "OTRA", weightKg: 999, reps: 9 }),
  ]
  const s = summarizeSessionSets(sets, "S")!
  assert.equal(s.sets, 3)
  assert.equal(s.volumeKg, 80 * 5 * 2 + 480)
  assert.deepEqual(s.exercises.map((e) => e.exerciseId), ["sq", "bench"])
  assert.deepEqual(s.exercises[0].sets.map((x) => x.setNumber), [1, 2])
  assert.equal(summarizeSessionSets(sets, "no-existe"), null)
})
test("Volumen semanal: solo la semana en curso (lunes a domingo, hora local)", () => {
  const now = new Date(2026, 8, 23, 12) // miércoles 23-sep-2026, hora local
  const mon = new Date(2026, 8, 21, 0, 0, 0), sunPrev = new Date(2026, 8, 20, 23, 59, 59), sun = new Date(2026, 8, 27, 23, 59, 59), nextMon = new Date(2026, 8, 28, 0, 0, 0)
  const s = [mk({ when: mon.toISOString(), weightKg: 10, reps: 10 }), mk({ when: sunPrev.toISOString(), weightKg: 20, reps: 10 }), mk({ when: sun.toISOString(), weightKg: 30, reps: 10 }), mk({ when: nextMon.toISOString(), weightKg: 40, reps: 10 })]
  assert.equal(weekVolumeKg(s, now), 100 + 300)
})

console.log("Sugerencias, récords y progreso")
test("Lo último que hiciste con ese ejercicio", () => {
  const s = [mk({ weightKg: 50, when: "2026-09-01T10:00:00Z" }), mk({ weightKg: 55, when: "2026-09-10T10:00:00Z" }), mk({ exerciseId: "otro", weightKg: 999 })]
  assert.equal(lastPerformance(s, "bench")!.weightKg, 55)
  assert.equal(lastPerformance(s, "nada"), null)
})
test("Sugerencia: último peso + reps del plan; sin historial 0 kg; por tiempo sin reps. NUNCA se guarda sola", () => {
  const s = [mk({ weightKg: 55 })]
  assert.deepEqual(suggestSet(s, { exerciseId: "bench", isTime: false, reps: 10 }), { weightKg: 55, reps: 10 })
  assert.deepEqual(suggestSet(s, { exerciseId: "nuevo", isTime: false, reps: 12 }), { weightKg: 0, reps: 12 })
  assert.deepEqual(suggestSet(s, { exerciseId: "bench", isTime: true, reps: 30 }), { weightKg: 55, reps: null })
  assert.equal(s.length, 1, "pedir una sugerencia no crea series")
})
test("Récords: solo con historial previo; peso estrictamente mayor; volumen de serie mayor; peso 0 nunca", () => {
  const hist = [mk({ weightKg: 60, reps: 8 }), mk({ weightKg: 70, reps: 3 })] // máx peso 70, máx volumen 480
  assert.deepEqual(detectRecords([], { exerciseId: "bench", weightKg: 100, reps: 5 }), { hasHistory: false, weight: false, setVolume: false })
  assert.deepEqual(detectRecords(hist, { exerciseId: "bench", weightKg: 72.5, reps: 2 }), { hasHistory: true, weight: true, setVolume: false })
  assert.deepEqual(detectRecords(hist, { exerciseId: "bench", weightKg: 60, reps: 9 }), { hasHistory: true, weight: false, setVolume: true })
  assert.deepEqual(detectRecords(hist, { exerciseId: "bench", weightKg: 70, reps: 3 }), { hasHistory: true, weight: false, setVolume: false })
  assert.deepEqual(detectRecords(hist, { exerciseId: "bench", weightKg: 0, reps: 50 }), { hasHistory: true, weight: false, setVolume: false })
  assert.equal(detectRecords(hist, { exerciseId: "otro", weightKg: 500, reps: 5 }).hasHistory, false)
})
test("Resumen por ejercicio: mejor peso, mejor serie por volumen, sesiones y último uso", () => {
  const s = [
    mk({ sessionId: "A", weightKg: 60, reps: 8, when: "2026-09-01T10:00:00Z" }),
    mk({ sessionId: "A", weightKg: 70, reps: 3, when: "2026-09-01T10:05:00Z" }),
    mk({ sessionId: "B", weightKg: 65, reps: 8, when: "2026-09-08T10:00:00Z" }),
    mk({ sessionId: "B", exerciseId: "sq", exerciseName: "Sentadilla", weightKg: 100, reps: 5, when: "2026-09-09T10:00:00Z" }),
  ]
  const out = summarizeExercises(s)
  assert.deepEqual(out.map((e) => e.exerciseId), ["sq", "bench"], "el más reciente primero")
  const b = out.find((e) => e.exerciseId === "bench")!
  assert.equal(b.totalSets, 3)
  assert.equal(b.sessions, 2)
  assert.equal(b.bestWeight.weightKg, 70)
  assert.equal(b.bestSetVolume!.volumeKg, 520)
  assert.equal(b.totalVolumeKg, 480 + 210 + 520)
})
test("Si solo hay series por tiempo no hay 'mejor volumen'", () => {
  assert.equal(summarizeExercises([mk({ reps: null, weightKg: 10 })])[0].bestSetVolume, null)
})
test("Evolución: una marca por sesión, ordenada por fecha, limitada", () => {
  const s = ["01", "08", "15", "22"].map((d, i) => mk({ sessionId: `S${d}`, weightKg: 50 + i * 5, reps: 5, when: `2026-09-${d}T10:00:00Z` }))
  s.push(mk({ sessionId: "S22", weightKg: 40, reps: 5, when: "2026-09-22T10:10:00Z" }))
  const p = exerciseProgress(s, "bench", 3)
  assert.deepEqual(p.map((x) => x.sessionId), ["S08", "S15", "S22"])
  assert.equal(p[2].maxWeightKg, 65)
  assert.equal(p[2].sets, 2)
})
test("Formato de series", () => {
  assert.equal(setLabel({ weightKg: 62.5, reps: 8 }), "62,5 kg × 8")
  assert.equal(setLabel({ weightKg: 0, reps: 12 }), "peso corporal × 12")
  assert.equal(setLabel({ weightKg: 20, reps: null }), "20 kg · por tiempo")
  assert.equal(formatKg(60), "60")
})

console.log("Motor del reloj: qué series se completaron")
const plan = buildRoutinePlan([{ sets: 3, reps: 8, isTime: false, restTime: 60 }, { sets: 2, reps: 10, isTime: true, duration: 20, restTime: 30 }])
test("Un avance normal a un segmento nuevo completa el trabajo anterior", () => {
  const prevWork = { ...createInitialState(), index: 1 } // primera serie (trabajo abierto)
  assert.equal(plan[1].phase, "work")
  assert.deepEqual(completedWorkIndices(plan, prevWork, skipSegment(plan, prevWork)), [1])
})
test("Dentro del mismo segmento, o de descanso a trabajo, no completa nada", () => {
  const s = { ...createInitialState(), index: 2 } // descanso
  assert.deepEqual(completedWorkIndices(plan, s, { ...s, segElapsedMs: 5000 }), [])
  assert.deepEqual(completedWorkIndices(plan, s, { ...s, index: 3 }), [])
})
test("Un salto largo (pantalla bloqueada) cuenta TODAS las series cruzadas, en orden", () => {
  const s = { ...createInitialState(), index: 1 }
  const next = { ...s, index: 6 }
  const done = completedWorkIndices(plan, s, next)
  assert.deepEqual(done, plan.map((seg, i) => (seg.phase === "work" && i >= 1 && i <= 5 ? i : -1)).filter((i) => i >= 0))
})
test("Terminar la sesión completa la última serie; una sesión ya terminada no repite nada", () => {
  const last = plan.length - 1
  assert.equal(plan[last].phase, "work")
  const prev = { ...createInitialState(), index: last }
  const end = advance(plan, prev, 60_000)
  assert.equal(end.finished, true)
  assert.deepEqual(completedWorkIndices(plan, prev, end), [last])
  assert.deepEqual(completedWorkIndices(plan, end, end), [])
})
test("Plan vacío no falla", () => assert.deepEqual(completedWorkIndices([], createInitialState(), createInitialState()), []))

console.log(`${passed} pruebas OK`)
