# POWERLOCK — Hoja de ruta (salir del simulador)

Regla: si algo no hace algo real (persistir, sonar, medir), sale.
No se pasa a la siguiente ronda hasta cumplir la luz verde de la actual.

| Ronda | Objetivo | Estado |
|-------|----------|--------|
| 1 | **Timer real** | ✅ hecha (falta tu prueba en el móvil) |
| 2 | **Rutinas reales** (un solo modelo/creador, persistencia, scroll del selector) | ✅ hecha (falta tu prueba en el móvil) |
| 3 | **Historial real** (sesiones guardadas, estadísticas calculadas) | ✅ hecha (falta tu prueba en el móvil) |
| 4 | **Purga de lo simulado** (Mubert, Fal.ai, API keys, popup Tone.js, Beats IA, pulso falso) | ✅ hecha (falta tu prueba en el móvil) |
| 5 | **Listo para producción** (tipos sin `ignoreBuildErrors`, eslint, dependencias, CSS, imágenes) | ✅ código hecho · falta `pnpm install` + `pnpm verify` en tu PC y tu prueba en el móvil |
| 6 | **Pulso cardíaco real** (Web Bluetooth, perfil estándar Heart Rate) | ✅ código hecho · falta tu prueba con un sensor real |
| 7 | **Auditoría multipantalla** + README completo + versión final | ✅ hecha (código y guardas) · falta tu revisión en el móvil (ver AUDIT.md) |
| 8 | **v2.0:** app instalable + sin conexión, copia de seguridad, peso/reps por serie con volumen y récords | ✅ código hecho · falta tu prueba en el móvil |

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
- [ ] En el Reloj no hay pulso inventado, "Conectado" fijo, beats ni proveedores de audio (el pulso real llegó en la Ronda 6, solo con un sensor conectado).
- [ ] El engranaje abre "Sonido y vibración": volumen, vibración y "Probar avisos". Nada más.
- [ ] Bajar el volumen baja los avisos; en 0 no suena nada. "Probar avisos" suena con ese volumen.
- [ ] Vibración apagada = no vibra (y si tu navegador no puede vibrar, el interruptor aparece deshabilitado con el motivo).
- [ ] Cierras y abres la app: volumen y vibración se conservan.

### Qué cambió
- Eliminado: monitor cardíaco (BPM aleatorio y "Bluetooth conectado" fijo, "cal/min" sin sentido), Beats
  Biométricos "IA" (nunca sonaba), proveedores Mubert / Fal.ai (conexión y API keys falsas), y el popup de Tone.js
  que cargaba un script de un CDN. El reloj pasó de 900 a ~550 líneas.
- Nuevo y real: `lib/settings.ts` + `hooks/use-settings.ts` + `components/settings-modal.tsx`.
  El volumen usa una curva cuadrática (75 ≈ nivel anterior, 100 = máximo sin saturar, 0 = silencio real).
- `scripts/test-no-simulated.ts` es una guarda permanente: si una ronda futura reintroduce datos aleatorios,
  esperas artificiales, API keys en el cliente, CDNs o ventanas emergentes, `pnpm test` falla.

### Decisiones abiertas
- "Beats sincronizados al pulso" ya no existe (nunca funcionó). Se puede reconsiderar DESPUÉS de la Ronda 6,
  cuando haya un pulso real que sincronizar.
- Ronda 6 (pulso real): Web Bluetooth funciona en Chrome/Android; Safari de iPhone NO lo soporta.
  Si tu móvil es iPhone habrá que elegir otro camino (app nativa/PWA con puente).

## Ronda 5 — luz verde
Comandos (en tu PC, una sola vez): `pnpm install` (genera `pnpm-lock.yaml`; **súbelo**) y luego `pnpm verify`.
- [ ] `pnpm install --frozen-lockfile` pasa (es lo que hace Vercel).
- [ ] `pnpm typecheck` sin errores (antes `ignoreBuildErrors` los ocultaba).
- [ ] `pnpm lint` sin errores.
- [ ] `pnpm test` en verde (incluye las guardas nuevas: catálogo e higiene, con el chequeo del lockfile).
- [ ] `pnpm build` limpio y el despliegue de Vercel en verde.
- [ ] En el móvil: los 4 modos del reloj muestran su nombre; el zoom con dos dedos funciona; la barra de abajo
      no tapa contenido ni el botón "Crear Rutina"; los chips de filtros se deslizan sin barra de scroll.

