"use client"

import { useMemo, useState } from "react"
import { BarChart3, Calendar, ChevronDown, Clock, Dumbbell, Flame, Heart, History, ListChecks, Trash2 } from "lucide-react"
import {
  computeStats,
  dayLabel,
  formatDuration,
  formatTotalTime,
  heartLabel,
  roundsLabel,
  sessionTitle,
  timeOfDay,
  type SessionRecord,
} from "@/lib/session-log"
import { formatKg, setLabel, summarizeSessionSets, weekSets, totalVolume, type SetLog } from "@/lib/set-log"

interface HistoryScreenProps {
  sessions: SessionRecord[]
  sets: SetLog[]
  onDeleteSession: (id: string) => void
  onDeleteSet: (id: string) => void
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

export function HistoryScreen({ sessions, sets, onDeleteSession, onDeleteSet }: HistoryScreenProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState<string | null>(null)
  const now = new Date()
  const stats = computeStats(sessions, now)
  const weekTime = formatTotalTime(stats.weekSeconds)
  const thisWeek = weekSets(sets, now)
  const weekVolume = totalVolume(thisWeek)

  const bySession = useMemo(() => {
    const map = new Map<string, SetLog[]>()
    for (const s of sets) map.set(s.sessionId, [...(map.get(s.sessionId) ?? []), s])
    return map
  }, [sets])

  const handleDelete = (session: SessionRecord) => {
    const extra = bySession.has(session.id) ? " También se borrarán sus series registradas." : ""
    if (window.confirm(`¿Eliminar "${sessionTitle(session)}" del historial?${extra}`)) onDeleteSession(session.id)
  }
  const handleDeleteSet = (set: SetLog) => {
    if (window.confirm(`¿Eliminar la serie ${set.setNumber} de ${set.exerciseName} (${setLabel(set)})?`)) onDeleteSet(set.id)
  }

  return (
    <div className="min-h-dvh bg-background pb-nav">
      <header className="px-5 pt-top pb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Historial</h1>
        <p className="text-muted-foreground">Tu progreso de entrenamiento</p>
      </header>

      {/* Estadísticas: todas calculadas desde datos guardados */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Calendar} label="Esta Semana" value={String(stats.weekSessions)} unit={stats.weekSessions === 1 ? "sesión" : "sesiones"} testId="stat-week" />
        <StatCard icon={Clock} label="Tiempo Semana" value={weekTime.value} unit={weekTime.unit} testId="stat-time" />
        <StatCard icon={Flame} label="Racha" value={String(stats.streakDays)} unit={stats.streakDays === 1 ? "día seguido" : "días seguidos"} testId="stat-streak" />
        <StatCard icon={BarChart3} label="Total" value={String(stats.totalSessions)} unit={stats.totalSessions === 1 ? "sesión" : "sesiones"} testId="stat-total" />
        <StatCard icon={Dumbbell} label="Volumen Semana" value={formatKg(weekVolume)} unit="kg (peso × reps)" testId="stat-volume" />
        <StatCard icon={ListChecks} label="Series Semana" value={String(thisWeek.length)} unit={thisWeek.length === 1 ? "serie registrada" : "series registradas"} testId="stat-sets" />
      </div>

      <div className="px-5">
        <h2 className="text-lg font-semibold text-foreground mb-3">Sesiones Recientes</h2>

        {sessions.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-history">
            <div className="w-20 h-20 rounded-3xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <History className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Sin sesiones todavía</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">Termina un entrenamiento en el Reloj y aparecerá aquí.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {sessions.slice(0, visible).map((session) => {
                const rounds = roundsLabel(session)
                const heart = heartLabel(session)
                const detail = summarizeSessionSets(bySession.get(session.id) ?? [], session.id)
                const open = openId === session.id
                return (
                  <div key={session.id} data-testid="session-row" className="bg-secondary/30 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
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
                          {heart && (
                            <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground" data-testid="session-heart">
                              <Heart className="w-3 h-3 text-red-400" aria-hidden="true" />
                              {heart}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(session)}
                          aria-label={`Eliminar sesión de ${sessionTitle(session)}`}
                          className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {detail && (
                      <>
                        <button
                          onClick={() => setOpenId(open ? null : session.id)}
                          aria-expanded={open}
                          data-testid="session-sets-toggle"
                          className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl bg-secondary/50 px-3 text-sm text-foreground"
                        >
                          <span data-testid="session-volume">
                            {formatKg(detail.volumeKg)} kg · {detail.sets} {detail.sets === 1 ? "serie" : "series"}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>

                        {open && (
                          <div className="mt-3 space-y-3" data-testid="session-sets">
                            {detail.exercises.map((exercise) => (
                              <div key={exercise.exerciseId}>
                                <p className="mb-1 text-sm font-semibold text-foreground">{exercise.name}</p>
                                <ul className="space-y-1">
                                  {exercise.sets.map((set) => (
                                    <li key={set.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                                      <span>
                                        Serie {set.setNumber} · <span className="text-foreground">{setLabel(set)}</span>
                                      </span>
                                      <button
                                        onClick={() => handleDeleteSet(set)}
                                        aria-label={`Eliminar serie ${set.setNumber} de ${exercise.name}`}
                                        className="w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
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
