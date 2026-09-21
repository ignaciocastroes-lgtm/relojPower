/**
 * Pulso cardíaco: decodificador, acumulador, historial y máquina de estados de la conexión
 * (con un sensor Bluetooth SIMULADO: el sensor real solo se puede probar con hardware).
 * Uso: pnpm test:heart
 */
import assert from "node:assert/strict"
import {
  MAX_SAMPLE_GAP_MS,
  addHeartSample,
  emptyHeart,
  parseHeartRateMeasurement,
  summarizeHeart,
} from "../lib/heart-rate.ts"
import {
  HeartRateMonitor,
  describeBleError,
  isUserCancel,
  type BleApi,
  type BleCharacteristic,
  type BleDevice,
  type HeartRateSnapshot,
} from "../lib/heart-rate-ble.ts"
import { checkpointToSession, heartLabel, parseCheckpoint, parseSessions, serializeCheckpoint, serializeSessions, type SessionRecord } from "../lib/session-log.ts"

let passed = 0
const queue: { name: string; fn: () => void | Promise<void> }[] = []
function test(name: string, fn: () => void | Promise<void>) { queue.push({ name, fn }) }

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
class NamedError extends Error { constructor(name: string, msg = name) { super(msg); this.name = name } }

/* ------------------------------ Decodificador ------------------------------ */

test("Pulso de 8 bits: flags 0x00, 72 lpm", () => {
  assert.deepEqual(parseHeartRateMeasurement(view(0x00, 72)), { bpm: 72, contact: "unsupported" })
})
test("Pulso de 16 bits (little-endian): 0x0096 = 150", () => {
  assert.deepEqual(parseHeartRateMeasurement(view(0x01, 0x96, 0x00)), { bpm: 150, contact: "unsupported" })
})
test("Little-endian de verdad: bytes [0x00,0x01] = 256 (fuera de rango), no 1", () => {
  assert.equal(parseHeartRateMeasurement(view(0x01, 0x00, 0x01))?.bpm, null)
})
test("Contacto: 0x06 = detectado, 0x04 = perdido (el pulso no es fiable y se descarta)", () => {
  assert.deepEqual(parseHeartRateMeasurement(view(0x06, 80)), { bpm: 80, contact: "detected" })
  assert.deepEqual(parseHeartRateMeasurement(view(0x04, 80)), { bpm: null, contact: "lost" })
})
test("Con 0x02 sin 0x04 el sensor NO informa contacto: no se interpreta como detectado", () => {
  assert.equal(parseHeartRateMeasurement(view(0x02, 80))?.contact, "unsupported")
})
test("Energía gastada e intervalos RR (bits 3 y 4) no desplazan el pulso", () => {
  assert.equal(parseHeartRateMeasurement(view(0x18, 65, 0x10, 0x00, 0x20, 0x03))?.bpm, 65)
})
test("Paquetes truncados -> null", () => {
  assert.equal(parseHeartRateMeasurement(view()), null)
  assert.equal(parseHeartRateMeasurement(view(0x00)), null)
  assert.equal(parseHeartRateMeasurement(view(0x01, 0x96)), null)
})
test("Rango: 29 y 251 se descartan; 30 y 250 valen; 0 se descarta", () => {
  for (const [v, ok] of [[0, false], [29, false], [30, true], [250, true], [251, false]] as const) {
    assert.equal(parseHeartRateMeasurement(view(0x00, v))?.bpm, ok ? v : null, `bpm ${v}`)
  }
})

/* ------------------------------ Acumulador ------------------------------ */

test("Promedio ponderado por TIEMPO, no por número de lecturas", () => {
  let acc = emptyHeart()
  acc = addHeartSample(acc, 100, 2000) // 2 s a 100
  acc = addHeartSample(acc, 150, 2000)
  acc = addHeartSample(acc, 150, 2000)
  acc = addHeartSample(acc, 150, 2000)
  acc = addHeartSample(acc, 150, 2000) // 8 s a 150
  assert.deepEqual(summarizeHeart(acc), { avgBpm: 140, maxBpm: 150 })
})
test("Un hueco largo (app dormida) cuenta como máximo MAX_SAMPLE_GAP_MS", () => {
  const acc = addHeartSample(emptyHeart(), 120, 600_000)
  assert.equal(acc.ms, MAX_SAMPLE_GAP_MS)
})
test("Valores inválidos (bpm fuera de rango, delta <= 0 o NaN) no cambian nada", () => {
  const base = addHeartSample(emptyHeart(), 100, 1000)
  for (const [b, d] of [[10, 1000], [300, 1000], [NaN, 1000], [100, 0], [100, -5], [100, NaN]] as const) {
    assert.deepEqual(addHeartSample(base, b, d), base, `${b},${d}`)
  }
})
test("Menos de 10 s de pulso medido: no hay resumen (no se inventa un promedio)", () => {
  let acc = emptyHeart()
  for (let i = 0; i < 4; i++) acc = addHeartSample(acc, 130, 2000) // 8 s
  assert.equal(summarizeHeart(acc), null)
  assert.notEqual(summarizeHeart(addHeartSample(acc, 130, 2000)), null) // 10 s
})
test("El promedio nunca supera el máximo (tampoco al redondear)", () => {
  let acc = emptyHeart()
  for (const b of [99, 100, 100, 100, 100, 100]) acc = addHeartSample(acc, b, 2000)
  const s = summarizeHeart(acc)!
  assert.ok(s.avgBpm <= s.maxBpm)
})