### Qué cambió
- Eliminado: `components/ui/` (~60 archivos de shadcn que nada usaba), `routine-card`, `week-progress`,
  `theme-provider`, `hooks/use-toast`, `hooks/use-mobile`, `styles/globals.css` (duplicado), `components.json`,
  imágenes `placeholder*`, y ~30 dependencias (Radix, recharts, sonner, react-hook-form, zod, etc.).
  Quedan 7 dependencias de ejecución.
- `next.config`: fuera `ignoreBuildErrors`. Añadidos `eslint` + `eslint-config-next` (`eslint.config.mjs`) y `pnpm typecheck`.
- CSS: definidas las utilidades que se usaban sin existir (`scrollbar-hide`, `pb-safe`) y añadidas `pb-nav` / `bottom-nav`
  (espacio bajo la barra + zona segura). La clase `xs:` nunca existió y por eso los nombres de los modos estaban
  ocultos: ahora se ven siempre. La sombra del botón Play era CSS inválido (no se veía) y se corrigió.
  La fuente Inter se aplicaba mal (`'Inter'` literal en vez de la variable de `next/font`).
- Móvil: `min-h-screen` -> `min-h-dvh`; el zoom ya no está bloqueado; `viewport-fit=cover` + zonas seguras.
- Catálogo: 5 ejercicios duplicados exactos (mismo nombre y equipo) fuera; las imágenes tienen respaldo si no cargan
  (`ExerciseThumb`) y el modal de video ofrece "Ábrelo en YouTube" si el video no carga.
- Guardas nuevas en `pnpm test`: `test-catalog.ts` y `test-hygiene.ts` (dependencias sin usar, módulos huérfanos,
  CSS sin definir, zoom, `ignoreBuildErrors` y **lockfile sincronizado con package.json**).

### Límites conocidos (no verificado)
- No se pudo ejecutar `tsc`, `eslint` ni `next build` al preparar esta ronda (sin red). El código se revisó a mano;
  si `pnpm typecheck` o `pnpm lint` marcan algo, es lo primero a corregir.
- Las 37 fotos de Unsplash y los 27 videos de YouTube no se pueden comprobar sin red. Si alguno no carga, la app
  muestra un icono / un enlace, pero conviene revisarlos una vez a mano. Además, las fotos de stock se repiten
  (24 imágenes distintas para 37 ejercicios): no son fotos del ejercicio real.
- `react-hooks/set-state-in-effect` está desactivada a propósito (los hooks leen localStorage tras montar).

## Ronda 6 — luz verde (en tu móvil, con un sensor real)
Necesitas Chrome en **Android** y un sensor que transmita el pulso estándar por Bluetooth LE
(banda de pecho o brazalete; o tu Galaxy Watch con una app que transmita el pulso, ver README).
- [ ] Sin sensor, el Reloj muestra "Conectar sensor de pulso" y ningún número. En iPhone/Safari dice que no está disponible y por qué.
- [ ] Tocas "Conectar", eliges tu sensor y aparece tu pulso real, que sube y baja contigo.
- [ ] Te quitas la banda / la separas de la piel: el número desaparece ("sin contacto") en vez de quedarse congelado.
- [ ] Alejas el sensor o lo apagas ~10 s: aparece "Reconectando… (intento n)" y, al volver, retoma solo.
- [ ] Haces un Tabata completo con el sensor: en Historial la sesión muestra "N prom · M máx" coherentes con lo que viste.
- [ ] Una sesión sin sensor NO muestra pulso. "Desconectar" corta el sensor.

### Qué cambió
- `lib/heart-rate.ts` (puro): decodifica el paquete estándar Heart Rate Measurement (8/16 bits, contacto, energía y RR
  no desplazan el pulso), descarta lecturas fuera de 30–250 lpm y calcula promedio (ponderado por tiempo) y máximo.
- `lib/heart-rate-ble.ts`: conexión Web Bluetooth como máquina de estados (conectando, conectado, reconectando con
  5 reintentos, error explicado). Es el ÚNICO origen del pulso: la guarda anti-simulación lo impone.
- `components/heart-rate-pill.tsx` + `hooks/use-heart-rate.ts`: indicador bajo la cabecera del Reloj. Solo muestra un número
  cuando el sensor conectado lo está enviando; sin lectura en 6 s vuelve a "esperando señal".
- Historial: cada sesión guarda `avgBpm` / `maxBpm` (opcionales; solo si el sensor midió >= 10 s). Las sesiones antiguas
  siguen siendo válidas. Un pulso guardado dudoso se descarta, nunca se "corrige".
- Sin dependencias nuevas (los tipos de Web Bluetooth se declaran en el propio archivo).

