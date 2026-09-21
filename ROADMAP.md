# POWERLOCK — Hoja de ruta (salir del simulador)

Regla: si algo no hace algo real (persistir, sonar, medir), sale.
No se pasa a la siguiente ronda hasta cumplir la luz verde de la actual.

| Ronda | Objetivo | Estado |
|-------|----------|--------|
| 1 | **Timer real** | ✅ hecha (falta tu prueba en el móvil) |
| 2 | **Rutinas reales** (un solo modelo/creador, persistencia, scroll del selector) | ✅ hecha (falta tu prueba en el móvil) |
| 3 | **Historial real** (sesiones guardadas, estadísticas calculadas) | ✅ hecha (falta tu prueba en el móvil) |
| 4 | **Purga de lo simulado** (Mubert, Fal.ai, API keys, popup Tone.js, Beats IA, pulso falso) | ✅ hecha (falta tu prueba en el móvil) |
| 5 | Listo para producción (tipos sin `ignoreBuildErrors`, eslint, dependencias, CSS, imágenes) | pendiente |
| 6 | **DEUDA:** pulso cardíaco real con tus relojes/bandas (Web Bluetooth) | al final |

## Ronda 1 — luz verde (en tu móvil)
- [ ] Tabata completo con la pantalla encendida: suenan 3-2-1, inicio de trabajo, descanso y fin.
- [ ] Cambias a Rutinas y vuelves a mitad de sesión: el reloj sigue en el punto correcto.
- [ ] Bloqueas la pantalla a mano y desbloqueas: el reloj está donde debe (no habrá beeps mientras está bloqueada, ver límites).
- [ ] Pausa/reanudar y ⏭ se comportan como se espera.

### Límites conocidos (web, no bug)
- Con la pantalla bloqueada a mano el navegador suspende la página: no suenan beeps hasta desbloquear.
  Por eso se usa Wake Lock (evita el auto-bloqueo mientras corre). Beeps con pantalla bloqueada exigen app nativa/PWA instalada.
- Vibración: no existe en iPhone (Safari); sí en Android/Chrome.
- iPhone: el interruptor de silencio puede mutear los beeps (por verificar en equipo).

## Ronda 2 — luz verde (en tu móvil)
- [ ] Creas una rutina con 2 ejercicios (uno por tiempo, uno por repeticiones) y la guardas.
- [ ] Cierras la app del todo, la abres de nuevo: la rutina sigue ahí.
- [ ] La reproduces completa en el reloj: la serie por tiempo dura lo que configuraste.
- [ ] Editar conserva los ejercicios; Duplicar y Eliminar funcionan.
- [ ] En "Añadir Ejercicio" puedes hacer scroll hasta el final y el buscador no queda tapado.
- [ ] Tu equipo (Barra Smith, remadora, cuerda, elásticos) aparece en los filtros.

### Qué cambió
- Un solo creador (`routine-timeline-builder`) y un solo modelo (`lib/types.ts`). Se eliminaron
  `routine-creator`, `exercise-picker` y `exercises-data`: sus 27 ejercicios (con video) pasaron al catálogo único.
- Guardado en localStorage (`lib/routine-storage.ts` + `hooks/use-routines.ts`) con validación:
  datos dañados se descartan sin romper la app, se guarda copia en `powerlock:routines:v1:corrupt`,
  y si guardar falla se avisa en pantalla.
- La duración estimada usa la misma fórmula que ejecuta el reloj (`estimateRoutineMinutes`).
- Reordenar con botones (el drag & drop HTML5 no es fiable en táctil).
- Ya no hay rutinas de ejemplo vacías.

### Límites conocidos
- Dos pestañas abiertas a la vez: gana la última que guarda (sin sincronización entre pestañas).
- Los IDs de YouTube y las fotos de los ejercicios no se pueden verificar sin red; se revisan en la Ronda 5.
- Tocar Play en otra rutina mientras entrenas reemplaza la sesión en curso sin preguntar.