/* ------------------------------ Historial ------------------------------ */

const baseSession: SessionRecord = {
  id: "s1", startedAt: "2026-09-20T10:00:00.000Z", endedAt: "2026-09-20T10:10:00.000Z",
  durationSeconds: 600, kind: "tabata", rounds: 8, completed: true,
}
const roundTrip = (s: unknown) => parseSessions(JSON.stringify({ version: 1, sessions: [s] }))

test("Una sesión con pulso lo conserva al guardar y leer", () => {
  const r = parseSessions(serializeSessions([{ ...baseSession, avgBpm: 142, maxBpm: 171 }]))
  assert.equal(r.sessions[0].avgBpm, 142)
  assert.equal(r.sessions[0].maxBpm, 171)
  assert.equal(heartLabel(r.sessions[0]), "142 prom · 171 máx")
})
test("Las sesiones antiguas (sin pulso) siguen siendo válidas y NO reciben campos de pulso", () => {
  const r = parseSessions(serializeSessions([baseSession]))
  assert.equal(r.dropped, 0)
  assert.ok(!("avgBpm" in r.sessions[0]) && !("maxBpm" in r.sessions[0]))
  assert.equal(heartLabel(r.sessions[0]), null)
})
test("Pulso dudoso guardado (fuera de rango, media > máximo, solo uno, texto) se descarta; la sesión se conserva", () => {
  for (const extra of [{ avgBpm: 10, maxBpm: 150 }, { avgBpm: 150, maxBpm: 300 }, { avgBpm: 160, maxBpm: 150 }, { avgBpm: 140 }, { maxBpm: 150 }, { avgBpm: "140", maxBpm: "150" }, { avgBpm: NaN, maxBpm: 150 }]) {
    const r = roundTrip({ ...baseSession, ...extra })
    assert.equal(r.sessions.length, 1, JSON.stringify(extra))
    assert.ok(!("avgBpm" in r.sessions[0]) && !("maxBpm" in r.sessions[0]), JSON.stringify(extra))
  }
})
test("Una sesión recuperada tras un cierre brusco conserva su pulso", () => {
  const cp = parseCheckpoint(serializeCheckpoint({
    id: "s2", startedAt: baseSession.startedAt, lastSeenAt: baseSession.endedAt, durationSeconds: 300,
    kind: "tabata", rounds: 4, avgBpm: 138, maxBpm: 160,
  }))!
  const s = checkpointToSession(cp)!
  assert.equal(s.avgBpm, 138)
  assert.equal(s.maxBpm, 160)
  assert.equal(s.completed, false)
})

/* ------------------------- Sensor Bluetooth simulado ------------------------- */

class Emitter {
  private map = new Map<string, Set<() => void>>()
  addEventListener(t: string, l: () => void) { (this.map.get(t) ?? this.map.set(t, new Set()).get(t)!).add(l) }
  removeEventListener(t: string, l: () => void) { this.map.get(t)?.delete(l) }
  emit(t: string) { for (const l of [...(this.map.get(t) ?? [])]) l() }
  count(t: string) { return this.map.get(t)?.size ?? 0 }
}

interface SensorOpts {
  name?: string
  /** Cuántos intentos de gatt.connect() fallan antes de funcionar (Infinity = siempre). */
  failConnects?: number
  serviceMissing?: boolean
  chooserError?: Error
  chooserDelayMs?: number
}

