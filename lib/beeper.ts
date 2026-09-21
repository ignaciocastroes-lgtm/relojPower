/**
 * Avisos sonoros reales con Web Audio API + vibración.
 *
 * Los navegadores móviles bloquean el audio hasta que hay un toque del usuario,
 * así que `unlockAudio()` debe llamarse de forma SÍNCRONA dentro del onClick
 * del botón Play (antes de cualquier await).
 */

import { DEFAULT_SETTINGS, volumeToGain, type AppSettings } from "./settings"
import type { Signal } from "./timer-engine"

type AudioContextCtor = typeof AudioContext

let ctx: AudioContext | null = null
let config: AppSettings = { ...DEFAULT_SETTINGS }

/** Aplica volumen y vibración. Se llama al cargar y cada vez que el usuario cambia un ajuste. */
export function configureBeeper(settings: AppSettings): void {
  config = { ...settings }
}

function getContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

/** Crea/reanuda el AudioContext. Llamar dentro de un gesto del usuario. */
export function unlockAudio(): void {
  const Ctor = getContextCtor()
  if (!Ctor) return
  if (!ctx) ctx = new Ctor()
  if (ctx.state === "suspended") void ctx.resume()

  // iOS: reproducir un buffer silencioso termina de desbloquear el audio.
  const buffer = ctx.createBuffer(1, 1, 22050)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start(0)
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType = "sine") {
  const volume = volumeToGain(config.volume)
  if (volume <= 0) return // volumen 0 = silencio real: ni siquiera se crea el oscilador
  if (!ctx || ctx.state !== "running") return
  const t0 = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)

  // Envolvente corta para evitar "clics" al empezar y terminar.
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.setValueAtTime(volume, t0 + Math.max(0.011, duration - 0.03))
  gain.gain.linearRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** ¿Este navegador puede vibrar? (false p. ej. en Safari de iPhone). */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
}

function vibrate(pattern: number | number[]) {
  if (config.vibration && canVibrate()) {
    navigator.vibrate(pattern)
  }
}

/** Reproduce el aviso correspondiente a una transición del motor. */
export function playSignal(signal: Signal): void {
  switch (signal) {
    case "tick": // 3-2-1
      tone(880, 0, 0.09)
      vibrate(40)
      break
    case "work": // arranca el trabajo: agudo y doble
      tone(1320, 0, 0.14, "square")
      tone(1320, 0.2, 0.32, "square")
      vibrate([120, 60, 220])
      break
    case "rest": // empieza el descanso: grave y largo
      tone(520, 0, 0.45)
      vibrate(150)
      break
    case "prepare": // preparar siguiente ejercicio
      tone(700, 0, 0.2)
      vibrate(80)
      break
    case "finish": // fin de la sesión: tres notas
      tone(880, 0, 0.18)
      tone(1100, 0.24, 0.18)
      tone(1320, 0.48, 0.5)
      vibrate([200, 100, 200, 100, 400])
      break
    default:
      break
  }
}
