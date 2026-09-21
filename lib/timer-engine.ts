/**
 * Motor del temporizador. Puro: sin React, sin DOM, sin efectos.
 *
 * Idea: una sesión es una lista de segmentos (preparar / trabajo / descanso).
 * El estado avanza sumando el tiempo REAL transcurrido (delta entre timestamps),
 * no contando ticks de setInterval. Así, si el navegador se duerme o se bloquea
 * la pantalla, al volver el reloj se pone al día en vez de quedarse atrasado.
 */

export type Phase = "prepare" | "work" | "rest"

export interface Segment {
  phase: Phase
  /** Segundos. null = abierto (cronómetro o serie por repeticiones): no avanza solo. */
  duration: number | null
  round: number
  totalRounds: number
  exerciseIndex: number
}

export interface EngineState {
  index: number
  segElapsedMs: number
  totalElapsedMs: number
  finished: boolean
}

export type Signal = "finish" | Phase | "tick" | null

export const PREPARE_SECONDS = 5

export function createInitialState(): EngineState {
  return { index: 0, segElapsedMs: 0, totalElapsedMs: 0, finished: false }
}

/* ------------------------------ Planes ------------------------------ */

export interface IntervalConfig {
  workTime: number
  restTime: number
  rounds: number
}

/** Tabata, EMOM, FGB. No hay descanso después de la última ronda. */
export function buildIntervalPlan({ workTime, restTime, rounds }: IntervalConfig): Segment[] {
  const total = Math.max(1, Math.floor(rounds))
  const plan: Segment[] = [
    { phase: "prepare", duration: PREPARE_SECONDS, round: 1, totalRounds: total, exerciseIndex: 0 },
  ]
  for (let r = 1; r <= total; r++) {
    plan.push({ phase: "work", duration: Math.max(1, workTime), round: r, totalRounds: total, exerciseIndex: 0 })
    if (restTime > 0 && r < total) {
      plan.push({ phase: "rest", duration: restTime, round: r, totalRounds: total, exerciseIndex: 0 })
    }
  }
  return plan
}

export function buildStopwatchPlan(): Segment[] {
  return [{ phase: "work", duration: null, round: 1, totalRounds: 1, exerciseIndex: 0 }]
}

/** Forma mínima que necesita el motor de un ejercicio de rutina. */
export interface RoutineStep {
  sets: number
  reps: number
  isTime: boolean
  /** Segundos de la serie si es por tiempo. Si falta se usa `reps` (formato antiguo). */
  duration?: number
  restTime: number
}

/**
 * Por cada ejercicio: preparar -> (trabajo -> descanso) x series.
 * - Serie por tiempo: dura lo que dice el ejercicio.
 * - Serie por repeticiones: abierta; el usuario toca "listo" cuando termina.
 * - El descanso de la última serie solo existe si viene otro ejercicio después.
 */
export function buildRoutinePlan(steps: RoutineStep[]): Segment[] {
  const plan: Segment[] = []
  steps.forEach((step, exerciseIndex) => {
    const sets = Math.max(1, Math.floor(step.sets))
    const hasNext = exerciseIndex < steps.length - 1
    plan.push({ phase: "prepare", duration: PREPARE_SECONDS, round: 1, totalRounds: sets, exerciseIndex })
    for (let s = 1; s <= sets; s++) {
      const workSeconds = step.isTime ? Math.max(1, step.duration ?? step.reps) : null
      plan.push({ phase: "work", duration: workSeconds, round: s, totalRounds: sets, exerciseIndex })
      if (step.restTime > 0 && (s < sets || hasNext)) {
        plan.push({ phase: "rest", duration: step.restTime, round: s, totalRounds: sets, exerciseIndex })
      }
    }
  })
  return plan
}

/**
 * Cuántos bloques de trabajo se han superado: los anteriores al actual y, si la sesión
 * terminó, también el último. Es lo que el historial muestra como "rondas" / "series".
 */
