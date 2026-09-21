"use client"

import { useState } from "react"
import { Calendar, Clock, Flame, BarChart3, History, Trash2 } from "lucide-react"
import {
  computeStats,
  dayLabel,
  formatDuration,
  formatTotalTime,
  roundsLabel,
  sessionTitle,
  timeOfDay,
  type SessionRecord,
} from "@/lib/session-log"

interface HistoryScreenProps {
  sessions: SessionRecord[]
  onDeleteSession: (id: string) => void
}

const PAGE_SIZE = 30

function StatCard({ icon: Icon, label, value, unit, testId }: { icon: typeof Calendar; label: string; value: string; unit: string; testId: string }) {
  return (
    <div className="bg-secondary/50 rounded-2xl p-4" data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground" data-testid={`${testId}-value`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{unit}</p>
    </div>
  )
}

export function HistoryScreen({ sessions, onDeleteSession }: HistoryScreenProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const now = new Date()
  const stats = computeStats(sessions, now)
  const weekTime = formatTotalTime(stats.weekSeconds)

  const handleDelete = (session: SessionRecord) => {
    if (window.confirm(`¿Eliminar "${sessionTitle(session)}" del historial?`)) onDeleteSession(session.id)
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="px-5 pt-14 pb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Historial</h1>
        <p className="text-muted-foreground">Tu progreso de entrenamiento</p>
      </header>

      {/* Estadísticas: todas calculadas desde las sesiones guardadas */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Calendar} label="Esta Semana" value={String(stats.weekSessions)} unit={stats.weekSessions === 1 ? "sesión" : "sesiones"} testId="stat-week" />
        <StatCard icon={Clock} label="Tiempo Semana" value={weekTime.value} unit={weekTime.unit} testId="stat-time" />
        <StatCard icon={Flame} label="Racha" value={String(stats.streakDays)} unit={stats.streakDays === 1 ? "día seguido" : "días seguidos"} testId="stat-streak" />
        <StatCard icon={BarChart3} label="Total" value={String(stats.totalSessions)} unit={stats.totalSessions === 1 ? "sesión" : "sesiones"} testId="stat-total" />
      </div>

      <div className="px-5">
        <h2 className="text-lg font-semibold text-foreground mb-3">Sesiones Recientes</h2>

        {sessions.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-history">
            <div className="w-20 h-20 rounded-3xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <History className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Sin sesiones todavía</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Termina un entrenamiento en el Reloj y aparecerá aquí.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {sessions.slice(0, visible).map((session) => {
                const rounds = roundsLabel(session)
                return (
                  <div
                    key={session.id}
                    data-testid="session-row"
                    className="bg-secondary/30 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate" data-testid="session-title">
                          {sessionTitle(session)}
                        </p>
                        {!session.completed && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex-shrink-0"
                            data-testid="session-partial"
                          >
                            Parcial
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid="session-when">
                        {dayLabel(session.startedAt, now)} · {timeOfDay(session.startedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-primary" data-testid="session-duration">
                          {formatDuration(session.durationSeconds)}
                        </p>
                        {rounds && (
                          <p className="text-xs text-muted-foreground" data-testid="session-rounds">
                            {rounds}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(session)}
                        aria-label={`Eliminar sesión de ${sessionTitle(session)}`}
                        className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {sessions.length > visible && (
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="w-full mt-4 py-3 rounded-2xl bg-secondary/50 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver más ({sessions.length - visible} restantes)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
