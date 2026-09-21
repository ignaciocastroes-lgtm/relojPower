"use client"

import { CheckCircle2, Circle, Flame } from "lucide-react"

interface WeekProgressProps {
  completedDays: number
  totalDays: number
  currentStreak: number
}

export function WeekProgress({ completedDays, totalDays, currentStreak }: WeekProgressProps) {
  const days = ["L", "M", "X", "J", "V", "S", "D"]
  const progressPercentage = (completedDays / totalDays) * 100
  
  return (
    <div className="bg-secondary/50 rounded-3xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-muted-foreground text-sm font-medium">Tu Semana</p>
          <p className="text-foreground text-lg font-semibold">
            Día {completedDays} de {totalDays} completado
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-neon-cyan/10 px-3 py-1.5 rounded-full">
          <Flame className="w-4 h-4 text-neon-cyan" />
          <span className="text-neon-cyan text-sm font-semibold">{currentStreak}</span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-neon-cyan to-neon-green rounded-full transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Day indicators */}
      <div className="flex items-center justify-between">
        {days.map((day, index) => {
          const isCompleted = index < completedDays
          const isCurrent = index === completedDays
          
          return (
            <div key={day} className="flex flex-col items-center gap-1.5">
              <div className="relative">
                {isCompleted ? (
                  <CheckCircle2 className="w-7 h-7 text-neon-cyan drop-shadow-[0_0_6px_var(--neon-cyan)]" />
                ) : isCurrent ? (
                  <div className="w-7 h-7 rounded-full border-2 border-neon-cyan bg-neon-cyan/20 flex items-center justify-center animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-neon-cyan" />
                  </div>
                ) : (
                  <Circle className="w-7 h-7 text-muted-foreground/50" />
                )}
              </div>
              <span className={`text-xs font-medium ${
                isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground/50"
              }`}>
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
