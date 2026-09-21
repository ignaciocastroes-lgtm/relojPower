/**
 * Conexión real con un sensor de pulso por Web Bluetooth (perfil estándar Heart Rate).
 * Es el ÚNICO origen del pulso en la app: si no hay sensor conectado, no hay número.
 *
 * La API de Bluetooth se INYECTA (`ble`), así la lógica de estados, reconexión y errores
 * se prueba con dispositivos simulados sin navegador (scripts/test-heart-rate.ts).
 * TypeScript no incluye los tipos de Web Bluetooth, por eso se declaran aquí solo los que se usan.
 */

import { parseHeartRateMeasurement } from "./heart-rate"

export const HEART_RATE_SERVICE = 0x180d
export const HEART_RATE_MEASUREMENT = 0x2a37

/* ---- Tipos mínimos de Web Bluetooth (lo que este archivo usa) ---- */
export interface BleCharacteristic {
  value?: DataView | null
  startNotifications(): Promise<unknown>
  addEventListener(type: "characteristicvaluechanged", listener: () => void): void
  removeEventListener(type: "characteristicvaluechanged", listener: () => void): void
}
export interface BleService {
  getCharacteristic(uuid: number): Promise<BleCharacteristic>
}
export interface BleServer {
  getPrimaryService(uuid: number): Promise<BleService>
}
export interface BleGatt {
  connect(): Promise<BleServer>
  disconnect(): void
}
export interface BleDevice {
  name?: string
  gatt?: BleGatt
  addEventListener(type: "gattserverdisconnected", listener: () => void): void
  removeEventListener(type: "gattserverdisconnected", listener: () => void): void
}
export interface BleApi {
  requestDevice(options: { filters: { services: number[] }[] }): Promise<BleDevice>
}

/* ---- Soporte del navegador ---- */

export type BluetoothSupport = { supported: true; ble: BleApi } | { supported: false; reason: string }

/** Se evalúa en el navegador (no en el servidor). */
export function detectBluetooth(): BluetoothSupport {
  if (typeof navigator === "undefined") return { supported: false, reason: "No disponible." }
  const ble = (navigator as unknown as { bluetooth?: BleApi }).bluetooth
  if (!ble) {
    return { supported: false, reason: "Este navegador no permite Bluetooth (en iPhone no existe; en Android usa Chrome)." }
  }
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { supported: false, reason: "Bluetooth solo funciona en páginas seguras (https)." }
  }
  return { supported: true, ble }
}

/* ---- Errores ---- */

function errorName(e: unknown): string {
  return typeof e === "object" && e !== null && "name" in e && typeof (e as { name: unknown }).name === "string"
    ? (e as { name: string }).name
    : ""
}

/** Cerrar el selector de dispositivos sin elegir ninguno no es un error. */
export function isUserCancel(e: unknown): boolean {
  return errorName(e) === "NotFoundError"
}

/** Mensaje en español, con lo que el usuario puede hacer. */
export function describeBleError(e: unknown): string {
  switch (errorName(e)) {
    case "NotFoundError":
      return "Ese dispositivo no transmite pulso estándar. Un reloj Samsung / Wear OS necesita una app que lo transmita por Bluetooth (ver README); en otros relojes, activa su modo de transmitir pulso."
    case "NotAllowedError":
      return "Bluetooth está bloqueado para esta página. Permítelo en los ajustes del navegador."
    case "SecurityError":
      return "El navegador no permite Bluetooth en esta página (necesita https)."
    case "NetworkError":
      return "No se pudo conectar con el sensor. Acércalo y comprueba que no esté conectado a otra app."
    case "NotSupportedError":
      return "Este dispositivo no admite la conexión Bluetooth necesaria."
    default:
      return "No se pudo conectar con el sensor de pulso."
  }
}

/* ---- Monitor ---- */

export type HeartRateStatus = "unsupported" | "idle" | "connecting" | "connected" | "reconnecting" | "error"

export interface HeartRateSnapshot {
  status: HeartRateStatus
  /** Último pulso VÁLIDO y reciente. null si no hay lectura fiable (sin contacto, sin señal, desconectado). */
  bpm: number | null
  /** El sensor informa que no toca la piel. */
  contactLost: boolean
  deviceName: string | null
  /** Explicación para mostrar (error, motivo de no disponible, etc.). */
  message: string | null
  /** Nº de intento de reconexión (1-based) mientras `status === "reconnecting"`. */
  attempt: number
}

export interface MonitorOptions {
  /** Esperas entre intentos de reconexión. Al agotarse: error. */
  reconnectDelaysMs?: number[]
  /** Sin lecturas durante este tiempo el pulso pasa a null (no se muestra un número viejo). */
  staleMs?: number
  /** Motivo a mostrar si `ble` es null. */
  unsupportedMessage?: string
}

const DEFAULT_RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000]
const DEFAULT_STALE_MS = 6000

type Listener = (snapshot: HeartRateSnapshot) => void

export class HeartRateMonitor {
  private readonly ble: BleApi | null
  private readonly reconnectDelays: number[]
  private readonly staleMs: number
  private snap: HeartRateSnapshot
  private readonly listeners = new Set<Listener>()
  private device: BleDevice | null = null
  private characteristic: BleCharacteristic | null = null
  private staleTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  /** Sube cada vez que se cancela/reinicia el flujo: el trabajo asíncrono viejo se descarta. */
  private generation = 0
  private disposed = false

