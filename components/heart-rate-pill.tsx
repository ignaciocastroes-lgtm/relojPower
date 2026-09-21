"use client"

import { Heart, LoaderCircle } from "lucide-react"
import type { HeartRateControls } from "@/hooks/use-heart-rate"

/**
 * Estado del sensor de pulso. Solo muestra un número cuando un sensor conectado lo está enviando;
 * en cualquier otro caso muestra el estado real (y por qué).
 */
export function HeartRatePill({ heartRate }: { heartRate: HeartRateControls }) {
  const { ready, status, bpm, contactLost, deviceName, message, attempt, connect, disconnect } = heartRate
  if (!ready) return null

  const base = "flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm"

  if (status === "unsupported") {
    return (
      <div className={`${base} bg-secondary/40 text-muted-foreground`} data-testid="hr-unsupported">
        <Heart className="w-4 h-4 flex-shrink-0 opacity-60" aria-hidden="true" />
        <p className="text-xs leading-snug">Pulso no disponible: {message}</p>
      </div>
    )
  }

  if (status === "idle") {
    return (
      <div>
        <button
          onClick={connect}
          data-testid="hr-connect"
          className={`${base} w-full bg-secondary/70 text-foreground hover:bg-secondary transition-colors active:scale-[0.99]`}
        >
          <Heart className="w-4 h-4 text-red-400" aria-hidden="true" />
          <span className="font-semibold">Conectar sensor de pulso</span>
        </button>
        <p className="mt-1.5 px-1 text-[11px] leading-snug text-muted-foreground" data-testid="hr-hint">
          Banda de pecho, o un reloj que transmita el pulso. Los Galaxy Watch necesitan una app extra (ver README).
        </p>
      </div>
    )
  }

  if (status === "connecting") {
    return (
      <div className={`${base} bg-secondary/70 text-muted-foreground`} data-testid="hr-connecting">
        <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>Conectando…</span>
      </div>
    )
  }

  if (status === "reconnecting") {
    return (
      <div className={`${base} bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 justify-between`} data-testid="hr-reconnecting">
        <span className="flex items-center gap-3">
          <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />
          Reconectando con el sensor… (intento {attempt})
        </span>
        <button onClick={disconnect} className="min-h-10 px-2 text-xs underline">
          Cancelar
        </button>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className={`${base} bg-red-500/10 border border-red-500/30 text-red-200 justify-between`} role="alert" data-testid="hr-error">
        <p className="text-xs leading-snug">{message}</p>
        <button onClick={connect} className="min-h-10 px-2 text-xs font-semibold underline flex-shrink-0">
          Reintentar
        </button>
      </div>
    )
  }

  // connected
  return (
    <div className={`${base} bg-secondary/70 justify-between`} data-testid="hr-connected">
      <div className="flex items-center gap-3 min-w-0">
        <Heart
          className={`w-5 h-5 flex-shrink-0 text-red-400 ${bpm !== null ? "animate-pulse" : "opacity-40"}`}
          fill={bpm !== null ? "currentColor" : "none"}
          aria-hidden="true"
        />
        {bpm !== null ? (
          <p className="text-foreground">
            <span className="text-2xl font-bold tabular-nums" data-testid="hr-bpm">{bpm}</span>
            <span className="ml-1 text-xs text-muted-foreground">lpm</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="hr-waiting">
            {contactLost ? "Sin contacto: ajusta la banda o el sensor" : "Esperando señal del sensor…"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {deviceName && <span className="max-w-[7rem] truncate text-xs text-muted-foreground">{deviceName}</span>}
        <button onClick={disconnect} className="min-h-10 px-2 text-xs text-muted-foreground underline" data-testid="hr-disconnect">
          Desconectar
        </button>
      </div>
    </div>
  )
}
