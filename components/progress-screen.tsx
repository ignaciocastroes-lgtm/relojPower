"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Trophy, TrendingUp } from "lucide-react"
import { dayLabel } from "@/lib/session-log"
import { exerciseProgress, formatKg, setLabel, summarizeExercises, type ProgressPoint, type SetLog } from "@/lib/set-log"

interface ProgressScreenProps {
  sets: SetLog[]
}

const shortDate = (iso: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(iso))

/** Evolución del peso máximo por sesión. SVG propio (sin librerías); a más de una sesión dibuja la línea. */
function WeightChart({ points, name }: { points: ProgressPoint[]; name: string }) {
  const W = 300
  const H = 110
  const pad = { l: 34, r: 10, t: 10, b: 22 }
  const values = points.map((p) => p.maxWeightKg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => (points.length === 1 ? (W + pad.l - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1))
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.maxWeightKg).toFixed(1)}`).join(" ")

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Peso máximo por sesión de ${name}: de ${formatKg(values[0])} kg a ${formatKg(values[values.length - 1])} kg en ${points.length} sesiones`}
      data-testid="progress-chart"
    >
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="stroke-border" strokeWidth="1" />
      <text x={pad.l - 6} y={y(max) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{formatKg(max)}</text>
      {max !== min && <text x={pad.l - 6} y={y(min) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">{formatKg(min)}</text>}
      {points.length > 1 && <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => (
        <circle key={p.sessionId} cx={x(i)} cy={y(p.maxWeightKg)} r="4" className="fill-primary" />
      ))}
      <text x={pad.l} y={H - 6} fontSize="10" className="fill-muted-foreground">{shortDate(points[0].at)}</text>
      {points.length > 1 && <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10" className="fill-muted-foreground">{shortDate(points[points.length - 1].at)}</text>}
    </svg>
  )
}

export function ProgressScreen({ sets }: ProgressScreenProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const now = new Date()
  const exercises = useMemo(() => summarizeExercises(sets), [sets])

  return (
    <div className="min-h-dvh bg-background pb-nav">
      <header className="px-5 pt-top pb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Progreso</h1>
        <p className="text-muted-foreground">Peso y repeticiones que has registrado</p>
      </header>

      <div className="px-5">
        {exercises.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-progress">
            <div className="w-20 h-20 rounded-3xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Aún no hay series registradas</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Ejecuta una rutina en el Reloj: al terminar cada serie podrás anotar el peso y las repeticiones, y aquí verás tu evolución y tus récords.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {exercises.map((exercise) => {
              const open = openId === exercise.exerciseId
              const points = open ? exerciseProgress(sets, exercise.exerciseId) : []
              return (
                <li key={exercise.exerciseId} className="rounded-2xl bg-secondary/30 p-4" data-testid="progress-exercise">
                  <button
                    onClick={() => setOpenId(open ? null : exercise.exerciseId)}
                    aria-expanded={open}
                    className="flex min-h-10 w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground" data-testid="progress-name">{exercise.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Última vez: {dayLabel(exercise.lastAt, now)} · {exercise.sessions} {exercise.sessions === 1 ? "sesión" : "sesiones"} · {exercise.totalSets} {exercise.totalSets === 1 ? "serie" : "series"}
                      </p>
                    </div>
                    <ChevronDown className={`mt-1 w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-secondary/50 p-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Trophy className="w-3 h-3 text-yellow-400" aria-hidden="true" />Mejor peso</p>
                      <p className="font-bold text-foreground" data-testid="progress-best-weight">{setLabel(exercise.bestWeight)}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/50 p-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Trophy className="w-3 h-3 text-yellow-400" aria-hidden="true" />Mejor serie</p>
                      <p className="font-bold text-foreground" data-testid="progress-best-volume">
                        {exercise.bestSetVolume ? `${formatKg(exercise.bestSetVolume.volumeKg)} kg` : "—"}
                      </p>
                      {exercise.bestSetVolume && <p className="text-xs text-muted-foreground">{setLabel(exercise.bestSetVolume)}</p>}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Volumen total: {formatKg(exercise.totalVolumeKg)} kg</p>

                  {open && points.length > 0 && (
                    <div className="mt-4" data-testid="progress-detail">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Peso máximo por sesión</p>
                      <WeightChart points={points} name={exercise.name} />
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {[...points].reverse().slice(0, 5).map((p) => (
                          <li key={p.sessionId} className="flex justify-between">
                            <span>{shortDate(p.at)}</span>
                            <span className="text-foreground">{formatKg(p.maxWeightKg)} kg · {formatKg(p.volumeKg)} kg de volumen · {p.sets} {p.sets === 1 ? "serie" : "series"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