  constructor(ble: BleApi | null, options: MonitorOptions = {}) {
    this.ble = ble
    this.reconnectDelays = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS
    this.staleMs = options.staleMs ?? DEFAULT_STALE_MS
    this.snap = {
      status: ble ? "idle" : "unsupported",
      bpm: null,
      contactLost: false,
      deviceName: null,
      message: ble ? null : (options.unsupportedMessage ?? "Bluetooth no disponible."),
      attempt: 0,
    }
  }

  getSnapshot(): HeartRateSnapshot {
    return this.snap
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private set(patch: Partial<HeartRateSnapshot>): void {
    if (this.disposed) return
    this.snap = { ...this.snap, ...patch }
    for (const l of this.listeners) l(this.snap)
  }

  /** Debe llamarse desde un toque del usuario (el navegador lo exige para abrir el selector). */
  async connect(): Promise<void> {
    if (!this.ble || this.disposed) return
    const s = this.snap.status
    if (s === "connecting" || s === "connected" || s === "reconnecting") return

    const gen = ++this.generation
    this.set({ status: "connecting", bpm: null, contactLost: false, message: null, attempt: 0 })

    let device: BleDevice
    try {
      device = await this.ble.requestDevice({ filters: [{ services: [HEART_RATE_SERVICE] }] })
    } catch (e) {
      if (gen !== this.generation) return
      if (isUserCancel(e)) this.set({ status: "idle" })
      else this.set({ status: "error", message: describeBleError(e) })
      return
    }
    if (gen !== this.generation) return

    this.device = device
    device.addEventListener("gattserverdisconnected", this.onDisconnected)
    try {
      await this.openLink(device, gen)
    } catch (e) {
      if (gen !== this.generation) return
      // Invalida cualquier reintento que otra ruta (p. ej. una desconexión a mitad) haya programado.
      this.generation++
      this.clearTimers()
      this.teardownDevice()
      this.set({ status: "error", message: describeBleError(e), deviceName: null, bpm: null, attempt: 0 })
    }
  }

  /** Corta la conexión a petición del usuario. */
  disconnect(): void {
    if (!this.ble) return
    this.generation++
    this.clearTimers()
    this.teardownDevice()
    this.set({ status: "idle", bpm: null, contactLost: false, deviceName: null, message: null, attempt: 0 })
  }

  /** Libera todo (al desmontar la app). */
  dispose(): void {
    this.disconnect()
    this.disposed = true
    this.listeners.clear()
  }

  /* ------------------------------ interno ------------------------------ */

  private async openLink(device: BleDevice, gen: number): Promise<void> {
    if (!device.gatt) throw new Error("El dispositivo no expone GATT")
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(HEART_RATE_SERVICE)
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT)
    if (gen !== this.generation) {
      // Cancelado mientras se conectaba: no dejar el enlace abierto.
      try {
        device.gatt.disconnect()
      } catch {
        // ya estaba cerrado
      }
      return
    }

    this.characteristic?.removeEventListener("characteristicvaluechanged", this.onValue)
    this.characteristic = characteristic
    characteristic.addEventListener("characteristicvaluechanged", this.onValue)
    await characteristic.startNotifications()
    if (gen !== this.generation) return

    this.set({ status: "connected", deviceName: device.name ?? null, message: null, attempt: 0, bpm: null, contactLost: false })
    this.armStale()
  }

  private readonly onValue = (): void => {
    const view = this.characteristic?.value
    if (!view) return
    const reading = parseHeartRateMeasurement(view)
    if (!reading) return
    this.set({ bpm: reading.bpm, contactLost: reading.contact === "lost" })
    this.armStale()
  }

  private readonly onDisconnected = (): void => {
    // Solo cuenta una caída de un enlace ya establecido. Los fallos al conectar o reconectar
    // los gestiona la promesa correspondiente; reaccionar aquí también duplicaría los reintentos.
    if (this.disposed || this.snap.status !== "connected") return
    this.clearStale()
    this.set({ bpm: null, contactLost: false })
    this.scheduleReconnect(0)
  }

  private scheduleReconnect(index: number): void {
    const device = this.device
    if (!device) return
    if (index >= this.reconnectDelays.length) {
      this.teardownDevice()
      this.set({ status: "error", message: "Se perdió la conexión con el sensor.", deviceName: null, attempt: 0 })
      return
    }
    const gen = this.generation
    this.set({ status: "reconnecting", attempt: index + 1, bpm: null })
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (gen !== this.generation) return
      this.openLink(device, gen).catch(() => {
        if (gen !== this.generation) return
        this.scheduleReconnect(index + 1)
      })
    }, this.reconnectDelays[index])
  }

  private armStale(): void {
    this.clearStale()
    this.staleTimer = setTimeout(() => {
      this.staleTimer = null
      if (this.snap.bpm !== null) this.set({ bpm: null })
    }, this.staleMs)
  }

  private clearStale(): void {
    if (this.staleTimer !== null) clearTimeout(this.staleTimer)
    this.staleTimer = null
  }

  private clearTimers(): void {
    this.clearStale()
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private teardownDevice(): void {
    const device = this.device
    this.characteristic?.removeEventListener("characteristicvaluechanged", this.onValue)
    this.characteristic = null
    this.device = null
    if (device) {
      device.removeEventListener("gattserverdisconnected", this.onDisconnected)
      try {
        device.gatt?.disconnect()
      } catch {
        // ya estaba desconectado
      }
    }
  }
}
