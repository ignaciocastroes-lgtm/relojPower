"use client"

import { Clock, Zap, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface RoutineCardProps {
  title: string
  category: string
  duration: string
  intensity: "Baja" | "Media" | "Alta"
  exercises: number
  gradient: string
  icon: React.ReactNode
}

export function RoutineCard({ 
  title, 
  category, 
  duration, 
  intensity, 
  exercises,
  gradient,
  icon
}: RoutineCardProps) {
  const intensityColors = {
    Baja: "text-green-400",
    Media: "text-yellow-400",
    Alta: "text-orange-400"
  }
  
  return (
    <button className="group relative w-[260px] flex-shrink-0 text-left">
      <div className={cn(
        "relative h-[180px] rounded-3xl p-5 overflow-hidden transition-all duration-300",
        "bg-gradient-to-br",
        gradient,
        "group-hover:scale-[1.02] group-active:scale-[0.98]"
      )}>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 blur-xl translate-y-1/2 -translate-x-1/2" />
        
        {/* Icon */}
        <div className="absolute top-4 right-4 w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
          {icon}
        </div>
        
        {/* Content */}
        <div className="relative h-full flex flex-col justify-between">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1">
              {category}
            </span>
            <h3 className="text-lg font-bold text-white leading-tight pr-14">
              {title}
            </h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white/80">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{duration}</span>
              </div>
              <div className={cn("flex items-center gap-1", intensityColors[intensity])}>
                <Zap className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{intensity}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-white/60 text-xs">
              <span>{exercises} ejercicios</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
