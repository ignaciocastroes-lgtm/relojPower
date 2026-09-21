"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Play,
  Pause,
  SkipForward,
  Timer,
  Zap,
  RefreshCw,
  Clock,
  X,
  Dumbbell,
  Settings
} from "lucide-react"
import type { SavedRoutine } from "@/lib/types"
import {
  advance,
  buildIntervalPlan,
  buildRoutinePlan,
  buildStopwatchPlan,
  completedWorkIndices,
  completedWorkSegments,
  createInitialState,
  describeTransition,
  remainingSeconds,
  skipSegment,
  type EngineState,
  type Segment,
} from "@/lib/timer-engine"
import { playSignal, unlockAudio } from "@/lib/beeper"
import { addHeartSample, emptyHeart, summarizeHeart, type HeartAccumulator } from "@/lib/heart-rate"
import { useHeartRate } from "@/hooks/use-heart-rate"
import { HeartRatePill } from "./heart-rate-pill"
import { SetLogCard, type PendingSet } from "./set-log-card"
import { detectRecords, formatKg, makeSet, suggestSet, type SetLog } from "@/lib/set-log"
import { MIN_SESSION_SECONDS, newSessionId, type SessionCheckpoint, type SessionKind, type SessionRecord } from "@/lib/session-log"

interface WorkoutTimerProps {
  preloadedRoutine?: SavedRoutine | null
  onClearRoutine?: () => void
  /** Abre el modal de sonido y vibración (lo controla la página). */
  onOpenSettings: () => void
  /** Se llama una vez cuando una sesión termina o se abandona (alimenta el historial). */
  onSessionEnd?: (session: SessionRecord) => void
  /** Foto de la sesión en curso cada pocos segundos; null cuando ya no hay sesión. */
  onCheckpoint?: (checkpoint: SessionCheckpoint | null) => void
  /** Series ya registradas (para sugerir el último peso y detectar récords). */
  sets: SetLog[]
  /** El usuario confirmó una serie: guardarla. */
  onLogSet: (set: SetLog) => void
}

type TimerMode = "tabata" | "emom" | "fgb" | "stopwatch" | "routine"
type VisualPhase = "prepare" | "work" | "rest" | "done"

interface ModeConfig {
  workTime: number
  restTime: number
  rounds: number
  name: string
  description: string
}

const modeConfigs: Record<Exclude<TimerMode, "routine">, ModeConfig> = {
  tabata: { workTime: 20, restTime: 10, rounds: 8, name: "Tabata", description: "20s trabajo / 10s descanso" },
  emom: { workTime: 60, restTime: 0, rounds: 10, name: "EMOM", description: "Every Minute on the Minute" },
  fgb: { workTime: 300, restTime: 60, rounds: 3, name: "FGB", description: "Fight Gone Bad - 3 rondas de 5 min" },
  stopwatch: { workTime: 0, restTime: 0, rounds: 1, name: "Cronómetro", description: "Tiempo libre" },
}

const TICK_MS = 200
const CHECKPOINT_EVERY_MS = 10_000

/** Sesión en curso: existe desde el primer Play hasta que termina o se abandona. */
interface ActiveSession {
  id: string
  startedAtMs: number
  kind: SessionKind
  routineId?: string
  routineName?: string
  /** Plan con el que arrancó (el plan actual puede cambiar antes de cerrarla). */
  plan: Segment[]
  lastCheckpointMs: number
  /** Pulso medido por el sensor mientras el reloj corre (vacío si no hubo sensor). */
  heart: HeartAccumulator
}

function progressOf(session: ActiveSession, state: EngineState) {
  return {
    // Mismo cálculo que el "Tiempo total" que ve el usuario en pantalla.
    durationSeconds: Math.floor(state.totalElapsedMs / 1000),
    rounds: session.kind === "stopwatch" ? 0 : completedWorkSegments(session.plan, state),
    // null si no hubo sensor o midió menos de 10 s: entonces no se guarda ningún pulso.
    heart: summarizeHeart(session.heart),
  }
}

