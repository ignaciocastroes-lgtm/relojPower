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
  ...ZONES.map((tz) => ({ name: `historial [${tz}]`, file: "scripts/test-session-log.ts", tz })),
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
