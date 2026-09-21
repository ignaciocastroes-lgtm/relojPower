import assert from "node:assert/strict"
import {
  advance,
  buildIntervalPlan,
  buildRoutinePlan,
  buildStopwatchPlan,
  completedWorkSegments,
  createInitialState,
  describeTransition,
  remainingSeconds,
  skipSegment,
  type EngineState,
  type Segment,
} from "../lib/timer-engine.ts"

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (err) {
    console.error(`FAIL  ${name}`)
    throw err
  }
}

const totalSeconds = (plan: Segment[]) =>
  plan.reduce((acc, s) => acc + (s.duration ?? 0), 0)

/** Avanza en ticks de `stepMs` hasta `untilMs`, devolviendo estado y avisos. */
function simulate(plan: Segment[], untilMs: number, stepMs = 200) {
  let state = createInitialState()
  const signals: string[] = []
  for (let t = 0; t < untilMs && !state.finished; t += stepMs) {
    const next = advance(plan, state, stepMs)
    const sig = describeTransition(plan, state, next)
    if (sig) signals.push(sig)
    state = next
  }
  return { state, signals }
}

console.log("Planes")

test("Tabata: 1 preparar + 8 trabajo + 7 descansos (sin descanso final) = 235 s", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  assert.equal(plan.length, 16)
  assert.equal(plan[plan.length - 1].phase, "work")
  assert.equal(totalSeconds(plan), 5 + 8 * 20 + 7 * 10)
})

test("EMOM: 10 bloques de 60 s seguidos, sin descansos", () => {
  const plan = buildIntervalPlan({ workTime: 60, restTime: 0, rounds: 10 })
  assert.equal(plan.filter((s) => s.phase === "work").length, 10)
  assert.equal(plan.filter((s) => s.phase === "rest").length, 0)
})

test("FGB: 3 rondas de 5 min con 2 descansos de 1 min", () => {
  const plan = buildIntervalPlan({ workTime: 300, restTime: 60, rounds: 3 })
  assert.equal(plan.filter((s) => s.phase === "work").length, 3)
  assert.equal(plan.filter((s) => s.phase === "rest").length, 2)
})

test("Rutina: series por tiempo cerradas, por repeticiones abiertas, sin descanso final", () => {
  const plan = buildRoutinePlan([
    { sets: 3, reps: 12, isTime: true, duration: 30, restTime: 60 },
    { sets: 2, reps: 10, isTime: false, restTime: 90 },
  ])
  const ex0Work = plan.filter((s) => s.exerciseIndex === 0 && s.phase === "work")
  const ex1Work = plan.filter((s) => s.exerciseIndex === 1 && s.phase === "work")
  assert.deepEqual(ex0Work.map((s) => s.duration), [30, 30, 30])
  assert.deepEqual(ex1Work.map((s) => s.duration), [null, null])
  assert.equal(plan[plan.length - 1].phase, "work")
  // el ejercicio 0 SÍ descansa tras su última serie (viene otro ejercicio)
  assert.equal(plan.filter((s) => s.exerciseIndex === 0 && s.phase === "rest").length, 3)
})

test("Rutina formato antiguo: sin `duration` usa `reps` como segundos", () => {
  const plan = buildRoutinePlan([{ sets: 1, reps: 45, isTime: true, restTime: 30 }])
  assert.equal(plan.find((s) => s.phase === "work")?.duration, 45)
})

test("Rutina vacía => plan vacío, y advance/skip no rompen", () => {
  const plan = buildRoutinePlan([])
  assert.equal(plan.length, 0)
  const s = createInitialState()
  assert.equal(advance(plan, s, 5000), s)
  assert.equal(skipSegment(plan, s), s)
})

test("Datos raros: series 0 y duración 0 se corrigen a mínimos válidos", () => {
  const plan = buildRoutinePlan([{ sets: 0, reps: 0, isTime: true, duration: 0, restTime: 0 }])
  assert.equal(plan.filter((s) => s.phase === "work").length, 1)
  assert.ok((plan.find((s) => s.phase === "work")?.duration ?? 0) >= 1)
})

console.log("Avance del reloj")

test("Tabata completo en ticks de 200 ms termina a los 235 s exactos", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const { state } = simulate(plan, 300_000)
  assert.equal(state.finished, true)
  assert.equal(state.totalElapsedMs, 235_000)
})

test("PANTALLA BLOQUEADA: un salto de 235 s = mismo resultado que avanzar de a poco", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const jump = advance(plan, createInitialState(), 235_000)
  const { state: stepped } = simulate(plan, 300_000)
  assert.deepEqual(jump, stepped)
})

test("Salto a mitad de sesión cae en el segmento correcto (t=100 s)", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const s = advance(plan, createInitialState(), 100_000)
  // 5 prep, luego ciclos de 30 s (20+10). t=100 -> 95 s tras prep = 3 ciclos (90) + 5 s dentro del 4.º trabajo
  const seg = plan[s.index]
  assert.equal(seg.phase, "work")
  assert.equal(seg.round, 4)
  assert.equal(remainingSeconds(seg, s.segElapsedMs), 15)
})