export function completedWorkSegments(plan: Segment[], state: EngineState): number {
  let count = 0
  for (let i = 0; i < plan.length; i++) {
    if (plan[i].phase !== "work") continue
    if (i < state.index || (state.finished && i === state.index)) count++
  }
  return count
}

/* --------------------------- Duración estimada --------------------------- */

/** Segundos que se asumen por repetición para estimar series por repeticiones. */
export const SECONDS_PER_REP = 3

/**
 * Duración estimada de una rutina, calculada sobre el MISMO plan que ejecuta el reloj
 * (incluye los 5 s de preparación y omite el descanso final). Una sola fórmula para
 * el creador, el guardado y el reloj.
 */
export function estimateRoutineSeconds(steps: RoutineStep[]): number {
  return buildRoutinePlan(steps).reduce((acc, seg) => {
    if (seg.duration !== null) return acc + seg.duration
    return acc + Math.max(1, steps[seg.exerciseIndex].reps) * SECONDS_PER_REP
  }, 0)
}

/** Minutos redondeados hacia arriba; 0 solo si no hay ejercicios. */
export function estimateRoutineMinutes(steps: RoutineStep[]): number {
  const seconds = estimateRoutineSeconds(steps)
  return seconds === 0 ? 0 : Math.max(1, Math.ceil(seconds / 60))
}

/* --------------------------- Avance del reloj --------------------------- */

/** Suma `deltaMs` de tiempo real, cruzando tantos segmentos como haga falta. */
export function advance(plan: Segment[], state: EngineState, deltaMs: number): EngineState {
  if (state.finished || plan.length === 0 || deltaMs <= 0) return state

  let index = state.index
  let segElapsedMs = state.segElapsedMs
  let remaining = deltaMs
  let finished = false

  for (;;) {
    const seg = plan[index]
    if (seg.duration === null) {
      segElapsedMs += remaining
      remaining = 0
      break
    }
    const segMs = seg.duration * 1000
    const left = segMs - segElapsedMs
    if (remaining < left) {
      segElapsedMs += remaining
      remaining = 0
      break
    }
    remaining -= left
    if (index === plan.length - 1) {
      segElapsedMs = segMs
      finished = true
      break
    }
    index += 1
    segElapsedMs = 0
  }

  return {
    index,
    segElapsedMs,
    totalElapsedMs: state.totalElapsedMs + (deltaMs - remaining),
    finished,
  }
}

/** Salta al siguiente segmento (o termina si era el último). No suma el tiempo saltado. */
export function skipSegment(plan: Segment[], state: EngineState): EngineState {
  if (state.finished || plan.length === 0) return state
  if (state.index >= plan.length - 1) {
    const seg = plan[state.index]
    return {
      ...state,
      segElapsedMs: seg.duration !== null ? seg.duration * 1000 : state.segElapsedMs,
      finished: true,
    }
  }
  return { ...state, index: state.index + 1, segElapsedMs: 0 }
}

/* ------------------------------ Lectura ------------------------------ */

/** Segundos que faltan (redondeado hacia arriba), o null si el segmento es abierto. */
export function remainingSeconds(seg: Segment, segElapsedMs: number): number | null {
  if (seg.duration === null) return null
  return Math.max(0, Math.ceil((seg.duration * 1000 - segElapsedMs) / 1000))
}

/** Qué aviso corresponde al pasar de `prev` a `next` (o null si ninguno). */
export function describeTransition(plan: Segment[], prev: EngineState, next: EngineState): Signal {
  if (!prev.finished && next.finished) return "finish"
  if (next.finished || plan.length === 0) return null
  if (next.index !== prev.index) return plan[next.index].phase

  const seg = plan[next.index]
  const before = remainingSeconds(seg, prev.segElapsedMs)
  const after = remainingSeconds(seg, next.segElapsedMs)
  if (before === null || after === null) return null
  return after !== before && after >= 1 && after <= 3 ? "tick" : null
}
