"use client"

import { useState } from "react"
import { Check, Minus, Plus } from "lucide-react"
import { MAX_REPS, MAX_WEIGHT_KG } from "@/lib/set-log"

/** Una serie terminada que espera a que el usuario confirme cuánto peso y cuántas repeticiones hizo. */
export interface PendingSet {
  key: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  totalSets: number
  isTime: boolean
  plannedReps: number
}

interface SetLogCardProps {
  pending: PendingSet[]
  /** Lo que se PRELLENA (último peso usado y reps del plan). No se guarda hasta que el usuario pulsa Guardar. */
  suggestion: { weightKg: number; reps: number | null }
  onSave: (entry: { weightKg: number; reps: number | null }) => void
  onSkip: () => void
}

const parseNumber = (text: string): number => (text.trim() === "" ? NaN : Number(text.replace(",", ".")))
const show = (n: number) => String(Math.round(n * 100) / 100)

function Stepper({ label, value, onChange, step, testId, unit, inputMode }: {
  label: string
  value: string
  onChange: (next: string) => void
  step: number
  testId: string
  unit: string
  inputMode: "decimal" | "numeric"
}) {
  const bump = (delta: number) => {
    const current = parseNumber(value)
    const base = Number.isFinite(current) ? current : 0
    onChange(show(Math.max(0, base + delta)))
  }
  return (
    <div className="flex-1 min-w-[9.75rem]">
      <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => bump(-step)} aria-label={`Menos ${label.toLowerCase()}`} className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80">
          <Minus className="w-4 h-4" />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          aria-label={`${label} (${unit})`}
          data-testid={testId}
          className="h-10 w-16 min-w-0 rounded-lg bg-secondary/70 text-center text-lg font-bold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button type="button" onClick={() => bump(step)} aria-label={`Más ${label.toLowerCase()}`} className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/** Formulario de la serie más antigua sin registrar. Se vuelve a crear (key) con cada serie para partir de su sugerencia. */
function SetLogForm({ pending, suggestion, onSave, onSkip }: SetLogCardProps) {
  const current = pending[0]
  const [weight, setWeight] = useState(show(suggestion.weightKg))
  const [reps, setReps] = useState(suggestion.reps === null ? "" : String(suggestion.reps))

  const weightValue = parseNumber(weight)
  const repsValue = parseNumber(reps)
  const weightOk = Number.isFinite(weightValue) && weightValue >= 0 && weightValue <= MAX_WEIGHT_KG
  const repsOk = current.isTime || (Number.isInteger(repsValue) && repsValue >= 1 && repsValue <= MAX_REPS)
  const canSave = weightOk && repsOk

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4" data-testid="set-log-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-primary font-semibold">
            Registrar serie {current.setNumber} de {current.totalSets}
          </p>
          <p className="truncate font-bold text-foreground">{current.exerciseName}</p>
          {pending.length > 1 && <p className="text-xs text-muted-foreground">+{pending.length - 1} más por registrar</p>}
        </div>
        <button onClick={onSkip} data-testid="set-skip" className="min-h-10 px-2 text-xs text-muted-foreground underline flex-shrink-0">
          Omitir
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-3">
        <Stepper label="Peso" value={weight} onChange={setWeight} step={2.5} testId="set-weight" unit="kg" inputMode="decimal" />
        {!current.isTime && <Stepper label="Reps" value={reps} onChange={setReps} step={1} testId="set-reps" unit="repeticiones" inputMode="numeric" />}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">0 kg = peso corporal. Solo se guarda lo que confirmes.</p>

      <button
        onClick={() => onSave({ weightKg: weightValue, reps: current.isTime ? null : repsValue })}
        disabled={!canSave}
        data-testid="set-save"
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Check className="w-5 h-5" />
        Guardar serie
      </button>
    </div>
  )
}

export function SetLogCard(props: SetLogCardProps) {
  if (props.pending.length === 0) return null
  return <SetLogForm key={props.pending[0].key} {...props} />
}
