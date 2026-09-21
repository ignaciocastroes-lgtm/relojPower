/**
 * Modelo único de rutinas. Lo produce el creador (RoutineTimelineBuilder),
 * se guarda en localStorage (lib/routine-storage.ts) y lo consume el reloj.
 */
export interface ExerciseBlock {
  id: string
  exerciseId: string
  exerciseName: string
  /** Copia de datos del catálogo para poder mostrar/editar sin depender de él. */
  bodyPart?: string
  equipment?: string
  imageUrl?: string
  sets: number
  reps: number
  restTime: number // segundos de descanso entre series
  isTime: boolean // true = cada serie dura `duration` s; false = por repeticiones
  duration: number // segundos por serie cuando isTime
}

export interface SavedRoutine {
  id: string
  name: string
  description: string
  exercises: ExerciseBlock[]
  createdAt: Date
  estimatedDuration: number // minutos
}
