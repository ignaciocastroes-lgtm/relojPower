"use client"

import { useMemo, useState } from "react"
import {
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  Clock,
  Trash2,
  Save,
  Dumbbell,
  Timer,
  RotateCcw,
} from "lucide-react"
import type { ExerciseDBItem } from "@/lib/exercise-db"
import { estimateRoutineMinutes } from "@/lib/timer-engine"
import { newId } from "@/lib/routine-storage"
import type { ExerciseBlock, SavedRoutine } from "@/lib/types"
import { ExerciseLibrary } from "./exercise-library"
import { ExerciseThumb } from "./exercise-thumb"
import { cn } from "@/lib/utils"

export interface RoutineDraft {
  name: string
  description: string
  exercises: ExerciseBlock[]
}

interface RoutineTimelineBuilderProps {
  /** Si viene, el creador abre en modo edición con estos datos. El padre lo monta solo cuando hace falta. */
  initialRoutine?: SavedRoutine | null
  onClose: () => void
  onSave: (draft: RoutineDraft) => void
}

const restTimeOptions = [30, 45, 60, 90, 120, 180]

const SETS_MAX = 20
const REPS_MAX = 100
const DURATION_MIN = 5
const DURATION_MAX = 600
const DURATION_STEP = 5

function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

export function RoutineTimelineBuilder({ initialRoutine, onClose, onSave }: RoutineTimelineBuilderProps) {
  const [routineName, setRoutineName] = useState(initialRoutine?.name ?? "")
  const [routineDescription, setRoutineDescription] = useState(initialRoutine?.description ?? "")
  const [exercises, setExercises] = useState<ExerciseBlock[]>(initialRoutine?.exercises ?? [])
  const [showExercisePicker, setShowExercisePicker] = useState(false)

  const isEditing = Boolean(initialRoutine)
  const estimatedMinutes = useMemo(() => estimateRoutineMinutes(exercises), [exercises])
  const canSave = routineName.trim() !== "" && exercises.length > 0

  const isDirty = useMemo(() => {
    const before = JSON.stringify([initialRoutine?.name ?? "", initialRoutine?.description ?? "", initialRoutine?.exercises ?? []])
    const now = JSON.stringify([routineName, routineDescription, exercises])
    return before !== now
  }, [initialRoutine, routineName, routineDescription, exercises])

  const requestClose = () => {
    if (isDirty && !window.confirm("¿Descartar los cambios de esta rutina?")) return
    onClose()
  }

  const handleAddExercise = (item: ExerciseDBItem) => {
    const block: ExerciseBlock = {
      id: newId("block"),
      exerciseId: item.id,
      exerciseName: item.name,
      bodyPart: item.bodyPart,
      equipment: item.equipment,
      imageUrl: item.gifUrl,
      sets: 3,
      reps: 12,
      restTime: 60,
      isTime: false,
      duration: 30,
    }
    setExercises((prev) => [...prev, block])
    setShowExercisePicker(false)
  }

  const updateBlock = (blockId: string, updates: Partial<ExerciseBlock>) => {
    setExercises((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b)))
  }

  const deleteBlock = (blockId: string) => {
    setExercises((prev) => prev.filter((b) => b.id !== blockId))
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    setExercises((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({ name: routineName.trim(), description: routineDescription.trim(), exercises })
  }

  /* ---------------------------- Selector de ejercicio ---------------------------- */
  if (showExercisePicker) {
    return (
      <div className="fixed inset-0 z-[60] bg-background">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col">
        <header className="shrink-0 border-b border-border/50 bg-background">
          <div className="flex items-center justify-between px-5 pt-top pb-4">
            <button
              onClick={() => setShowExercisePicker(false)}
              aria-label="Volver a la rutina"
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="text-lg font-bold text-foreground">Seleccionar Ejercicio</h2>
            <div className="w-10" />
          </div>
        </header>

        {/* Este contenedor es el que hace scroll (antes el listado quedaba cortado). */}
        <div className="flex-1 overflow-y-auto" data-testid="picker-scroll">
          <ExerciseLibrary variant="picker" onSelectExercise={handleAddExercise} />
        </div>
      </div>
      </div>
    )
  }

  /* ------------------------------ Editor de rutina ------------------------------ */
  return (
    <div className="fixed inset-0 z-[60] bg-background">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col">
      <header className="shrink-0 border-b border-border/50 bg-background">
        <div className="flex items-center justify-between px-5 pt-top pb-4">
          <button
            onClick={requestClose}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-lg font-bold text-foreground">{isEditing ? "Editar Rutina" : "Crear Rutina"}</h2>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">
        {/* Datos de la rutina */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Nombre de la rutina</label>
            <input
              type="text"
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
              placeholder="Ej: Push Day - Pecho y Hombros"
              className="w-full h-12 px-4 rounded-xl bg-secondary/70 border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Descripción (opcional)</label>
            <input
              type="text"
              value={routineDescription}
              onChange={(e) => setRoutineDescription(e.target.value)}
              placeholder="Ej: Entrenamiento de empuje para hipertrofia"
              className="w-full h-12 px-4 rounded-xl bg-secondary/70 border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Duración estimada: misma fórmula que ejecuta el reloj */}
        {exercises.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duración estimada</p>
                  <p className="text-lg font-bold text-foreground" data-testid="estimate">
                    {estimatedMinutes} min
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Ejercicios</p>
                <p className="text-lg font-bold text-primary">{exercises.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ejercicios */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ejercicios</h3>
            {exercises.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("¿Quitar todos los ejercicios?")) setExercises([])
                }}
                className="px-2 py-2 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>

          {exercises.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-secondary/30 border-2 border-dashed border-border">
              <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
                <Dumbbell className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No hay ejercicios en tu rutina</p>
              <button
                onClick={() => setShowExercisePicker(true)}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Añadir Ejercicio
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20" />

              <div className="space-y-4">
                {exercises.map((block, index) => {
                  const restOptions = restTimeOptions.includes(block.restTime)
                    ? restTimeOptions
                    : [...restTimeOptions, block.restTime].sort((a, b) => a - b)
                  return (
                    <div key={block.id} className="relative flex gap-3" data-testid="exercise-block">
                      {/* Nodo con número */}
                      <div className="flex flex-col items-center z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                          {index + 1}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 bg-secondary/70 rounded-2xl overflow-hidden border border-border/50">
                        {/* Cabecera del bloque */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 bg-secondary/50">
                          <ExerciseThumb url={block.imageUrl} name={block.exerciseName} className="w-12 h-12 rounded-lg flex-shrink-0" />

                          <div className="flex-1 min-w-[7rem]">
                            <h4 className="font-semibold text-foreground truncate">{block.exerciseName}</h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {[block.bodyPart, block.equipment].filter(Boolean).join(" • ")}
                            </p>
                          </div>

                          {/* Reordenar y borrar */}
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              onClick={() => moveBlock(index, -1)}
                              disabled={index === 0}
                              aria-label="Subir ejercicio"
                              className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveBlock(index, 1)}
                              disabled={index === exercises.length - 1}
                              aria-label="Bajar ejercicio"
                              className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteBlock(block.id)}
                              aria-label="Eliminar ejercicio"
                              className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Controles */}
                        <div className="p-4 space-y-4">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
                            {/* Series */}
                            <div className="flex-1 min-w-[8.5rem]">
                              <label className="block text-xs text-muted-foreground mb-1.5">Series</label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateBlock(block.id, { sets: Math.max(1, block.sets - 1) })}
                                  aria-label="Menos series"
                                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
                                >
                                  -
                                </button>
                                <span className="w-10 text-center font-bold text-foreground text-lg" data-testid="sets-value">
                                  {block.sets}
                                </span>
                                <button
                                  onClick={() => updateBlock(block.id, { sets: Math.min(SETS_MAX, block.sets + 1) })}
                                  aria-label="Más series"
                                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Repeticiones o segundos */}
                            <div className="flex-1 min-w-[8.5rem]">
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-muted-foreground">
                                  {block.isTime ? "Segundos" : "Reps"}
                                </label>
                                <button
                                  onClick={() => updateBlock(block.id, { isTime: !block.isTime })}
                                  className="px-2 py-2 text-xs text-primary hover:underline"
                                >
                                  {block.isTime ? "Usar reps" : "Usar tiempo"}
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    updateBlock(
                                      block.id,
                                      block.isTime
                                        ? { duration: Math.max(DURATION_MIN, block.duration - DURATION_STEP) }
                                        : { reps: Math.max(1, block.reps - 1) }
                                    )
                                  }
                                  aria-label={block.isTime ? "Menos segundos" : "Menos repeticiones"}
                                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
                                >
                                  -
                                </button>
                                <span className="w-10 text-center font-bold text-foreground text-lg" data-testid="amount-value">
                                  {block.isTime ? block.duration : block.reps}
                                </span>
                                <button
                                  onClick={() =>
                                    updateBlock(
                                      block.id,
                                      block.isTime
                                        ? { duration: Math.min(DURATION_MAX, block.duration + DURATION_STEP) }
                                        : { reps: Math.min(REPS_MAX, block.reps + 1) }
                                    )
                                  }
                                  aria-label={block.isTime ? "Más segundos" : "Más repeticiones"}
                                  className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Descanso */}
                          <div>
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                              <Clock className="w-3.5 h-3.5" />
                              Descanso entre series
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              {restOptions.map((time) => (
                                <button
                                  key={time}
                                  onClick={() => updateBlock(block.id, { restTime: time })}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                    block.restTime === time
                                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                                  )}
                                >
                                  {formatRest(time)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="relative mt-4 flex gap-3">
                <div className="flex flex-col items-center z-10">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 border-2 border-dashed border-primary/30 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary/50" />
                  </div>
                </div>
                <button
                  onClick={() => setShowExercisePicker(true)}
                  className="flex-1 py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Añadir Ejercicio
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-border/50 bg-background">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all",
            canSave
              ? "bg-neon-green text-background shadow-lg shadow-neon-green/30 hover:shadow-neon-green/50"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Save className="w-5 h-5" />
          {isEditing ? "Guardar cambios" : "Guardar rutina"}
        </button>
      </div>
    </div>
      </div>
  )
}
