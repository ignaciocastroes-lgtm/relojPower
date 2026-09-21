/**
 * Pulso cardíaco. PURO: sin DOM, sin React, sin Bluetooth (eso vive en lib/heart-rate-ble.ts).
 *
 * Aquí solo hay dos cosas, ambas basadas en datos reales del sensor:
 *  1. Decodificar el paquete estándar "Heart Rate Measurement" (característica 0x2A37 del
 *     servicio Heart Rate 0x180D del Bluetooth SIG).
 *  2. Acumular las lecturas de una sesión para guardar su promedio y máximo.
 *
 * No se calcula nada que no se mida (ni calorías ni zonas inventadas).
 */

/** Rango fisiológicamente plausible. Fuera de él la lectura se descarta (sensor mal puesto, ruido). */
export const MIN_BPM = 30
export const MAX_BPM = 250

/** Menos de esto de pulso medido y el promedio no significa nada: no se guarda. */
export const MIN_SUMMARY_SECONDS = 10

/**
 * Cada lectura vale, como mucho, este tiempo. Si la página estuvo dormida no hubo lecturas,
 * y ese hueco no debe contar como si hubiera pulso.
 */
export const MAX_SAMPLE_GAP_MS = 2000

/** Lo mínimo que se necesita de un DataView (así el decodificador se puede probar sin navegador). */
export interface ByteReader {
  byteLength: number
  getUint8(byteOffset: number): number
  getUint16(byteOffset: number, littleEndian?: boolean): number
}

export type SensorContact = "unsupported" | "detected" | "lost"

export interface HeartRateReading {
  /** null si la lectura no es fiable (sin contacto o fuera de rango). */
  bpm: number | null
  contact: SensorContact
}

/**
 * Formato (Bluetooth SIG, Heart Rate Service):
 *  byte 0 = flags: bit0 = pulso en 16 bits; bit1 = contacto detectado; bit2 = el sensor informa contacto;
 *           bit3 = hay "energía gastada" (2 bytes); bit4 = hay intervalos RR.
 *  luego el pulso (8 o 16 bits, little-endian).
 * Devuelve null si el paquete está truncado.
 */
export function parseHeartRateMeasurement(data: ByteReader): HeartRateReading | null {
  if (data.byteLength < 2) return null
  const flags = data.getUint8(0)
  const is16 = (flags & 0x01) !== 0
  if (is16 && data.byteLength < 3) return null

  const raw = is16 ? data.getUint16(1, true) : data.getUint8(1)
  const contactReported = (flags & 0x04) !== 0
  const contactDetected = (flags & 0x02) !== 0
  const contact: SensorContact = !contactReported ? "unsupported" : contactDetected ? "detected" : "lost"

  const valid = contact !== "lost" && raw >= MIN_BPM && raw <= MAX_BPM
  return { bpm: valid ? raw : null, contact }
}

/* --------------------------- Resumen de sesión --------------------------- */

export interface HeartAccumulator {
  /** Suma de bpm x milisegundos (promedio ponderado por tiempo, no por número de lecturas). */
  weightedSum: number
  /** Milisegundos con pulso válido. */
  ms: number
  max: number
}

export function emptyHeart(): HeartAccumulator {
  return { weightedSum: 0, ms: 0, max: 0 }
}

/** Suma `deltaMs` de tiempo en el que el pulso fue `bpm`. Devuelve un acumulador nuevo. */
export function addHeartSample(acc: HeartAccumulator, bpm: number, deltaMs: number): HeartAccumulator {
  if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) return acc
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return acc
  const dt = Math.min(deltaMs, MAX_SAMPLE_GAP_MS)
  return { weightedSum: acc.weightedSum + bpm * dt, ms: acc.ms + dt, max: Math.max(acc.max, bpm) }
}

export interface HeartSummary {
  avgBpm: number
  maxBpm: number
}

/** Promedio y máximo de la sesión, o null si no hubo pulso medido suficiente. */
export function summarizeHeart(acc: HeartAccumulator): HeartSummary | null {
  if (acc.ms < MIN_SUMMARY_SECONDS * 1000) return null
  return { avgBpm: Math.round(acc.weightedSum / acc.ms), maxBpm: acc.max }
}