function makeSensor(opts: SensorOpts = {}) {
  const deviceEmitter = new Emitter()
  let value: DataView | null = null
  // Como en el navegador real: cada getCharacteristic() (p. ej. tras reconectar) entrega un objeto NUEVO.
  const chars: { emitter: Emitter; characteristic: BleCharacteristic }[] = []
  const newCharacteristic = (): BleCharacteristic => {
    const emitter = new Emitter()
    const characteristic: BleCharacteristic = {
      get value() { return value },
      startNotifications: async () => { stats.startNotifications++; return characteristic },
      addEventListener: (t, l) => emitter.addEventListener(t, l),
      removeEventListener: (t, l) => emitter.removeEventListener(t, l),
    }
    chars.push({ emitter, characteristic })
    return characteristic
  }
  let failsLeft = opts.failConnects ?? 0
  const stats = { requestDevice: 0, connects: 0, gattDisconnects: 0, startNotifications: 0 }

  const device: BleDevice = {
    name: opts.name ?? "Sensor Test",
    gatt: {
      connect: async () => {
        stats.connects++
        if (failsLeft > 0) { failsLeft--; throw new NamedError("NetworkError", "GATT Error") }
        return {
          getPrimaryService: async () => {
            if (opts.serviceMissing) throw new NamedError("NotFoundError", "No Services matching UUID")
            return { getCharacteristic: async () => newCharacteristic() }
          },
        }
      },
      disconnect: () => { stats.gattDisconnects++ },
    },
    addEventListener: (t, l) => deviceEmitter.addEventListener(t, l),
    removeEventListener: (t, l) => deviceEmitter.removeEventListener(t, l),
  }
  const api: BleApi = {
    requestDevice: async () => {
      stats.requestDevice++
      if (opts.chooserDelayMs) await sleep(opts.chooserDelayMs)
      if (opts.chooserError) throw opts.chooserError
      return device
    },
  }
  return {
    api,
    stats,
    /** El sensor envía un paquete de pulso (bytes crudos del estándar). */
    // El sensor solo notifica por el enlace VIGENTE (el último objeto entregado).
    beat: (bpm: number, flags = 0x00) => { value = view(flags, bpm); chars.at(-1)?.emitter.emit("characteristicvaluechanged") },
    beatRaw: (dv: DataView) => { value = dv; chars.at(-1)?.emitter.emit("characteristicvaluechanged") },
    drop: () => deviceEmitter.emit("gattserverdisconnected"),
    /** Los próximos `n` gatt.connect() fallan (Infinity = el sensor no vuelve nunca). */
    failNextConnects: (n: number) => { failsLeft = n },
    /** Oyentes vivos sumando TODAS las características entregadas (detecta fugas tras reconectar). */
    charListeners: () => chars.reduce((n, c) => n + c.emitter.count("characteristicvaluechanged"), 0),
    deviceListeners: () => deviceEmitter.count("gattserverdisconnected"),
  }
}

const FAST = { reconnectDelaysMs: [5, 5, 5], staleMs: 40 }
const record = (m: HeartRateMonitor) => { const seen: HeartRateSnapshot[] = []; m.subscribe((s) => seen.push(s)); return seen }

