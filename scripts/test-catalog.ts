/**
 * Coherencia del catálogo de ejercicios. Sin red no se puede comprobar que una foto cargue,
 * pero sí todo lo que hace que una entrada esté mal formada o sea inalcanzable en los filtros.
 * Uso: pnpm test:catalog
 */
import assert from "node:assert/strict"
import { bodyParts, equipmentTypes, exerciseDatabase } from "../lib/exercise-db.ts"

let passed = 0
function test(name: string, fn: () => void) { try { fn(); passed++; console.log(`  ok  ${name}`) } catch (e) { console.error(`FAIL  ${name}`); throw e } }

const list = exerciseDatabase
const bp = bodyParts as readonly string[]
const eq = equipmentTypes as readonly string[]

test("Hay ejercicios", () => assert.ok(list.length > 0))
test("Los ids son únicos", () => {
  const seen = new Set<string>()
  for (const e of list) { assert.ok(!seen.has(e.id), `id repetido: ${e.id}`); seen.add(e.id) }
})
test("No hay dos ejercicios con el mismo nombre Y el mismo equipo (serían indistinguibles en la lista)", () => {
  const seen = new Set<string>()
  for (const e of list) { const k = `${e.name}|${e.equipment}`; assert.ok(!seen.has(k), `duplicado: ${e.name} (${e.equipment})`); seen.add(k) }
})
test("Todo grupo muscular y equipo existe en los filtros (si no, el ejercicio no se puede filtrar)", () => {
  for (const e of list) {
    assert.ok(bp.includes(e.bodyPart), `${e.id}: grupo fuera de filtros "${e.bodyPart}"`)
    assert.ok(eq.includes(e.equipment), `${e.id}: equipo fuera de filtros "${e.equipment}"`)
  }
})
test("Todo filtro tiene al menos un ejercicio (no hay chips que devuelvan 0)", () => {
  for (const b of bp) assert.ok(list.some((e) => e.bodyPart === b), `sin ejercicios de ${b}`)
  for (const q of eq) assert.ok(list.some((e) => e.equipment === q), `sin ejercicios con ${q}`)
})
test("Las imágenes son URLs https válidas", () => {
  for (const e of list) {
    const u = new URL(e.gifUrl)
    assert.equal(u.protocol, "https:", `${e.id}: ${e.gifUrl}`)
  }
})
test("Los videoId de YouTube tienen 11 caracteres válidos", () => {
  for (const e of list) if (e.videoId !== undefined) assert.match(e.videoId, /^[A-Za-z0-9_-]{11}$/, `${e.id}: ${e.videoId}`)
})
test("La miniatura de YouTube corresponde al videoId del mismo ejercicio", () => {
  for (const e of list) {
    if (e.videoId) assert.ok(e.gifUrl.includes(`/vi/${e.videoId}/`), `${e.id}: miniatura y video no coinciden`)
    else assert.ok(!/youtube/.test(e.gifUrl), `${e.id}: miniatura de YouTube sin videoId`)
  }
})
test("Los campos de texto no están vacíos", () => {
  for (const e of list) for (const k of ["id", "name", "bodyPart", "equipment", "gifUrl", "target"] as const) assert.ok(e[k].trim() !== "", `${e.id}.${k} vacío`)
})

console.log(`${passed} pruebas OK`)
