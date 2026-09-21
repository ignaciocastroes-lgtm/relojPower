"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HeartRateMonitor, detectBluetooth, type HeartRateSnapshot } from "@/lib/heart-rate-ble"

export interface HeartRateControls extends HeartRateSnapshot {
  /** false hasta montar: el servidor no sabe si hay Bluetooth, así que no se pinta nada antes (evita errores de hidratación). */
  ready: boolean
  /** Debe llamarse directamente desde un toque del usuario (el navegador lo exige). */
  connect: () => void
  disconnect: () => void
}

const INITIAL: HeartRateSnapshot = { status: "unsupported", bpm: null, contactLost: false, deviceName: null, message: null, attempt: 0 }

/**
 * Pulso en vivo de un sensor Bluetooth. Toda la lógica está en lib/heart-rate-ble.ts (probada);
 * este hook solo la conecta con React. Si no hay Bluetooth, `status` es "unsupported" con el motivo.
 */
export function useHeartRate(): HeartRateControls {
  const monitorRef = useRef<HeartRateMonitor | null>(null)
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<HeartRateSnapshot>(INITIAL)

  useEffect(() => {
    const support = detectBluetooth()
    const monitor = new HeartRateMonitor(support.supported ? support.ble : null, {
      unsupportedMessage: support.supported ? undefined : support.reason,
    })
    monitorRef.current = monitor
    setSnapshot(monitor.getSnapshot())
    setReady(true)
    const unsubscribe = monitor.subscribe(setSnapshot)
    return () => {
      unsubscribe()
      monitor.dispose() // corta el enlace con el sensor al cerrar la app
      monitorRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    void monitorRef.current?.connect()
  }, [])
  const disconnect = useCallback(() => {
    monitorRef.current?.disconnect()
  }, [])

  return { ...snapshot, ready, connect, disconnect }
}
