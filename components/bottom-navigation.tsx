"use client"

import { Timer, ClipboardList, History } from "lucide-react"
import { cn } from "@/lib/utils"

interface BottomNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: "entrenar", label: "Reloj", icon: Timer },
  { id: "rutinas", label: "Rutinas", icon: ClipboardList },
  { id: "historial", label: "Historial", icon: History },
]

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50">
      <div className="flex items-center justify-around h-20 max-w-lg mx-auto px-2 pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 min-w-[72px]",
                isActive 
                  ? "text-neon-cyan" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                isActive && "bg-neon-cyan/10"
              )}>
                <Icon 
                  className={cn(
                    "w-6 h-6 transition-all duration-300",
                    isActive && "drop-shadow-[0_0_8px_var(--neon-cyan)]"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {isActive && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-neon-cyan shadow-[0_0_8px_var(--neon-cyan)]" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-all duration-300",
                isActive && "text-neon-cyan"
              )}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