## Ronda 3 — luz verde (en tu móvil)
- [ ] Terminas un Tabata (o una rutina): aparece en Historial con el nombre, "Hoy · hora", y la MISMA duración que mostró el "Tiempo total" del reloj.
- [ ] Reiniciar a mitad (pasados 30 s) deja una sesión "Parcial"; antes de 30 s no deja nada.
- [ ] Estadísticas y racha coinciden con lo que entrenaste (semana de lunes a domingo).
- [ ] Cierras la app a mitad de una sesión, la abres: aparece como "Parcial" con aviso de recuperación.
- [ ] Recargar no borra ni duplica nada; eliminar una sesión pide confirmación.

### Qué cambió
- El reloj registra cada sesión (`lib/session-log.ts`, `hooks/use-sessions.ts`): fecha, duración, modo o rutina,
  rondas/series y si terminó. Se eliminó todo el historial inventado (4 sesiones, 3:45 h, 12.5K kg, racha 12).
- Reglas: termina sola = completa; Reiniciar / cambiar de modo o rutina = "parcial" (solo si ≥ 30 s);
  el cronómetro al detenerlo cuenta como completo. Saltar todo sin cronometrar no crea sesión.
- Mientras entrenas se guarda una "foto" cada 10 s (`powerlock:active-session:v1`); si la app se cierra a medias,
  se recupera como sesión parcial al abrirla.
- Estadísticas: sesiones y tiempo de la semana (lunes–domingo), racha (viva si entrenaste ayer), total.
  Se quitó "Volumen (kg)": nada registra pesos, así que no se puede calcular de verdad.
- Las fechas usan calendario local (no "24 h"), probado alrededor de cambios de hora en 5 zonas horarias.

### Límites conocidos
- Si la app muere de golpe se pierden como máximo los últimos ~10 s de esa sesión.
- Saltar con ⏭ cuenta la ronda como hecha (es lo que el usuario indicó).
- Tocar Play en otra rutina mientras entrenas reemplaza la sesión en curso sin preguntar
  (ahora lo entrenado hasta ese momento queda registrado como parcial).
- El historial guarda hasta 3000 sesiones (las más antiguas se descartan).

## Ronda 4 — luz verde (en tu móvil)
- [ ] En el Reloj no hay nada de pulso, "Bluetooth", "Conectado", beats ni proveedores de audio.
- [ ] El engranaje abre "Sonido y vibración": volumen, vibración y "Probar avisos". Nada más.
- [ ] Bajar el volumen baja los avisos; en 0 no suena nada. "Probar avisos" suena con ese volumen.
- [ ] Vibración apagada = no vibra (y si tu navegador no puede vibrar, el interruptor aparece deshabilitado con el motivo).
- [ ] Cierras y abres la app: volumen y vibración se conservan.

### Qué cambió
- Eliminado: monitor cardíaco (BPM aleatorio y "Bluetooth conectado" fijo, "cal/min" sin sentido), Beats
  Biométricos "IA" (nunca sonaba), proveedores Mubert / Fal.ai (conexión y API keys falsas), y el popup de Tone.js
  que cargaba un script de un CDN. El reloj pasó de 900 a ~550 líneas.
- Nuevo y real: `lib/settings.ts` + `hooks/use-settings.ts` + `components/sound-settings-modal.tsx`.
  El volumen usa una curva cuadrática (75 ≈ nivel anterior, 100 = máximo sin saturar, 0 = silencio real).
- `scripts/test-no-simulated.ts` es una guarda permanente: si una ronda futura reintroduce datos aleatorios,
  esperas artificiales, API keys en el cliente, CDNs o ventanas emergentes, `pnpm test` falla.

### Decisiones abiertas
- "Beats sincronizados al pulso" ya no existe (nunca funcionó). Se puede reconsiderar DESPUÉS de la Ronda 6,
  cuando haya un pulso real que sincronizar.
- Ronda 6 (pulso real): Web Bluetooth funciona en Chrome/Android; Safari de iPhone NO lo soporta.
  Si tu móvil es iPhone habrá que elegir otro camino (app nativa/PWA con puente).

## Pruebas
- `pnpm test` — 322 pruebas unitarias (motor, rutinas, ajustes, historial en 5 zonas horarias, y la guarda
  anti-simulación). Requiere `pnpm install` (añade `tsx`).