### Límites conocidos
- **No se ha probado con hardware real**: solo con un sensor simulado (34 pruebas + 9 mutaciones detectadas). La primera prueba
  con tu banda/reloj es la luz verde de arriba.
- Web Bluetooth: Chrome/Edge en Android y escritorio; **no existe en Safari de iPhone**. En iPhone habría que usar un
  navegador de terceros con soporte (p. ej. Bluefy; no verificado) o una app nativa.
- **Relojes Samsung (Galaxy Watch 7):** no transmiten el pulso por Bluetooth de serie; hace falta una app de terceros en el reloj
  (p. ej. Heart for Bluetooth, disponibilidad incierta) y, según reportes de usuarios, en Watch 7/Ultra el pulso se congela si la pantalla
  del reloj se apaga. **Sin probar en un Watch 7 real.** Detalles en el README. Apple Watch no transmite el perfil estándar.
  Una banda de pecho BLE es lo más fiable.
- La app no detecta un pulso "congelado" que siga llegando (solo la ausencia de lecturas). Posible mejora: avisar si el valor no cambia en mucho tiempo.
- El sensor debe estar libre: si está conectado a otra app o a un reloj, puede no dejarse elegir.
- En Android antiguo, Chrome puede pedir la ubicación activada para buscar dispositivos Bluetooth.
- Con la pantalla bloqueada el navegador suspende la página y se pierden lecturas (el Wake Lock evita el bloqueo mientras corre).
- No hay calorías, zonas ni "beats sincronizados": lo inventado sigue fuera.

## Ronda 7 — auditoría multipantalla (luz verde en tu móvil)
Informe completo, con cada hallazgo, cómo se midió y la lista por tamaño de pantalla: [AUDIT.md](./AUDIT.md).
- [ ] Creador de rutinas: el botón **Guardar rutina** se ve entero (ya no queda bajo la barra inferior).
- [ ] Ajustes de sonido: se ve **Probar avisos** completo; al girar el móvil el modal hace scroll y el botón de cerrar se alcanza.
- [ ] Editor de rutinas en un móvil de 360–390 px: los botones **+ / −** de series y repeticiones se ven enteros; el nombre del ejercicio se lee.
- [ ] Cronómetro pasados los 10 min (y 60 min): el número cabe en la pantalla.
- [ ] Rutinas: el menú (⋮) de la **última** rutina se ve completo; el botón flotante no tapa botones de la última tarjeta; con la lista vacía no hay dos "Crear Rutina" pisados.
- [ ] En una pantalla baja (≈ 640 px de alto) el botón **Iniciar** se ve sin hacer scroll.
- [ ] En tablet / escritorio la app queda en una columna centrada y el botón flotante alineado con ella.

## v2: estado (por prioridad)
Pensada para el uso real (Chrome en Android, relojes Samsung). Nada de lo que se quitó por ser falso vuelve.
Las 3 primeras están **hechas en código** (Ronda 8, abajo); pendientes de tu prueba en el móvil.
1. ✅ **Instalable (PWA) y sin conexión:** manifest, service worker e iconos. Abre a pantalla completa (sin barra del navegador), funciona en el gimnasio sin red
   (también videos/fotos propios) y arregla de raíz las zonas seguras. Esfuerzo bajo-medio, valor alto.
2. ✅ **Copia de seguridad:** exportar/importar JSON de rutinas, historial, series y ajustes, con combinar/reemplazar. Sigue siendo cierto que borrar los datos del navegador lo pierde todo: la copia es la red de seguridad.
   Cuenta/nube opcional después.
3. ✅ **Peso y repeticiones reales por serie:** registrar kg y reps hechas → volumen real, progreso por ejercicio y récords en el Historial
   (lo que se quitó como "Volumen kg" por no poder calcularse). Esfuerzo medio-alto.
4. **Pulso más completo:** zonas con **FC máxima que introduce el usuario**, gráfico de pulso por sesión, aviso de valor congelado, y una vía fiable para
   Samsung (app compañera de Wear OS: esfuerzo alto, mejor como v3).
5. **Modos editables:** cambiar trabajo/descanso/rondas de Tabata/EMOM/FGB, calentamiento y enfriamiento, avisos por voz ("cambio", 3-2-1) y sonidos elegibles.
6. **Calidad automática:** pruebas E2E con Playwright en CI (GitHub Actions ejecutando `pnpm verify` y capturas por tamaño de pantalla), para que esta auditoría
   de layout deje de ser manual.
7. **Contenido de ejercicios propio:** imágenes/GIFs propios o con licencia, autoalojados (hoy son fotos de stock repetidas) y catálogo ampliable.

