"use client"

import { Volume2, VolumeX, Vibrate, X } from "lucide-react"
import { canVibrate, playSignal, unlockAudio } from "@/lib/beeper"
import type { AppSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

interface SoundSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
}

/** Solo controles que hacen algo real: volumen de los avisos, vibración y una prueba. */
export function SoundSettingsModal({ isOpen, onClose, settings, onChange }: SoundSettingsModalProps) {
  if (!isOpen) return null

  const vibrationSupported = canVibrate()
  const muted = settings.volume === 0

  // Debe ejecutarse dentro del toque del usuario para que el navegador permita el audio.
  const handleTest = () => {
    unlockAudio()
    playSignal("work")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-label="Sonido y vibración">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Sonido y vibración</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Avisos del reloj</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Volumen */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="volume" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {muted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4 text-primary" />}
                Volumen
              </label>
              <span className="text-sm font-bold tabular-nums text-foreground" data-testid="volume-value">
                {muted ? "Silenciado" : `${settings.volume}%`}
              </span>
            </div>
            <input
              id="volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.volume}
              onChange={(e) => onChange({ volume: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Vibración */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Vibrate className="w-4 h-4 text-primary" />
                Vibración
              </p>
              {!vibrationSupported && (
                <p className="text-xs text-muted-foreground mt-1" data-testid="vibration-unsupported">
                  Este navegador no permite vibración.
                </p>
              )}
            </div>
            <button
              role="switch"
              aria-checked={vibrationSupported && settings.vibration}
              aria-label="Vibración"
              disabled={!vibrationSupported}
              onClick={() => onChange({ vibration: !settings.vibration })}
              className={cn(
                "relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0",
                !vibrationSupported ? "bg-secondary/50 cursor-not-allowed" : settings.vibration ? "bg-primary" : "bg-secondary"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300",
                  vibrationSupported && settings.vibration ? "left-6" : "left-1"
                )}
              />
            </button>
          </div>

          {/* Probar */}
          <div>
            <button
              onClick={handleTest}
              data-testid="test-sound"
              className="w-full py-3 rounded-2xl bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition-colors"
            >
              Probar avisos
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              ¿No se oye? Sube el volumen del móvil y revisa el interruptor de silencio: en algunos teléfonos puede silenciar los avisos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
