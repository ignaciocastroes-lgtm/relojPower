"use client"

import { useState, useMemo } from "react"
import { Search, X, Filter, Dumbbell, Target, Play } from "lucide-react"
import { exerciseDatabase, bodyParts, equipmentTypes, type ExerciseDBItem } from "@/lib/exercise-db"
import { cn } from "@/lib/utils"
import { VideoDemoModal } from "./video-demo-modal"
import { ExerciseThumb } from "./exercise-thumb"

interface ExerciseLibraryProps {
  /** Si se pasa, tocar un ejercicio lo elige (modo selector). Si no, abre su demo en video. */
  onSelectExercise?: (exercise: ExerciseDBItem) => void
  /** "page": pestaña Biblioteca (con título). "picker": dentro del creador (el padre pone el título y el scroll). */
  variant?: "page" | "picker"
}

export function ExerciseLibrary({ onSelectExercise, variant = "page" }: ExerciseLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBodyParts, setSelectedBodyParts] = useState<string[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [demoExercise, setDemoExercise] = useState<ExerciseDBItem | null>(null)
  
  const filteredExercises = useMemo(() => {
    return exerciseDatabase.filter((exercise) => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.bodyPart.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.equipment.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Body part filter
      const matchesBodyPart = selectedBodyParts.length === 0 || 
        selectedBodyParts.includes(exercise.bodyPart)
      
      // Equipment filter
      const matchesEquipment = selectedEquipment.length === 0 || 
        selectedEquipment.includes(exercise.equipment)
      
      return matchesSearch && matchesBodyPart && matchesEquipment
    })
  }, [searchQuery, selectedBodyParts, selectedEquipment])
  
  const toggleBodyPart = (bodyPart: string) => {
    setSelectedBodyParts(prev => 
      prev.includes(bodyPart) 
        ? prev.filter(bp => bp !== bodyPart)
        : [...prev, bodyPart]
    )
  }
  
  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment(prev => 
      prev.includes(equipment) 
        ? prev.filter(eq => eq !== equipment)
        : [...prev, equipment]
    )
  }
  
  const clearFilters = () => {
    setSelectedBodyParts([])
    setSelectedEquipment([])
    setSearchQuery("")
  }
  
  const activeFiltersCount = selectedBodyParts.length + selectedEquipment.length

  const handleCardClick = (exercise: ExerciseDBItem) => {
    if (onSelectExercise) onSelectExercise(exercise)
    else if (exercise.videoId) setDemoExercise(exercise)
  }
  
  // Get badge color based on body part
  const getBodyPartColor = (bodyPart: string) => {
    const colors: Record<string, string> = {
      "Glúteos": "bg-pink-500/20 text-pink-400",
      "Cuádriceps": "bg-orange-500/20 text-orange-400",
      "Espalda": "bg-blue-500/20 text-blue-400",
      "Pectoral": "bg-red-500/20 text-red-400",
      "Hombros": "bg-yellow-500/20 text-yellow-400",
      "Bíceps": "bg-purple-500/20 text-purple-400",
      "Tríceps": "bg-indigo-500/20 text-indigo-400",
      "Core": "bg-green-500/20 text-green-400",
      "Isquiotibiales": "bg-teal-500/20 text-teal-400",
      "Piernas": "bg-orange-500/20 text-orange-400",
      "Cardio": "bg-rose-500/20 text-rose-400",
      "Cuerpo completo": "bg-emerald-500/20 text-emerald-400"
    }
    return colors[bodyPart] || "bg-muted text-muted-foreground"
  }
  
  // Get badge color based on equipment
  const getEquipmentColor = (equipment: string) => {
    const colors: Record<string, string> = {
      "Barra": "bg-slate-500/20 text-slate-300",
      "Mancuernas": "bg-zinc-500/20 text-zinc-300",
      "Máquina": "bg-neutral-500/20 text-neutral-300",
      "Kettlebell": "bg-amber-500/20 text-amber-400",
      "Banda Elástica": "bg-lime-500/20 text-lime-400",
      "Peso Corporal": "bg-cyan-500/20 text-cyan-400",
      "Cable": "bg-violet-500/20 text-violet-400",
      "Barra Smith": "bg-sky-500/20 text-sky-300",
      "Barra Olímpica": "bg-slate-500/20 text-slate-300",
      "Remadora": "bg-blue-500/20 text-blue-300",
      "Cuerda": "bg-fuchsia-500/20 text-fuchsia-300"
    }
    return colors[equipment] || "bg-muted text-muted-foreground"
  }
  
  return (
    <div className={cn("bg-background", variant === "page" ? "pb-fab" : "pb-8")}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="px-5 pt-4 pb-4">
          {variant === "page" && <h1 className="text-3xl font-bold text-foreground mb-1">Biblioteca</h1>}
          <p className="text-muted-foreground text-sm">
            {filteredExercises.length} ejercicios disponibles
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="px-5 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar ejercicios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-12 rounded-xl bg-secondary/70 border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Borrar búsqueda"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center"
              >
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </span>
              </button>
            )}
          </div>
        </div>
        
        {/* Filter Toggle */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              showFilters || activeFiltersCount > 0
                ? "bg-primary/20 text-primary"
                : "bg-secondary/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        
        {/* Filter Chips */}
        {showFilters && (
          <div className="pb-4 space-y-3">
            {/* Body Parts */}
            <div>
              <div className="px-5 mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Grupo Muscular
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto px-5 pb-2 scrollbar-hide">
                {bodyParts.map((bodyPart) => (
                  <button
                    key={bodyPart}
                    onClick={() => toggleBodyPart(bodyPart)}
                    className={cn(
                      "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                      selectedBodyParts.includes(bodyPart)
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {bodyPart}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Equipment */}
            <div>
              <div className="px-5 mb-2 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Equipo
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto px-5 pb-2 scrollbar-hide">
                {equipmentTypes.map((equipment) => (
                  <button
                    key={equipment}
                    onClick={() => toggleEquipment(equipment)}
                    className={cn(
                      "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                      selectedEquipment.includes(equipment)
                        ? "bg-accent text-accent-foreground shadow-lg shadow-accent/30"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {equipment}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Exercise Grid */}
      <div className="px-5 pt-4">
        {filteredExercises.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Sin resultados</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              No encontramos ejercicios con esos filtros. Prueba con otros criterios.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredExercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => handleCardClick(exercise)}
                className="group relative rounded-2xl bg-secondary/50 overflow-hidden text-left hover:bg-secondary/70 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {/* Exercise Image */}
                <div className="relative aspect-square overflow-hidden">
                  <ExerciseThumb
                    url={exercise.gifUrl}
                    name={exercise.name}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {exercise.videoId && (
                    <span
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                      aria-label="Tiene video de demostración"
                    >
                      <Play className="w-3.5 h-3.5 text-white" fill="currentColor" />
                    </span>
                  )}
                </div>
                
                {/* Exercise Info */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-bold text-foreground text-sm leading-tight mb-2 line-clamp-2">
                    {exercise.name}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium",
                      getBodyPartColor(exercise.bodyPart)
                    )}>
                      {exercise.bodyPart}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium",
                      getEquipmentColor(exercise.equipment)
                    )}>
                      {exercise.equipment}
                    </span>
                  </div>
                </div>
                
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-primary/30 transition-all pointer-events-none" />
              </button>
            ))}
          </div>
        )}
      </div>

      <VideoDemoModal
        isOpen={demoExercise !== null}
        onClose={() => setDemoExercise(null)}
        exerciseName={demoExercise?.name ?? ""}
        videoId={demoExercise?.videoId ?? ""}
      />
    </div>
  )
}