Fuera de alcance mientras no sean reales: calorías estimadas, "IA", beats sincronizados, funciones sociales.

## Ronda 8 — v2.0: instalable, copias y series (luz verde en tu móvil, Chrome Android)
Todo lo de esta ronda se probó con simuladores (un navegador falso para el service worker, datos de prueba para copias y series);
**nada se ha probado en un móvil real**. Esta lista es esa prueba.

**Instalar y sin conexión**
- [ ] Ajustes → **Instalar app** (si Chrome ya la ofrece) o menú ⋮ → "Instalar app": aparece el icono (cronómetro con rayo) y se abre a pantalla completa.
- [ ] Con internet, abre la app y espera ~10 s. Activa el modo avión, ciérrala del todo y ábrela: **carga**; Reloj, Rutinas, Historial, Progreso y Ajustes funcionan (Ajustes avisa "Sin conexión").
- [ ] Sin conexión: los videos de YouTube no cargan (se ve el enlace "Ábrelo en YouTube"); las fotos de ejercicios cargan o muestran un icono, sin romper nada.
- [ ] Tras un despliegue nuevo, abre con internet: la app usa la versión nueva (puede pedir abrirla una segunda vez).

**Copia de seguridad**
- [ ] **Descargar copia** genera `powerlock-copia-AAAA-MM-DD.json`; "Compartir copia" aparece solo si tu navegador lo permite y abre el menú de compartir.
- [ ] Restaura en otro navegador o tras borrar los datos del sitio: vuelven rutinas, historial, series y ajustes. **Combinar** dos veces la misma copia no duplica nada.
- [ ] Elegir una foto o un PDF en "Restaurar" da un mensaje claro y **no toca** tus datos.

**Peso y repeticiones**
- [ ] Ejecuta una rutina con un ejercicio por repeticiones: al terminar una serie aparece la tarjeta con el último peso; cambia peso/reps y **Guardar serie** → "Serie guardada".
- [ ] **Omitir**, o no tocar nada, no guarda nada. Una serie por tiempo pide solo el peso.
- [ ] Historial: la sesión muestra "N kg · M series"; al abrirla ves cada serie; borrar una serie o la sesión se refleja en el volumen semanal.
- [ ] Progreso: sale el ejercicio con mejor peso/serie; con 2+ sesiones se dibuja la gráfica; superar tu mejor peso muestra "¡Récord de peso!".
- [ ] La tarjeta y los botones se ven enteros y sin pisarse en 360 y 390 px (ver AUDIT.md).

### Qué cambió
- **PWA:** `app/manifest.ts`, `public/sw.js` (sin dependencias), iconos propios 192/512/maskable, `components/service-worker-register.tsx`, botón de instalar en Ajustes
  (`hooks/use-install-prompt.ts`) y aviso sin conexión. La versión de la caché es el commit de Vercel (`NEXT_PUBLIC_BUILD_ID`).
- **Copia de seguridad:** `lib/backup.ts` (formato versionado, validación por parte, combinar/reemplazar) y `components/backup-section.tsx`.
- **Series:** `lib/set-log.ts`, `hooks/use-set-logs.ts`, `components/set-log-card.tsx`, `completedWorkIndices` en el motor, volumen en Historial y la pestaña **Progreso**.
- El modal de sonido pasó a **Ajustes** (`components/settings-modal.tsx`). La barra inferior tiene 4 pestañas.

### Límites conocidos
- La instalación depende de que Chrome ofrezca la app (no siempre a la primera visita); el menú ⋮ → "Instalar app" es la vía manual.
- Para abrir sin conexión hace falta haber abierto la app una vez con internet (el service worker guarda los archivos entonces).
- Fotos de terceros: se guardan solo si el servidor permite CORS (no verificado para Unsplash / miniaturas de YouTube); si no, sin conexión se ve un icono.
- Solo kilos; no se pueden editar series ya guardadas (sí borrar); el peso/reps solo se anota en rutinas.
- Tope de 10 000 series (~2 MB de almacenamiento local). La copia no cifra nada: es un archivo legible con tus datos.

## Pruebas
- `pnpm test` — 569 pruebas: motor (25), rutinas (27), ajustes (23), guarda anti-simulación (17), pulso (34),
  catálogo (9), copia de seguridad (17), PWA (24), higiene (23), historial (47 x 5) y series (27 x 5) en 5 zonas horarias. Requiere `pnpm install` (añade `tsx`).
- `pnpm verify` — instala con lockfile congelado, tipos, lint, pruebas y build (lo mismo que hace Vercel + más).
