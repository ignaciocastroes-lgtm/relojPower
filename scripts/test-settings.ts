import assert from "node:assert/strict"
import { DEFAULT_SETTINGS, normalizeSettings, parseSettings, serializeSettings, volumeToGain } from "../lib/settings.ts"

let passed = 0
function test(name: string, fn: () => void) { try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e } }
const wrap = (settings: unknown, version: unknown = 1) => JSON.stringify({ version, settings })

console.log("Volumen -> ganancia")
test("0 es silencio absoluto", () => assert.equal(volumeToGain(0), 0))
test("100 es el máximo seguro (0.9, sin saturar)", () => assert.equal(volumeToGain(100), 0.9))
test("El valor por defecto (75) equivale al nivel original (~0.5)", () => assert.ok(Math.abs(volumeToGain(DEFAULT_SETTINGS.volume) - 0.5) < 0.01, String(volumeToGain(75))))
test("Es estrictamente creciente de 5 en 5", () => { let prev = -1; for (let v = 0; v <= 100; v += 5) { const g = volumeToGain(v); assert.ok(g > prev, `no crece en ${v}`); prev = g } })
test("Fuera de rango se acota (no da ganancias negativas ni > máx)", () => { assert.equal(volumeToGain(-50), 0); assert.equal(volumeToGain(999), 0.9) })
test("Volumen bajo sigue audible (5 -> mayor que 0)", () => assert.ok(volumeToGain(5) > 0))

console.log("Guardado")
test("Ida y vuelta", () => assert.deepEqual(parseSettings(serializeSettings({ volume: 30, vibration: false })), { volume: 30, vibration: false }))
test("Sin nada guardado: valores por defecto", () => assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS))
test("Devuelve copias (modificar el resultado no altera los defaults)", () => { const a = parseSettings(null); a.volume = 1; assert.equal(DEFAULT_SETTINGS.volume, 75) })
for (const [label, raw] of [["JSON inválido", "{x"], ["array", "[]"], ["null", "null"], ["versión desconocida", wrap({ volume: 10 }, 9)], ["sin versión", JSON.stringify({ settings: { volume: 10 } })], ["settings null", wrap(null)], ["settings array", wrap([1, 2])], ["string", '"hola"']] as const)
  test(`Contenido dañado (${label}): defaults, sin excepción`, () => assert.deepEqual(parseSettings(raw), DEFAULT_SETTINGS))
test("Acota el volumen: 500 -> 100, -20 -> 0, 33.6 -> 34", () => { assert.equal(parseSettings(wrap({ volume: 500 })).volume, 100); assert.equal(parseSettings(wrap({ volume: -20 })).volume, 0); assert.equal(parseSettings(wrap({ volume: 33.6 })).volume, 34) })
test("Tipos incorrectos caen al default CAMPO A CAMPO (el bueno se conserva)", () => {
  assert.deepEqual(parseSettings(wrap({ volume: "alto", vibration: false })), { volume: 75, vibration: false })
  assert.deepEqual(parseSettings(wrap({ volume: 20, vibration: "si" })), { volume: 20, vibration: true })
  assert.deepEqual(parseSettings(wrap({ volume: null, vibration: null })), DEFAULT_SETTINGS)
})
test("Campos desconocidos se ignoran", () => assert.deepEqual(parseSettings(wrap({ volume: 40, vibration: true, apiKey: "sk-secreto", provider: "mubert" })), { volume: 40, vibration: true }))
test("El volumen 0 es válido (no se confunde con 'falta')", () => assert.equal(parseSettings(wrap({ volume: 0 })).volume, 0))
test("normalizeSettings acota antes de guardar", () => assert.deepEqual(normalizeSettings({ volume: 400, vibration: true }), { volume: 100, vibration: true }))
test("Idempotente", () => { const once = parseSettings(wrap({ volume: 999, vibration: "x" })); assert.deepEqual(parseSettings(serializeSettings(once)), once) })

console.log(`\n${passed} pruebas OK`)
