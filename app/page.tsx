"use client"

import { useCallback, useState } from "react"
import { BottomNavigation } from "@/components/bottom-navigation"
import { WorkoutTimer } from "@/components/workout-timer"
import { RoutinesScreen } from "@/components/routines-screen"
import { HistoryScreen } from "@/components/history-screen"
import { ProgressScreen } from "@/components/progress-screen"
import { TriangleAlert, X } from "lucide-react"
import { useRoutines } from "@/hooks/use-routines"
import { useSessions } from "@/hooks/use-sessions"
import { useSetLogs } from "@/hooks/use-set-logs"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import type { SavedRoutine } from "@/lib/types"
import { SettingsModal } from "@/components/settings-modal"
import { useSettings } from "@/hooks/use-settings"
import { mergeBackups, type BackupData } from "@/lib/backup"

export default function FitnessApp() {
  const [activeTab, setActiveTab] = useState("entrenar")
  const routinesStore = useRoutines()
  const sessionsStore = useSessions()
  const setsStore = useSetLogs()
  const { routines: misRutinas, addRoutine, updateRoutine, deleteRoutine } = routinesStore
  const install = useInstallPrompt()

  // Un solo aviso de almacenamiento para rutinas, historial y series.
  const saveFailed = routinesStore.saveFailed || sessionsStore.saveFailed || setsStore.saveFailed
  const notice = routinesStore.notice ?? sessionsStore.notice ?? setsStore.notice
  const dismissNotice = () => {
    routinesStore.dismissNotice()
    sessionsStore.dismissNotice()
    setsStore.dismissNotice()
  }
  const [activeRoutine, setActiveRoutine] = useState<SavedRoutine | null>(null)
  const { settings, updateSettings } = useSettings()
  const [showSettings, setShowSettings] = useState(false)

  // Handle playing a routine - navigate to timer with preloaded routine
  const handlePlayRoutine = useCallback((routine: SavedRoutine) => {
    setActiveRoutine(routine)
    setActiveTab("entrenar")
  }, [])

  // Al borrar una sesión se borran también sus series (si no, quedarían huérfanas en Progreso).
  const handleDeleteSession = (id: string) => {
    sessionsStore.deleteSession(id)
    setsStore.removeForSession(id)
  }

  const getBackupData = (): BackupData => ({ routines: misRutinas, sessions: sessionsStore.sessions, sets: setsStore.sets, settings })
  const handleRestore = (incoming: BackupData, mode: "merge" | "replace") => {
    const next = mode === "merge" ? mergeBackups(getBackupData(), incoming) : incoming
    routinesStore.replaceAll(next.routines)
    sessionsStore.replaceAll(next.sessions)
    setsStore.replaceAll(next.sets)
    updateSettings(next.settings)
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-background">
      {(saveFailed || notice) && (
        <div
          role="alert"
          data-testid="storage-warning"
          className="sticky top-2 z-[80] mx-3 mt-2 flex items-start gap-3 rounded-2xl bg-yellow-500/15 border border-yellow-500/40 p-3 backdrop-blur"
        >
          <TriangleAlert className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm text-yellow-100">
            {saveFailed
              ? "No se pudo guardar en este navegador (¿modo privado o memoria llena?). Tus datos se perderán al cerrar la app."
              : notice}
          </p>
          {!saveFailed && (
            <button onClick={dismissNotice} aria-label="Cerrar aviso" className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-yellow-200">
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
          sets={setsStore.sets}
          onLogSet={setsStore.addSet}
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
        <HistoryScreen sessions={sessionsStore.sessions} sets={setsStore.sets} onDeleteSession={handleDeleteSession} onDeleteSet={setsStore.removeSet} />
      )}

      {activeTab === "progreso" && <ProgressScreen sets={setsStore.sets} />}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onChange={updateSettings}
        install={install}
        backup={{ getData: getBackupData, onRestore: handleRestore }}
      />

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
