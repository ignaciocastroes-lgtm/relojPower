import assert from "node:assert/strict"
import { estimateRoutineMinutes, estimateRoutineSeconds } from "../lib/timer-engine.ts"
import { parseRoutines, serializeRoutines, STORAGE_VERSION } from "../lib/routine-storage.ts"
import type { ExerciseBlock, SavedRoutine } from "../lib/types.ts"

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e }
}

const block = (o: Partial<ExerciseBlock> = {}): ExerciseBlock => ({
  id: "b1", exerciseId: "ex-1", exerciseName: "Sentadilla Smith", bodyPart: "Piernas", equipment: "Barra Smith",
  imageUrl: "https://x/y.jpg", sets: 3, reps: 10, restTime: 60, isTime: false, duration: 30, ...o,
})
const routine = (o: Partial<SavedRoutine> = {}): SavedRoutine => ({
  id: "r1", name: "Piernas", description: "tren inferior", exercises: [block()],
  createdAt: new Date("2026-09-01T10:00:00.000Z"), estimatedDuration: 0, ...o,
})
const wrap = (routines: unknown[], version: unknown = STORAGE_VERSION) => JSON.stringify({ version, routines })

console.log("Ida y vuelta")
test("Guardar y cargar devuelve lo mismo (incluida la fecha como Date)", () => {
  const original = routine({ exercises: [block(), block({ id: "b2", isTime: true, duration: 45 })] })
  const back = parseRoutines(serializeRoutines([original]))
  assert.equal(back.corrupt, false)
  assert.equal(back.dropped, 0)
  assert.equal(back.routines.length, 1)
  const r = back.routines[0]
  assert.ok(r.createdAt instanceof Date)
  assert.equal(r.createdAt.toISOString(), "2026-09-01T10:00:00.000Z")
  assert.deepEqual(r.exercises, original.exercises)
  assert.equal(r.name, "Piernas")
})

test("BUG CORREGIDO: la duración por tiempo sobrevive al guardado (antes se perdía)", () => {
  const back = parseRoutines(serializeRoutines([routine({ exercises: [block({ isTime: true, duration: 45, reps: 12 })] })]))
  assert.equal(back.routines[0].exercises[0].duration, 45)
  assert.equal(back.routines[0].exercises[0].isTime, true)
})

test("El orden de las rutinas y ejercicios se conserva", () => {
  const rs = [routine({ id: "a", name: "A" }), routine({ id: "b", name: "B", exercises: [block({ id: "x", exerciseName: "Uno" }), block({ id: "y", exerciseName: "Dos" })] })]
  const back = parseRoutines(serializeRoutines(rs)).routines
  assert.deepEqual(back.map((r) => r.id), ["a", "b"])
  assert.deepEqual(back[1].exercises.map((e) => e.exerciseName), ["Uno", "Dos"])
})

test("Lista vacía es válida (no es 'corrupto')", () => {
  const r = parseRoutines(serializeRoutines([]))
  assert.deepEqual([r.routines.length, r.dropped, r.corrupt], [0, 0, false])
})

console.log("Sin datos / datos rotos")
test("Sin nada guardado (primer uso): vacío y NO corrupto", () => {
  assert.deepEqual(parseRoutines(null), { routines: [], dropped: 0, corrupt: false })
})

for (const [label, raw] of [
  ["JSON inválido", "{esto no es json"],
  ["texto suelto", "hola"],
  ["array en vez de objeto", "[]"],
  ["null", "null"],
  ["versión desconocida", wrap([routine()], 99)],
  ["sin versión", JSON.stringify({ routines: [routine()] })],
  ["routines no es array", JSON.stringify({ version: 1, routines: "no" })],
] as const) {
  test(`Contenido dañado (${label}): corrupto, sin lanzar excepción`, () => {
    const r = parseRoutines(raw)
    assert.equal(r.corrupt, true)
    assert.deepEqual(r.routines, [])
  })
}

console.log("Saneamiento")
test("Descarta rutinas sin id o sin nombre, conserva las buenas, y cuenta lo descartado", () => {
  const r = parseRoutines(wrap([routine({ id: "ok" }), { id: "", name: "sin id" }, { id: "z" }, 42, null, "x"]))
  assert.deepEqual(r.routines.map((x) => x.id), ["ok"])
  assert.equal(r.dropped, 5)
  assert.equal(r.corrupt, false)
})

test("Descarta ids duplicados (se queda con el primero)", () => {
  const r = parseRoutines(wrap([routine({ id: "d", name: "Primera" }), routine({ id: "d", name: "Segunda" })]))
  assert.equal(r.routines.length, 1)
  assert.equal(r.routines[0].name, "Primera")
  assert.equal(r.dropped, 1)
})

test("Descarta ejercicios inválidos dentro de una rutina buena", () => {
  const r = parseRoutines(wrap([{ ...routine(), exercises: [block(), { exerciseName: "" }, 7, { id: "sin nombre" }] }]))
  assert.equal(r.routines[0].exercises.length, 1)
  assert.equal(r.dropped, 3)
})

