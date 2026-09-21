"use client"

import { useState } from "react"
import { Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExerciseThumbProps {
  url?: string
  name: string
  /** Tamaño y forma; el contenedor siempre recorta la imagen. */
  className?: string
}

/**
 * Imagen de un ejercicio con respaldo. Las fotos son URLs externas que no controlamos
 * (Unsplash, miniaturas de YouTube): si una no carga se muestra un icono en vez de una
 * imagen rota. El estado se reinicia si cambia la URL.
 */
export function ExerciseThumb({ url, name, className }: ExerciseThumbProps) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)

  if (!url || brokenUrl === url) {
    return (
      <div className={cn("overflow-hidden bg-secondary flex items-center justify-center", className)}>
        <Dumbbell className="w-1/3 h-1/3 text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  const src: string = url
  return (
    <div className={cn("overflow-hidden bg-secondary flex items-center justify-center", className)}>
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={() => setBrokenUrl(src)}
      />
    </div>
  )
}
