"use client"

import { useState, useCallback } from "react"
import { BottomNavigation } from "@/components/bottom-navigation"
import { WorkoutTimer } from "@/components/workout-timer"
import { RoutinesScreen } from "@/components/routines-screen"
import { HistoryScreen } from "@/components/history-screen"
import { TriangleAlert, X } from "lucide-react"
import { useRoutines } from "@/hooks/use-routines"
import { useSessions } from "@/hooks/use-sessions"
import type { SavedRoutine } from "@/lib/types"
import { SoundSettingsModal } from "@/components/sound-settings-modal"
import { useSettings } from "@/hooks/use-settings"

export default function FitnessApp() {
  const [activeTab, setActiveTab] = useState("entrenar")
  const routinesStore = useRoutines()
  const sessionsStore = useSessions()
  const { routines: misRutinas, addRoutine, updateRoutine, deleteRoutine } = routinesStore

  // Un solo aviso de almacenamiento para rutinas e historial.
  const saveFailed = routinesStore.saveFailed || sessionsStore.saveFailed
  const notice = routinesStore.notice ?? sessionsStore.notice
  const dismissNotice = () => {
    routinesStore.dismissNotice()
    sessionsStore.dismissNotice()
  }
  const [activeRoutine, setActiveRoutine] = useState<SavedRoutine | null>(null)
  const { settings, updateSettings } = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  
  // Handle playing a routine - navigate to timer with preloaded routine
  const handlePlayRoutine = useCallback((routine: SavedRoutine) => {
    setActiveRoutine(routine)
    setActiveTab("entrenar")
  }, [])
  
  return (
    <div className="min-h-screen bg-background">
      {(saveFailed || notice) && (
        <div
          role="alert"
          data-testid="storage-warning"
          className="fixed top-2 inset-x-3 z-[60] flex items-start gap-3 rounded-2xl bg-yellow-500/15 border border-yellow-500/40 p-3 backdrop-blur"
        >
          <TriangleAlert className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-yellow-100">
            {saveFailed
              ? "No se pudo guardar en este navegador (¿modo privado o memoria llena?). Tus rutinas se perderán al cerrar la app."
              : notice}
          </p>
          {!saveFailed && (
            <button onClick={dismissNotice} aria-label="Cerrar aviso" className="text-yellow-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {/* Main Content */}
      {/* Siempre montado: si se desmontara al cambiar de pestaña, se perdería el entrenamiento en curso. */}
      <div className={activeTab === "entrenar" ? "" : "hidden"}>
        <WorkoutTimer 
          preloadedRoutine={activeRoutine}
          onClearRoutine={() => setActiveRoutine(null)}
          onOpenSettings={() => setShowSettings(true)}
          onSessionEnd={sessionsStore.recordSession}
          onCheckpoint={sessionsStore.saveCheckpoint}
        />
      </div>
      
      {activeTab === "rutinas" && (
        <RoutinesScreen 
          routines={misRutinas}
          onAddRoutine={addRoutine}
          onUpdateRoutine={updateRoutine}
          onDeleteRoutine={deleteRoutine}
          onPlayRoutine={handlePlayRoutine}
        />
      )}
      
      {activeTab === "historial" && (
        <HistoryScreen sessions={sessionsStore.sessions} onDeleteSession={sessionsStore.deleteSession} />
      )}
      
      <SoundSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onChange={updateSettings}
      />

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
