/**
 * Ejecuta todas las pruebas unitarias. La suite de fechas/racha se corre en varias
 * zonas horarias (incluidas dos con cambio de hora) porque esos bugs solo aparecen ahí.
 * Uso: pnpm test
 */
import { spawnSync } from "node:child_process"

const ZONES = ["America/Argentina/Buenos_Aires", "America/Santiago", "Europe/Madrid", "America/New_York", "UTC"]

const jobs: { name: string; file: string; tz?: string }[] = [
  { name: "motor del reloj", file: "scripts/test-timer-engine.ts" },
  { name: "rutinas (persistencia)", file: "scripts/test-routine-storage.ts" },
  { name: "ajustes (volumen y vibración)", file: "scripts/test-settings.ts" },
  { name: "guarda anti-simulación", file: "scripts/test-no-simulated.ts" },
  { name: "pulso cardíaco (Bluetooth simulado)", file: "scripts/test-heart-rate.ts" },
  { name: "catálogo de ejercicios", file: "scripts/test-catalog.ts" },
  { name: "copia de seguridad", file: "scripts/test-backup.ts" },
  { name: "app instalable / sin conexión (PWA)", file: "scripts/test-service-worker.ts" },
  { name: "higiene (deps, CSS, lockfile)", file: "scripts/test-hygiene.ts" },
  ...ZONES.map((tz) => ({ name: `historial [${tz}]`, file: "scripts/test-session-log.ts", tz })),
  ...ZONES.map((tz) => ({ name: `series y volumen [${tz}]`, file: "scripts/test-set-log.ts", tz })),
]

let failed = 0
for (const job of jobs) {
  const res = spawnSync("npx", ["tsx", job.file], {
    env: { ...process.env, ...(job.tz ? { TZ: job.tz } : {}) },
    encoding: "utf-8",
    shell: true,
  })
  const last = (res.stdout || "").trim().split("\n").pop() ?? ""
  if (res.status === 0) console.log(`  ok  ${job.name.padEnd(48)} ${last}`)
  else {
    failed++
    console.log(`FAIL  ${job.name}\n${res.stdout}\n${res.stderr}`)
  }
}
console.log(failed === 0 ? "\nTodas las pruebas pasan" : `\n${failed} suite(s) fallaron`)
process.exit(failed === 0 ? 0 : 1)