test("Sin Bluetooth: estado 'unsupported' con el motivo, y connect() no hace nada", async () => {
  const m = new HeartRateMonitor(null, { unsupportedMessage: "No hay Bluetooth" })
  assert.equal(m.getSnapshot().status, "unsupported")
  assert.equal(m.getSnapshot().message, "No hay Bluetooth")
  await m.connect()
  m.disconnect()
  assert.equal(m.getSnapshot().status, "unsupported")
  assert.equal(m.getSnapshot().message, "No hay Bluetooth")
})
test("Conectar: idle -> connecting -> connected, con el nombre del dispositivo; sin pulso hasta la primera lectura", async () => {
  const s = makeSensor({ name: "Polar H10" })
  const m = new HeartRateMonitor(s.api, FAST)
  const seen = record(m)
  assert.equal(m.getSnapshot().status, "idle")
  await m.connect()
  assert.deepEqual(seen.map((x) => x.status), ["connecting", "connected"])
  assert.equal(m.getSnapshot().deviceName, "Polar H10")
  assert.equal(m.getSnapshot().bpm, null)
  s.beat(88)
  assert.equal(m.getSnapshot().bpm, 88)
  s.beat(91)
  assert.equal(m.getSnapshot().bpm, 91)
  m.dispose()
})
test("Cerrar el selector sin elegir NO es un error (vuelve a 'idle' sin mensaje)", async () => {
  const s = makeSensor({ chooserError: new NamedError("NotFoundError", "User cancelled the requestDevice() chooser.") })
  const m = new HeartRateMonitor(s.api, FAST)
  await m.connect()
  assert.equal(m.getSnapshot().status, "idle")
  assert.equal(m.getSnapshot().message, null)
})
test("Un dispositivo sin servicio de pulso da error explicado y no queda conectado", async () => {
  const s = makeSensor({ serviceMissing: true })
  const m = new HeartRateMonitor(s.api, FAST)
  await m.connect()
  const snap = m.getSnapshot()
  assert.equal(snap.status, "error")
  assert.match(snap.message ?? "", /no transmite pulso/)
  assert.equal(snap.bpm, null)
  assert.equal(s.stats.gattDisconnects, 1, "debe cerrar el enlace")
  assert.equal(s.deviceListeners(), 0)
})
test("Sin lecturas durante staleMs el pulso vuelve a null (no se muestra un número viejo)", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, FAST)
  await m.connect()
  s.beat(120)
  assert.equal(m.getSnapshot().bpm, 120)
  await sleep(70)
  assert.equal(m.getSnapshot().bpm, null)
  assert.equal(m.getSnapshot().status, "connected")
  s.beat(122)
  assert.equal(m.getSnapshot().bpm, 122)
  m.dispose()
})
test("Contacto perdido: bpm null y contactLost; al recuperarlo vuelve el pulso", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, staleMs: 1000 })
  await m.connect()
  s.beat(75, 0x06)
  assert.equal(m.getSnapshot().bpm, 75)
  s.beat(75, 0x04)
  assert.equal(m.getSnapshot().bpm, null)
  assert.equal(m.getSnapshot().contactLost, true)
  s.beat(77, 0x06)
  assert.equal(m.getSnapshot().bpm, 77)
  assert.equal(m.getSnapshot().contactLost, false)
  m.dispose()
})
test("Un paquete corrupto se ignora sin romper la conexión ni borrar el último pulso", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, staleMs: 1000 })
  await m.connect()
  s.beat(100)
  s.beatRaw(view(0x01))
  assert.equal(m.getSnapshot().bpm, 100)
  assert.equal(m.getSnapshot().status, "connected")
  m.dispose()
})
test("Caída del enlace: 'reconnecting' con nº de intento, luego vuelve solo (un único oyente activo)", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, staleMs: 1000 })
  const seen = record(m)
  await m.connect()
  s.beat(110)
  s.drop()
  assert.equal(m.getSnapshot().status, "reconnecting")
  assert.equal(m.getSnapshot().attempt, 1)
  assert.equal(m.getSnapshot().bpm, null, "sin enlace no hay pulso")
  await sleep(40)
  assert.equal(m.getSnapshot().status, "connected")
  assert.equal(s.charListeners(), 1, "el oyente no debe duplicarse tras reconectar")
  s.beat(115)
  assert.equal(m.getSnapshot().bpm, 115)
  assert.ok(seen.some((x) => x.status === "reconnecting"))
  m.dispose()
})
test("Reintentos que fallan y luego funcionan: sube el nº de intento y termina conectado", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, staleMs: 1000 })
  const seen = record(m)
  await m.connect()
  s.failNextConnects(2) // los 2 primeros reintentos fallan, el 3.º funciona
  const before = s.stats.connects
  s.drop()
  await sleep(80)
  assert.equal(m.getSnapshot().status, "connected")
  assert.equal(s.stats.connects - before, 3)
  const attempts = seen.filter((x) => x.status === "reconnecting").map((x) => x.attempt)
  assert.deepEqual(attempts, [1, 2, 3])
  assert.equal(s.charListeners(), 1)
  s.beat(101)
  assert.equal(m.getSnapshot().bpm, 101)
  m.dispose()
})
test("Si todos los reintentos fallan: error 'Se perdió la conexión' (sin números), y se puede volver a conectar", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, staleMs: 1000 })
  await m.connect()
  s.beat(100)
  s.failNextConnects(Infinity)
  const before = s.stats.connects
  s.drop()
  await sleep(80)
  const snap = m.getSnapshot()
  assert.equal(snap.status, "error")
  assert.match(snap.message ?? "", /Se perdió la conexión/)
  assert.equal(snap.bpm, null)
  assert.equal(s.stats.connects - before, FAST.reconnectDelaysMs.length, "un intento por cada espera configurada")
  s.failNextConnects(0)
  await m.connect()
  assert.equal(m.getSnapshot().status, "connected")
  m.dispose()
})
test("disconnect() del usuario: 'idle', sin pulso, cierra el enlace, quita oyentes y NO reintenta", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, staleMs: 1000 })
  await m.connect()
  s.beat(99)
  const connectsBefore = s.stats.connects
  m.disconnect()
  assert.equal(m.getSnapshot().status, "idle")
  assert.equal(m.getSnapshot().bpm, null)
  assert.equal(m.getSnapshot().deviceName, null)
  assert.equal(s.stats.gattDisconnects, 1)
  assert.equal(s.charListeners(), 0)
  assert.equal(s.deviceListeners(), 0)
  s.drop() // un evento tardío no debe provocar reconexión
  await sleep(40)
  assert.equal(s.stats.connects, connectsBefore)
  assert.equal(m.getSnapshot().status, "idle")
})
test("Desconectar mientras se reconecta cancela los reintentos pendientes", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, { ...FAST, reconnectDelaysMs: [30, 30], staleMs: 1000 })
  await m.connect()
  s.drop()
  assert.equal(m.getSnapshot().status, "reconnecting")
  const connects = s.stats.connects
  m.disconnect()
  await sleep(80)
  assert.equal(s.stats.connects, connects)
  assert.equal(m.getSnapshot().status, "idle")
})
test("Cancelar mientras el selector está abierto: la respuesta tardía se ignora", async () => {
  const s = makeSensor({ chooserDelayMs: 30 })
  const m = new HeartRateMonitor(s.api, FAST)
  const p = m.connect()
  assert.equal(m.getSnapshot().status, "connecting")
  m.disconnect()
  await p
  await sleep(40)
  assert.equal(m.getSnapshot().status, "idle")
  assert.equal(s.stats.connects, 0, "no debe conectar tras cancelar")
})
test("Dos toques seguidos en Conectar abren un solo selector", async () => {
  const s = makeSensor({ chooserDelayMs: 10 })
  const m = new HeartRateMonitor(s.api, FAST)
  await Promise.all([m.connect(), m.connect()])
  assert.equal(s.stats.requestDevice, 1)
  m.dispose()
})
test("dispose(): libera todo y no vuelve a notificar", async () => {
  const s = makeSensor()
  const m = new HeartRateMonitor(s.api, FAST)
  const seen = record(m)
  await m.connect()
  m.dispose()
  const n = seen.length
  s.beat(100)
  s.drop()
  await sleep(30)
  assert.equal(seen.length, n)
  assert.equal(s.charListeners(), 0)
})
test("Sin conexión nunca hay número: en idle, error y unsupported bpm es siempre null", async () => {
  const bad = makeSensor({ serviceMissing: true })
  const m = new HeartRateMonitor(bad.api, FAST)
  const seen = record(m)
  await m.connect()
  m.disconnect()
  for (const snap of seen) if (snap.status !== "connected") assert.equal(snap.bpm, null, snap.status)
})
test("Errores: cada tipo tiene su mensaje en español y solo NotFoundError cuenta como cancelación", () => {
  const msgs = new Set(["NotFoundError", "NotAllowedError", "SecurityError", "NetworkError", "NotSupportedError", "Otro"].map((n) => describeBleError(new NamedError(n))))
  assert.equal(msgs.size, 6, "mensajes distintos")
  assert.equal(describeBleError("texto"), describeBleError(null))
  assert.ok(isUserCancel(new NamedError("NotFoundError")))
  assert.ok(!isUserCancel(new NamedError("NetworkError")))
  assert.ok(!isUserCancel(undefined))
})

/* ------------------------------ Ejecución ------------------------------ */

const TEST_TIMEOUT_MS = 4000
async function main() {
  // Si una prueba se cuelga (una promesa que nunca se resuelve) el proceso terminaría en silencio con código 0:
  // por eso cada prueba tiene límite de tiempo y, al salir, se comprueba que se ejecutaron todas.
  process.on("exit", (code) => {
    if (code === 0 && passed !== queue.length) { console.error(`FAIL  solo se completaron ${passed} de ${queue.length} pruebas`); process.exitCode = 1 }
  })
  for (const t of queue) {
    try {
      await Promise.race([
        Promise.resolve().then(() => t.fn()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`tiempo agotado (${TEST_TIMEOUT_MS} ms): la prueba no termina`)), TEST_TIMEOUT_MS)),
      ])
      passed++
      console.log(`  ok  ${t.name}`)
    } catch (e) { console.error(`FAIL  ${t.name}`); throw e }
  }
  console.log(`${passed} pruebas OK`)
}
main().catch((e) => { console.error(e); process.exit(1) })