test("Tiempo total no crece después de terminar", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const done = advance(plan, createInitialState(), 999_000)
  assert.equal(done.finished, true)
  assert.equal(done.totalElapsedMs, 235_000)
  assert.equal(advance(plan, done, 10_000), done)
})

test("Segmento abierto (reps) nunca avanza solo, ni con un salto enorme", () => {
  const plan = buildRoutinePlan([{ sets: 2, reps: 10, isTime: false, restTime: 60 }])
  let s = advance(plan, createInitialState(), 5_000) // termina el prepare
  assert.equal(plan[s.index].phase, "work")
  s = advance(plan, s, 3_600_000)
  assert.equal(s.index, 1)
  assert.equal(s.finished, false)
})

test("Cronómetro cuenta hacia arriba y no termina", () => {
  const plan = buildStopwatchPlan()
  const s = advance(plan, createInitialState(), 125_000)
  assert.equal(s.totalElapsedMs, 125_000)
  assert.equal(s.finished, false)
})

console.log("Saltar")

test("BUG CORREGIDO: saltar en PREPARADO va al trabajo de la ronda 1, no a la 2", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const s = skipSegment(plan, createInitialState())
  assert.equal(plan[s.index].phase, "work")
  assert.equal(plan[s.index].round, 1)
  assert.equal(s.segElapsedMs, 0)
})

test("Saltar en el último descanso avanza (antes no hacía nada)", () => {
  const plan = buildRoutinePlan([
    { sets: 1, reps: 10, isTime: true, duration: 20, restTime: 30 },
    { sets: 1, reps: 10, isTime: true, duration: 20, restTime: 30 },
  ])
  const restIdx = plan.findIndex((s) => s.phase === "rest")
  const s = skipSegment(plan, { ...createInitialState(), index: restIdx })
  assert.equal(plan[s.index].phase, "prepare")
  assert.equal(plan[s.index].exerciseIndex, 1) // cambió de ejercicio
})

test("Saltar en el último segmento termina la sesión", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 2 })
  const last: EngineState = { ...createInitialState(), index: plan.length - 1 }
  assert.equal(skipSegment(plan, last).finished, true)
})

test("Saltar no suma el tiempo saltado al total", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const s = skipSegment(plan, advance(plan, createInitialState(), 2_000))
  assert.equal(s.totalElapsedMs, 2_000)
})

console.log("Avisos (beeps)")

test("Cuenta regresiva: exactamente 3-2-1 en el PREPARADO de 5 s", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 1 })
  const { signals } = simulate(plan, 5_000)
  assert.deepEqual(signals.filter((x) => x === "tick"), ["tick", "tick", "tick"])
})

test("Secuencia de avisos de un Tabata corto: tick x3, work, tick x3, rest, ... finish", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 2 })
  const { signals } = simulate(plan, 60_000)
  assert.equal(signals[signals.length - 1], "finish")
  assert.equal(signals.filter((x) => x === "work").length, 2)
  assert.equal(signals.filter((x) => x === "rest").length, 1)
  assert.equal(signals.filter((x) => x === "finish").length, 1)
})

test("Un salto largo produce UN solo aviso, no una ráfaga", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const prev = createInitialState()
  const next = advance(plan, prev, 100_000)
  assert.equal(describeTransition(plan, prev, next), "work")
})

test("Saltar con skip también avisa del nuevo segmento", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  const prev = createInitialState()
  assert.equal(describeTransition(plan, prev, skipSegment(plan, prev)), "work")
})

console.log("Conteo de rondas para el historial")

test("Tabata en preparación: 0; a mitad de la 3.ª ronda: 2; terminado: 8", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  assert.equal(completedWorkSegments(plan, createInitialState()), 0)
  // 5 prep + 2 ciclos de 30 s = 65 s -> empieza la 3.ª ronda (aún no completada)
  assert.equal(completedWorkSegments(plan, advance(plan, createInitialState(), 70_000)), 2)
  assert.equal(completedWorkSegments(plan, advance(plan, createInitialState(), 999_000)), 8)
})

test("Estar en descanso cuenta el trabajo anterior como completado", () => {
  const plan = buildIntervalPlan({ workTime: 20, restTime: 10, rounds: 8 })
  assert.equal(completedWorkSegments(plan, advance(plan, createInitialState(), 27_000)), 1) // en el 1.er descanso
})

test("Rutina: cuenta series (no ejercicios) y una serie saltada con ⏭ cuenta como hecha", () => {
  const plan = buildRoutinePlan([{ sets: 2, reps: 10, isTime: false, restTime: 30 }, { sets: 3, reps: 5, isTime: true, duration: 10, restTime: 0 }])
  let s = advance(plan, createInitialState(), 5_000)      // entra a la serie abierta 1
  s = skipSegment(plan, s)                                 // "listo" -> descanso
  assert.equal(completedWorkSegments(plan, s), 1)
  const done = advance(plan, { ...createInitialState(), index: plan.length - 1 }, 999_000)
  assert.equal(completedWorkSegments(plan, done), 5)      // 2 + 3 series
})

test("Plan vacío o cronómetro no rompen el conteo", () => {
  assert.equal(completedWorkSegments([], createInitialState()), 0)
  assert.equal(completedWorkSegments(buildStopwatchPlan(), createInitialState()), 0)
})

console.log(`\n${passed} pruebas OK`)