function buildPlan(mode: TimerMode, routine: SavedRoutine | null | undefined): Segment[] {
  if (mode === "routine") return buildRoutinePlan(routine?.exercises ?? [])
  if (mode === "stopwatch") return buildStopwatchPlan()
  return buildIntervalPlan(modeConfigs[mode])
}

export function WorkoutTimer({ preloadedRoutine, onClearRoutine, onOpenSettings, onSessionEnd, onCheckpoint, sets, onLogSet }: WorkoutTimerProps) {
  const [mode, setMode] = useState<TimerMode>(preloadedRoutine ? "routine" : "tabata")
  const [isRunning, setIsRunning] = useState(false)
  const [engine, setEngine] = useState<EngineState>(createInitialState)
  const engineRef = useRef<EngineState>(engine)
  const lastTickRef = useRef<number>(0)
  const sessionRef = useRef<ActiveSession | null>(null)
  const onSessionEndRef = useRef(onSessionEnd)
  const onCheckpointRef = useRef(onCheckpoint)
  const heartRate = useHeartRate()
  const bpmRef = useRef<number | null>(null)
  const [pending, setPending] = useState<PendingSet[]>([])
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const lastSessionIdRef = useRef<string | null>(null)
  const loggedInSessionRef = useRef(0)

  // El plan solo cambia si cambia el modo o la rutina cargada.
  const plan = useMemo(() => buildPlan(mode, preloadedRoutine), [mode, preloadedRoutine])
  const hasPlan = plan.length > 0
  const segment: Segment | undefined = plan[Math.min(engine.index, plan.length - 1)]

  // Los callbacks del padre se leen por ref: así los intervalos no dependen de su identidad.
  useEffect(() => {
    onSessionEndRef.current = onSessionEnd
    onCheckpointRef.current = onCheckpoint
    bpmRef.current = heartRate.bpm
  })

  // ---- Registro de sesiones (historial) ----

  /** Guarda una "foto" de la sesión en curso por si la app se cierra a medias. */
  const writeCheckpoint = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    const { durationSeconds, rounds, heart } = progressOf(s, engineRef.current)
    onCheckpointRef.current?.({
      id: s.id,
      startedAt: new Date(s.startedAtMs).toISOString(),
      lastSeenAt: new Date().toISOString(),
      durationSeconds,
      kind: s.kind,
      routineId: s.routineId,
      routineName: s.routineName,
      rounds,
      ...(heart ?? {}),
    })
  }, [])

  /**
   * Cierra la sesión en curso (si la hay) y la manda al historial.
   * - `finishedNaturally`: llegó al final del plan -> siempre se registra.
   * - Si se abandonó (Reiniciar, cambio de modo/rutina) solo se registra con tiempo mínimo,
   *   para no llenar el historial de toques accidentales. El cronómetro no tiene meta:
   *   detenerlo cuenta como completo.
   */
  const finalizeSession = useCallback((finishedNaturally = false) => {
    const s = sessionRef.current
    if (!s) return
    sessionRef.current = null
    lastSessionIdRef.current = s.id // las series pendientes de esta sesión aún se pueden registrar
    onCheckpointRef.current?.(null)

    const { durationSeconds, rounds, heart } = progressOf(s, engineRef.current)
    if (durationSeconds <= 0) return
    // Una sesión corta se descarta, salvo que el usuario ya haya registrado series en ella (son datos suyos).
    if (!finishedNaturally && durationSeconds < MIN_SESSION_SECONDS && loggedInSessionRef.current === 0) return

    onSessionEndRef.current?.({
      id: s.id,
      startedAt: new Date(s.startedAtMs).toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds,
      kind: s.kind,
      routineId: s.routineId,
      routineName: s.routineName,
      rounds,
      completed: finishedNaturally || s.kind === "stopwatch",
      ...(heart ?? {}),
    })
  }, [])

  // Cargar rutina desde la pestaña Rutinas.
  useEffect(() => {
    if (preloadedRoutine) setMode("routine")
  }, [preloadedRoutine])

  // Cualquier cambio de plan reinicia el reloj. Si había una sesión en curso, se cierra antes.
  useEffect(() => {
    finalizeSession()
    const fresh = createInitialState()
    engineRef.current = fresh
    setEngine(fresh)
    setIsRunning(false)
    setPending([])
  }, [plan, finalizeSession])

  // Aplica un nuevo estado del motor y dispara los avisos. Sin efectos dentro de setState.
  const commit = useCallback(
    (next: EngineState, withSound: boolean) => {
      const prev = engineRef.current
      engineRef.current = next
      setEngine(next)
      // Rutinas: cada serie de trabajo que se completa queda "pendiente de registrar" (peso y reps que confirme el usuario).
      if (mode === "routine" && preloadedRoutine) {
        const done = completedWorkIndices(plan, prev, next)
        const sessionId = sessionRef.current?.id ?? lastSessionIdRef.current
        if (done.length > 0 && sessionId) {
          const added: PendingSet[] = []
          for (const index of done) {
            const seg = plan[index]
            const block = preloadedRoutine.exercises[seg.exerciseIndex]
            if (!block) continue
            added.push({
              key: `${sessionId}:${index}`,
              sessionId,
              exerciseId: block.exerciseId,
              exerciseName: block.exerciseName,
              setNumber: seg.round,
              totalSets: seg.totalRounds,
              isTime: block.isTime,
              plannedReps: block.reps,
            })
          }
          if (added.length > 0) setPending((queue) => [...queue, ...added.filter((a) => !queue.some((q) => q.key === a.key))])
        }
      }
      if (withSound) {
        const signal = describeTransition(plan, prev, next)
        if (signal) playSignal(signal)
      }
      if (next.finished) {
        if (!prev.finished) finalizeSession(true)
        setIsRunning(false)
      }
    },
    [plan, finalizeSession, mode, preloadedRoutine]
  )

  // Bucle del reloj: mide tiempo REAL entre ticks (no cuenta ticks), así no se atrasa.
  useEffect(() => {
    if (!isRunning) return
    lastTickRef.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now

      // Pulso: el tiempo que pasó desde el tick anterior se atribuye al último pulso válido del sensor.
      // Va ANTES de commit: si este tick termina la sesión, esa última fracción debe entrar en el resumen.
      const bpm = bpmRef.current
      const active = sessionRef.current
      if (active && bpm !== null) active.heart = addHeartSample(active.heart, bpm, delta)

      commit(advance(plan, engineRef.current, delta), true)

      const session = sessionRef.current
      if (session && now - session.lastCheckpointMs >= CHECKPOINT_EVERY_MS) {
        session.lastCheckpointMs = now
        writeCheckpoint()
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [isRunning, plan, commit, writeCheckpoint])

  // Mantener la pantalla encendida mientras corre (y recuperar el bloqueo al volver a la app).
  useEffect(() => {
    if (!isRunning || typeof navigator === "undefined" || !("wakeLock" in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (sentinel && !sentinel.released) return
      try {
        const s = await navigator.wakeLock.request("screen")
        if (cancelled) {
          void s.release()
          return
        }
        sentinel = s
      } catch {
        // Batería baja o permiso denegado: el reloj sigue funcionando igual.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire()
    }

    void acquire()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisible)
      void sentinel?.release()
    }
  }, [isRunning])

  // Format time as MM:SS or just SS for short times
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return secs.toString().padStart(2, '0')
  }, [])

  const handlePlayPause = () => {
    if (isRunning) {
      setIsRunning(false)
      writeCheckpoint()
      return
    }
    if (!hasPlan) return
    unlockAudio() // debe ir aquí, dentro del gesto del usuario
    if (engine.finished) {
      const fresh = createInitialState()
      engineRef.current = fresh
      setEngine(fresh)
    }
    if (!sessionRef.current) {
      const now = Date.now()
      sessionRef.current = {
        id: newSessionId(),
        startedAtMs: now,
        kind: mode,
        routineId: mode === "routine" ? preloadedRoutine?.id : undefined,
        routineName: mode === "routine" ? preloadedRoutine?.name : undefined,
        plan,
        lastCheckpointMs: now,
        heart: emptyHeart(),
      }
      loggedInSessionRef.current = 0
      setPending([])
      writeCheckpoint()
    }
    setIsRunning(true)
  }

  // Saltar: pasa al siguiente segmento. En una serie por repeticiones funciona como "listo".
  const handleSkip = () => {
    if (mode === "stopwatch" || !hasPlan || engine.finished) return
    commit(skipSegment(plan, engineRef.current), isRunning)
    if (!engineRef.current.finished) writeCheckpoint()
  }

  const handleReset = () => {
    finalizeSession() // antes de borrar el estado: aquí se registra lo entrenado hasta ahora
    const fresh = createInitialState()
    engineRef.current = fresh
    setEngine(fresh)
    setIsRunning(false)
    setPending([])
  }

  const handleClearRoutine = () => {
    onClearRoutine?.()
    setMode("tabata")
    handleReset()
  }

  // ---- Registro de series ----
  useEffect(() => {
    if (!savedNotice) return
    const id = setTimeout(() => setSavedNotice(null), 3500)
    return () => clearTimeout(id)
  }, [savedNotice])

  const currentPending = pending[0]
  const suggestion = currentPending
    ? suggestSet(sets, { exerciseId: currentPending.exerciseId, isTime: currentPending.isTime, reps: currentPending.plannedReps })
    : { weightKg: 0, reps: null }

  const handleSaveSet = (entry: { weightKg: number; reps: number | null }) => {
    if (!currentPending) return
    const set = makeSet(
      { sessionId: currentPending.sessionId, exerciseId: currentPending.exerciseId, exerciseName: currentPending.exerciseName, setNumber: currentPending.setNumber, weightKg: entry.weightKg, reps: currentPending.isTime ? null : entry.reps },
      new Date()
    )
    if (!set) return // los campos no eran válidos: el botón ya está deshabilitado, esto es solo una red de seguridad
    const records = detectRecords(sets, set) // se compara ANTES de guardarla
    onLogSet(set)
    loggedInSessionRef.current += 1
    setPending((queue) => queue.slice(1))
    setSavedNotice(records.weight ? `¡Récord de peso! ${formatKg(set.weightKg)} kg` : records.setVolume ? "¡Mejor serie por volumen!" : "Serie guardada")
  }

  const handleSkipSet = () => setPending((queue) => queue.slice(1))

  // ---- Derivados para pintar la pantalla ----
  const totalSeconds = Math.floor(engine.totalElapsedMs / 1000)
  const isOpenSegment = mode !== "stopwatch" && segment?.duration === null
  const displayTime = (() => {
    if (mode === "stopwatch") return totalSeconds
    if (!segment) return 0
    const left = remainingSeconds(segment, engine.segElapsedMs)
    return left ?? Math.floor(engine.segElapsedMs / 1000) // abierto: cuenta hacia arriba
  })()
  // Tamaño del número: 120px como máximo, pero sin salirse de la pantalla (ancho de la app: 32rem)
  // ni ocupar más de ~17% de la altura (así "Iniciar" no queda bajo la barra en móviles bajos).
  const timeText = formatTime(displayTime)
  const timeEm = [...timeText].reduce((w, ch) => w + (ch === ":" ? 0.3 : 0.62), 0) * 1.08
  const timeFontSize = `min(120px, ${pending.length > 0 ? 12 : 17}dvh, calc((min(100vw, 32rem) - 2.5rem) / ${timeEm.toFixed(2)}))`
  const currentExercise =
    mode === "routine" && preloadedRoutine && segment
      ? preloadedRoutine.exercises[segment.exerciseIndex]
      : undefined

  const visualPhase: VisualPhase = engine.finished ? "done" : mode === "stopwatch" ? "work" : segment?.phase ?? "prepare"

  const getPhaseColor = () => {
    if (visualPhase === "done") return "text-green-400"
    if (visualPhase === "prepare") return "text-yellow-400"
    if (visualPhase === "rest") return "text-red-500"
    return "text-cyan-400"
  }

  const getPhaseBgGlow = () => {
    if (visualPhase === "done") return "shadow-[0_0_120px_30px_rgba(74,222,128,0.15)]"
    if (visualPhase === "prepare") return "shadow-[0_0_120px_30px_rgba(250,204,21,0.15)]"
    if (visualPhase === "rest") return "shadow-[0_0_120px_30px_rgba(239,68,68,0.15)]"
    return "shadow-[0_0_120px_30px_rgba(34,211,238,0.15)]"
  }

  const getPhasePill = () => {
    if (visualPhase === "done") return "bg-green-500/20 text-green-400"
    if (visualPhase === "prepare") return "bg-yellow-500/20 text-yellow-400"
    if (visualPhase === "rest") return "bg-red-500/20 text-red-400"
    return "bg-cyan-500/20 text-cyan-400"
  }

  const getPhaseGlow = () => {
    if (visualPhase === "done") return "0 0 60px rgba(74,222,128,0.5)"
    if (visualPhase === "rest") return "0 0 60px rgba(239,68,68,0.5)"
    if (visualPhase === "prepare") return "0 0 60px rgba(250,204,21,0.5)"
    return "0 0 60px rgba(34,211,238,0.5)"
  }

  const getPhaseLabel = () => {
    if (visualPhase === "done") return "TERMINADO"
    if (mode === "stopwatch") return "CRONÓMETRO"
    if (visualPhase === "prepare") return "PREPARADO"
    if (visualPhase === "rest") return "DESCANSO"
    return "TRABAJO"
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-nav">
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-y-2 px-4 pt-top pb-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">POWERLOCK</h1>
          <p className="text-xs text-muted-foreground">Timer Pro</p>
        </div>

        <div className="flex items-center gap-2">
          {mode === "routine" && preloadedRoutine && (
            <button
              onClick={handleClearRoutine}
              aria-label="Salir de la rutina"
              className="w-10 h-10 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="px-3 py-1.5 rounded-lg bg-secondary/80 text-xs font-medium text-muted-foreground">
            {formatTime(totalSeconds)} total
          </div>
          <button
            onClick={onOpenSettings}
            aria-label="Sonido y vibración"
            className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sensor de pulso (Bluetooth): solo muestra datos si un sensor real los envía */}
      <div className="px-4 mb-3">
        <HeartRatePill heartRate={heartRate} />
      </div>

      {/* Routine Info Banner */}
      {mode === "routine" && preloadedRoutine && (
        <div className="px-4 mb-4">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Dumbbell className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground truncate">{preloadedRoutine.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {preloadedRoutine.exercises.length === 0
                    ? "Sin ejercicios"
                    : `Ejercicio ${(segment?.exerciseIndex ?? 0) + 1} de ${preloadedRoutine.exercises.length}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{preloadedRoutine.estimatedDuration}</p>
                <p className="text-xs text-muted-foreground">min</p>
              </div>
            </div>
            {currentExercise && (
              <div className="mt-3 pt-3 border-t border-primary/20">
                <p className="text-sm text-muted-foreground">Ejercicio actual:</p>
                <p className="font-semibold text-foreground">{currentExercise.exerciseName}</p>
                <p className="text-xs text-primary">
                  {currentExercise.sets} series x{" "}
                  {currentExercise.isTime
                    ? `${currentExercise.duration ?? currentExercise.reps}s`
                    : `${currentExercise.reps} reps`
                  } | Descanso: {currentExercise.restTime}s
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode Selector - hidden when routine is active */}
      {mode !== "routine" && (
        <div className="px-4 mb-6">
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-2xl">
            {(Object.keys(modeConfigs) as Exclude<TimerMode, "routine">[]).map((m) => {
              const Icon = m === "tabata" ? Zap : m === "emom" ? Timer : m === "fgb" ? RefreshCw : Clock
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] leading-tight font-semibold transition-all ${mode === m
                      ? "bg-neon-cyan text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="max-w-full truncate">{modeConfigs[m].name}</span>
                </button>
              )
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            {modeConfigs[mode].description}
          </p>
        </div>
      )}

      {/* Main Timer Display */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2">
        {/* Phase Label */}
        <div className={`mb-4 px-4 py-1.5 rounded-full text-sm font-bold tracking-wider ${getPhasePill()}`}>
          {getPhaseLabel()}
        </div>

        {/* Timer */}
        <div className={`relative ${getPhaseBgGlow()} rounded-full transition-all duration-500`}>
          <div className="relative">
            <span className={`block max-w-full whitespace-nowrap leading-none font-black tabular-nums tracking-tight ${getPhaseColor()} transition-colors duration-300`}
              data-testid="time-display"
              style={{
                fontSize: timeFontSize,
                fontVariantNumeric: "tabular-nums",
                textShadow: getPhaseGlow()
              }}
            >
              {timeText}
            </span>
          </div>
        </div>

        {/* Round Counter */}
        {mode !== "stopwatch" && (
          <div className="mt-6 flex items-center gap-4">
            <span className="text-muted-foreground text-sm font-medium">Ronda</span>
            <div className="flex items-center gap-2">
              {Array.from({ length: segment?.totalRounds ?? 1 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i < (segment?.round ?? 1)
                      ? "bg-neon-cyan scale-110"
                      : "bg-secondary"
                    }`}
                />
              ))}
            </div>
            <span className="text-foreground font-bold">{segment?.round ?? 1}/{segment?.totalRounds ?? 1}</span>
          </div>
        )}

        {/* Total Time */}
        <div className="mt-4 text-muted-foreground text-sm">
          Tiempo total: <span className="text-foreground font-semibold">{formatTime(totalSeconds)}</span>
        </div>
        {isOpenSegment && visualPhase === "work" && (
          <p className="mt-3 text-xs text-primary">Toca ⏭ cuando termines la serie</p>
        )}
      </div>

      {/* Registro de la serie que acabas de terminar: solo se guarda lo que confirmes */}
      {mode === "routine" && (pending.length > 0 || savedNotice) && (
        <div className="px-4 mb-4 space-y-2">
          {savedNotice && (
            <p role="status" className="rounded-xl bg-primary/10 px-4 py-2.5 text-center text-sm font-semibold text-primary" data-testid="set-saved">
              {savedNotice}
            </p>
          )}
          <SetLogCard pending={pending} suggestion={suggestion} onSave={handleSaveSet} onSkip={handleSkipSet} />
        </div>
      )}

      {/* Controls */}
      <div className="px-4 pb-6">
        <div className="relative flex items-center justify-center gap-4">
          {/* Reset */}
          <button
            onClick={handleReset}
            aria-label="Reiniciar"
            className="w-16 h-16 rounded-2xl bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          >
            <RefreshCw className="w-6 h-6" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            disabled={!hasPlan}
            aria-label={isRunning ? "Pausar" : "Iniciar"}
            className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isRunning
                ? "bg-red-500 hover:bg-red-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                : "bg-neon-cyan hover:bg-neon-cyan/90 text-primary-foreground shadow-[0_0_30px_color-mix(in_oklab,var(--neon-cyan)_40%,transparent)]"
            }`}
          >
            {isRunning ? (
              <Pause className="w-9 h-9" fill="currentColor" />
            ) : (
              <Play className="w-9 h-9 ml-1" fill="currentColor" />
            )}
          </button>

          {/* Next Block / "Listo" */}
          <button
            onClick={handleSkip}
            disabled={mode === "stopwatch" || !hasPlan || engine.finished}
            aria-label="Siguiente"
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${mode === "stopwatch" || !hasPlan || engine.finished
                ? "bg-secondary/40 text-muted-foreground/50 cursor-not-allowed"
                : "bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>
      </div>
      
    </div>
  )
}
