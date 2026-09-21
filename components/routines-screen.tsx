"use client"

import { useState } from "react"
import { Plus, Play, MoreVertical, Clock, Dumbbell, Trash2, Edit3, Copy, BookOpen, ClipboardList } from "lucide-react"
import { ExerciseLibrary } from "./exercise-library"
import { RoutineTimelineBuilder, type RoutineDraft } from "./routine-timeline-builder"
import { estimateRoutineMinutes } from "@/lib/timer-engine"
import { newId } from "@/lib/routine-storage"
import { cn } from "@/lib/utils"
import type { SavedRoutine } from "@/lib/types"

interface RoutinesScreenProps {
  routines: SavedRoutine[]
  onAddRoutine: (routine: SavedRoutine) => void
  onUpdateRoutine: (routine: SavedRoutine) => void
  onDeleteRoutine: (routineId: string) => void
  onPlayRoutine: (routine: SavedRoutine) => void
}

type TabView = "routines" | "library"

/** null = creador cerrado; { routine: null } = crear nueva; { routine } = editar. */
type BuilderState = { routine: SavedRoutine | null } | null

export function RoutinesScreen({
  routines,
  onAddRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onPlayRoutine,
}: RoutinesScreenProps) {
  const [activeTab, setActiveTab] = useState<TabView>("routines")
  const [builder, setBuilder] = useState<BuilderState>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const openNew = () => setBuilder({ routine: null })

  const handleBuilderSave = (draft: RoutineDraft) => {
    const estimatedDuration = estimateRoutineMinutes(draft.exercises)
    if (builder?.routine) {
      onUpdateRoutine({ ...builder.routine, ...draft, estimatedDuration })
    } else {
      onAddRoutine({
        id: newId("routine"),
        ...draft,
        createdAt: new Date(),
        estimatedDuration,
      })
    }
    setBuilder(null)
    setActiveTab("routines")
  }

  const handleEditRoutine = (routine: SavedRoutine) => {
    setActiveMenu(null)
    setBuilder({ routine })
  }

  const handleDuplicateRoutine = (routine: SavedRoutine) => {
    onAddRoutine({
      ...routine,
      id: newId("routine"),
      name: `${routine.name} (copia)`,
      createdAt: new Date(),
      exercises: routine.exercises.map((ex) => ({ ...ex, id: newId("block") })),
    })
    setActiveMenu(null)
  }

  const handleDeleteRoutine = (routine: SavedRoutine) => {
    setActiveMenu(null)
    if (window.confirm(`¿Eliminar la rutina "${routine.name}"?`)) onDeleteRoutine(routine.id)
  }

  return (
    <>
      {/* La barra de pestañas queda FUERA del scroll: nada se le desliza por debajo. */}
      <div className="h-dvh flex flex-col">
        <div className="shrink-0 bg-background border-b border-border/50 pt-top px-5 pb-3">
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl">
            <button
              onClick={() => setActiveTab("library")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                activeTab === "library"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="w-4 h-4" />
              Biblioteca
            </button>
            <button
              onClick={() => setActiveTab("routines")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all",
                activeTab === "routines"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ClipboardList className="w-4 h-4" />
              Mis Rutinas
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "library" && <ExerciseLibrary variant="page" />}

          {activeTab === "routines" && (
            <div className="bg-background pb-fab">
              <div className="px-5 pt-4 pb-4">
                <h1 className="text-3xl font-bold text-foreground mb-1">Mis Rutinas</h1>
                <p className="text-muted-foreground">
                  {routines.length} {routines.length === 1 ? "rutina creada" : "rutinas creadas"}
                </p>
              </div>

              {routines.length > 0 && (
                <div className="px-5 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-secondary/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Dumbbell className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-2xl font-bold text-foreground">{routines.length}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Total Rutinas</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-secondary/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-2xl font-bold text-foreground">
                          {routines.reduce((acc, r) => acc + r.estimatedDuration, 0)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">Min totales</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-5">
                {routines.length === 0 ? (
                  <div className="text-center py-16" data-testid="empty-routines">
                    <div className="w-24 h-24 rounded-3xl bg-secondary mx-auto mb-6 flex items-center justify-center">
                      <Dumbbell className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Sin rutinas</h3>
                    <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                      Crea tu primera rutina personalizada para comenzar a entrenar
                    </p>
                    <button
                      onClick={openNew}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold inline-flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Crear Rutina
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routines.map((routine) => (
                      <div
                        key={routine.id}
                        data-testid="routine-card"
                        className="relative p-4 rounded-2xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0 max-[359px]:hidden">
                            <Dumbbell className="w-7 h-7 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-foreground text-lg truncate">{routine.name}</h3>
                            {routine.description && (
                              <p className="text-sm text-muted-foreground truncate">{routine.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {routine.estimatedDuration} min
                              </span>
                              <span>{routine.exercises.length} {routine.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onPlayRoutine(routine)}
                              aria-label={`Iniciar ${routine.name}`}
                              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setActiveMenu(activeMenu === routine.id ? null : routine.id)}
                                aria-label={`Más opciones de ${routine.name}`}
                                className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>

                              {activeMenu === routine.id && (
                                <>
                                  <div className="fixed inset-0 z-[45]" onClick={() => setActiveMenu(null)} />
                                  <div className="absolute right-0 top-12 z-50 w-48 rounded-xl bg-popover border border-border shadow-xl overflow-hidden">
                                    <button
                                      onClick={() => handleEditRoutine(routine)}
                                      className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateRoutine(routine)}
                                      className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3"
                                    >
                                      <Copy className="w-4 h-4" />
                                      Duplicar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRoutine(routine)}
                                      className="w-full px-4 py-3 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-3"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Eliminar
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón flotante: un solo camino para crear, en ambas pestañas. */}
      {/* Con la lista vacía ya hay un botón "Crear Rutina" en pantalla: el flotante se pisaría con él. */}
      {!builder && !(activeTab === "routines" && routines.length === 0) && (
        <button
          onClick={openNew}
          aria-label="Crear rutina"
          className="fixed bottom-nav right-shell px-5 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-transform z-30 font-semibold"
        >
          <Plus className="w-6 h-6" />
          Crear Rutina
        </button>
      )}

      {builder && (
        <RoutineTimelineBuilder
          key={builder.routine?.id ?? "new"}
          initialRoutine={builder.routine}
          onClose={() => setBuilder(null)}
          onSave={handleBuilderSave}
        />
      )}
    </>
  )
}