test("Corrige números fuera de rango o de tipo incorrecto", () => {
  const dirty = { ...block(), sets: -5, reps: "12", restTime: 99999, duration: 0, isTime: "yes" }
  const b = parseRoutines(wrap([{ ...routine(), exercises: [dirty] }])).routines[0].exercises[0]
  assert.equal(b.sets, 1)          // -5 -> mínimo 1
  assert.equal(b.reps, 12)         // "12" (string) -> valor por defecto 12
  assert.equal(b.restTime, 3600)   // tope
  assert.equal(b.duration, 1)      // 0 -> mínimo 1
  assert.equal(b.isTime, false)    // solo `true` cuenta
})

test("NaN, Infinity y null en números usan el valor por defecto", () => {
  // JSON no transporta NaN/Infinity (salen como null): comprobar que null cae al defecto
  const b = parseRoutines(wrap([{ ...routine(), exercises: [{ ...block(), sets: null, reps: null, restTime: null, duration: null }] }])).routines[0].exercises[0]
  assert.deepEqual([b.sets, b.reps, b.restTime, b.duration], [3, 12, 60, 30])
})

test("Fecha inválida no rompe: cae a una fecha fija", () => {
  const r = parseRoutines(wrap([{ ...routine(), createdAt: "no-es-fecha" }])).routines[0]
  assert.ok(r.createdAt instanceof Date)
  assert.equal(Number.isNaN(r.createdAt.getTime()), false)
})

test("Rutina sin campo exercises se carga como vacía (no explota)", () => {
  const { exercises: _omit, ...noEx } = routine()
  const r = parseRoutines(wrap([noEx])).routines[0]
  assert.deepEqual(r.exercises, [])
  assert.equal(r.estimatedDuration, 0)
})

test("No se confía en estimatedDuration guardado: se recalcula", () => {
  const r = parseRoutines(wrap([{ ...routine(), estimatedDuration: 9999 }])).routines[0]
  assert.equal(r.estimatedDuration, estimateRoutineMinutes(r.exercises))
  assert.notEqual(r.estimatedDuration, 9999)
})

test("Un bloque sin id recibe uno nuevo; ids de bloque generados son únicos", () => {
  const noId = { ...block() } as Partial<ExerciseBlock>
  delete noId.id
  const r = parseRoutines(wrap([{ ...routine(), exercises: [noId, noId] }])).routines[0]
  assert.ok(r.exercises[0].id.startsWith("block-"))
  assert.notEqual(r.exercises[0].id, r.exercises[1].id)
})

test("Campos extra desconocidos se ignoran (no se cuelan al modelo)", () => {
  const r = parseRoutines(wrap([{ ...routine(), hack: "<script>", exercises: [{ ...block(), evil: 1 }] }])).routines[0]
  assert.equal("hack" in r, false)
  assert.equal("evil" in r.exercises[0], false)
})

test("Idempotente: parsear lo ya normalizado no cambia nada", () => {
  const once = parseRoutines(wrap([{ ...routine(), estimatedDuration: 12345, exercises: [{ ...block(), sets: 500 }] }]))
  const twice = parseRoutines(serializeRoutines(once.routines))
  assert.deepEqual(twice.routines, once.routines)
  assert.equal(twice.dropped, 0)
})

console.log("Duración estimada (una sola fórmula)")
test("Rutina por tiempo: 1 ej, 3 series x 30 s, descanso 60 s = 5 prep + 90 trabajo + 120 descanso", () => {
  const steps = [{ sets: 3, reps: 12, isTime: true, duration: 30, restTime: 60 }]
  assert.equal(estimateRoutineSeconds(steps), 5 + 3 * 30 + 2 * 60)
})

test("Serie por reps usa 3 s por repetición", () => {
  const steps = [{ sets: 2, reps: 10, isTime: false, duration: 30, restTime: 0 }]
  assert.equal(estimateRoutineSeconds(steps), 5 + 2 * 10 * 3)
})

test("Entre ejercicios sí hay descanso y preparación; al final no", () => {
  const a = { sets: 1, reps: 10, isTime: true, duration: 20, restTime: 30 }
  assert.equal(estimateRoutineSeconds([a, a]), (5 + 20 + 30) + (5 + 20))
})

test("Minutos: redondea hacia arriba, mínimo 1, y 0 si no hay ejercicios", () => {
  assert.equal(estimateRoutineMinutes([]), 0)
  assert.equal(estimateRoutineMinutes([{ sets: 1, reps: 1, isTime: true, duration: 1, restTime: 0 }]), 1)
  assert.equal(estimateRoutineMinutes([{ sets: 1, reps: 1, isTime: true, duration: 60, restTime: 0 }]), 2) // 65 s -> 2 min
})

console.log(`\n${passed} pruebas OK`)
