# POWERLOCK

Temporizador de entrenamiento para el móvil: **Tabata, EMOM, FGB, cronómetro y rutinas propias**, con historial real,
registro de **peso y repeticiones** por serie (volumen y récords), avisos sonoros y vibración, pulso cardíaco en vivo desde un sensor
Bluetooth, y **se instala como app y funciona sin conexión**.

- Next.js 16 · React 19 · Tailwind 4 · TypeScript estricto.
- **Todo se guarda en el navegador** (`localStorage`). No hay servidor, cuentas ni base de datos. Hay **copia de seguridad** (exportar/restaurar un archivo).
- Regla del proyecto: **si algo no hace algo real (persistir, sonar, medir), no está en la app.**
  No hay datos de ejemplo, ni pulso inventado, ni calorías estimadas; una guarda automática lo impide.

## Qué incluye

| Pestaña | Qué hace |
|---|---|
| **Reloj** | Tabata (20/10 × 8), EMOM (1 min × 10), FGB (3 × 5 min), cronómetro y rutinas propias. Cuenta 3-2-1 y avisos por fase, pausa, saltar, reiniciar. Sigue contando aunque bloquees la pantalla (mide tiempo real, no ticks). Wake Lock para que la pantalla no se apague mientras corre. **Al terminar cada serie de una rutina** aparece una tarjeta para anotar el peso y las repeticiones (ver abajo). |
| **Rutinas** | Biblioteca de 64 ejercicios (con video de demostración en 27) y creador de rutinas: series, repeticiones o segundos, descansos, reordenar, editar, duplicar y borrar. Se ejecutan completas en el Reloj. |
| **Historial** | Cada sesión guardada con fecha, duración, modo/rutina, rondas, pulso medio/máximo (si había sensor) y, si anotaste series, su **volumen** y el detalle serie a serie. Estadísticas de la semana (lunes–domingo): sesiones, tiempo, racha, total, **volumen y series**. Recupera una sesión si la app se cierra a medias. |
| **Progreso** | Por ejercicio: mejor peso, mejor serie (peso × reps), volumen total, sesiones y una gráfica del peso máximo por sesión. Solo con lo que registraste. |
| **Ajustes** (engranaje del Reloj) | Volumen (0 = silencio real), vibración y "Probar avisos"; **instalar la app**; **copia de seguridad** (descargar / compartir / restaurar). |

### Peso y repeticiones (cómo funciona)
- Solo en **rutinas**. Al completar una serie (sola, o con ⏭) aparece la tarjeta "Registrar serie N de M" con el **último peso que usaste** en ese ejercicio y las reps del plan **como sugerencia**.
- **Solo se guarda lo que confirmas con "Guardar serie".** "Omitir" no guarda nada; si no haces nada, no se registra nada (una guarda automática lo impide).
- 0 kg = peso corporal. Volumen = peso × repeticiones; las series por tiempo no suman volumen.
- Si superas tu mejor peso o tu mejor serie de ese ejercicio, la app lo dice (nunca en la primera vez que haces un ejercicio).
- Borrar una sesión borra sus series; puedes borrar una serie suelta desde el detalle de la sesión.

### Instalar y usar sin conexión
- **Instalar:** Ajustes → "Instalar app" (o menú ⋮ de Chrome → "Instalar app"). Se abre a pantalla completa con su icono.
- **Sin conexión:** abre la app **una vez con internet** y espera unos segundos; después abre sin red (rutinas, reloj, historial, progreso y ajustes funcionan).
  Los **videos de YouTube** necesitan internet. Las fotos de ejercicios se guardan si el servidor de la foto lo permite; si no, se ve un icono.
- Un *service worker* propio (`public/sw.js`, sin dependencias) guarda la página y sus archivos; cada despliegue tiene su propia caché y borra las viejas.

### Copia de seguridad
- Ajustes → Copia de seguridad → **Descargar copia** (archivo `powerlock-copia-AAAA-MM-DD.json` con rutinas, historial, series y ajustes) o **Compartir copia** (si tu navegador lo permite: Drive, WhatsApp…).
- **Restaurar copia…:** eliges el archivo, ves qué contiene y decides **Combinar** (añade lo que falte, no borra ni pisa nada) o **Reemplazar todo** (con confirmación).
- Un archivo que no sea una copia de POWERLOCK se rechaza sin tocar tus datos; lo dañado dentro de una copia se descarta y se cuenta.
- Los datos viven solo en este navegador: **haz copias** (la app te lo recuerda pasados 30 días).

## Requisitos y navegadores

- **Chrome (o Edge) en Android** es el objetivo principal. Funciona en cualquier navegador moderno, salvo lo indicado:
  - Vibración: no existe en Safari de iPhone.
  - Pulso por Bluetooth (Web Bluetooth): **no existe en Safari de iPhone**; sí en Chrome/Edge de Android y escritorio, y solo en páginas `https`.
- Con la pantalla bloqueada a mano el navegador suspende la página: no suenan avisos hasta desbloquear (el reloj se pone al día al volver).
  Por eso se usa Wake Lock mientras corre. Avisos con la pantalla bloqueada exigirían una app instalada/nativa.

## Sensor de pulso (Bluetooth)

Lee un sensor Bluetooth LE con el perfil estándar *Heart Rate* (servicio `0x180D`). Sin sensor conectado **no se muestra ningún número**.

| Sensor | ¿Sirve? | Notas |
|---|---|---|
| Banda de pecho BLE (Polar H10/H9, Wahoo TICKR, Coospo, Magene…) | Sí, lo más fiable | Debe estar libre (no conectada a otra app o reloj). |
| Brazalete óptico BLE (Polar Verity Sense…) | Sí | Igual que la banda. |
| **Samsung Galaxy Watch (incl. Watch 7)** | **Solo con una app extra en el reloj** | Ver abajo. |
| Pixel Watch | Nativo en Pixel Watch 3/4 y en el 2 con Wear OS 6 (según prensa; sin probar aquí) | "Fitness conectado" en el panel rápido. |
| Apple Watch | No | No transmite el perfil estándar. |

**Galaxy Watch 7 (y otros Samsung).** Ningún Galaxy Watch transmite el pulso por Bluetooth por sí solo (hay peticiones abiertas a Samsung para añadirlo).
Hace falta una app de terceros **instalada en el reloj** que lo transmita como una banda, por ejemplo *Heart for Bluetooth*
(su disponibilidad es incierta: comprueba la Play Store de tu reloj). Es un problema conocido que en Watch 7/Ultra el pulso transmitido
se **congela** si la pantalla del reloj se apaga o pasa a "siempre activa": mantén la pantalla del reloj encendida.
La app descarta lecturas tras 6 s sin datos, pero no puede detectar un valor congelado que siga llegando.
**No probado en un Watch 7 real.** Si no funciona, una banda de pecho es la vía fiable.

**Si no aparece tu sensor:** Bluetooth activado (en Android antiguo Chrome puede pedir la ubicación activada); desconéctalo de otras apps;
el mensaje de error indica si el dispositivo no transmite el perfil estándar.

## Empezar (desarrollo)

```bash
pnpm install     # genera/actualiza pnpm-lock.yaml: súbelo SIEMPRE que cambie package.json
pnpm dev         # http://localhost:3000
```

Requiere Node ≥ 20.9 y pnpm 10.

| Comando | Qué hace |
|---|---|
| `pnpm typecheck` | Tipos (`tsc --noEmit`) |
| `pnpm lint` | ESLint (`eslint-config-next`) |
| `pnpm test` | Todas las pruebas unitarias y guardas (ver abajo) |
| `pnpm build` | Compilación de producción |
| `pnpm verify` | `install --frozen-lockfile` + tipos + lint + pruebas + build (lo que hace Vercel, y más) |

## Despliegue (Vercel)

Conecta el repositorio; Vercel detecta Next.js y pnpm. Instala con `--frozen-lockfile`: si `package.json` y `pnpm-lock.yaml` no coinciden, **el despliegue falla**
(`scripts/test-hygiene.ts` lo comprueba antes). Necesita `https` (ya lo da Vercel) para que funcione Web Bluetooth.

## Estructura

```
app/            página única (pestañas), layout y estilos globales (globals.css: utilidades propias)
components/     pantallas y piezas de UI (reloj, rutinas, historial, creador, modales, pastilla de pulso)
hooks/          acceso a localStorage y estado de React (use-routines, use-sessions, use-set-logs, use-settings, use-heart-rate, use-install-prompt, use-online)
public/          sw.js (service worker), icons/ (192, 512, maskable) e iconos de la app
lib/            lógica PURA y probada, sin React ni DOM:
  timer-engine    motor del reloj (segmentos + tiempo real)
  routine-storage / session-log / set-log / settings   validación y guardado (lo dañado se descarta, nunca rompe)
  set-log         series (peso/reps), volumen, récords y progreso
  backup          exportar, validar y combinar copias de seguridad
  install         estado de instalación (PWA)
  beeper          avisos con Web Audio + vibración
  heart-rate      decodificador del pulso y resumen de sesión
  heart-rate-ble  conexión Web Bluetooth (máquina de estados, API inyectada)
  exercise-db     catálogo de ejercicios
scripts/        pruebas (se ejecutan con tsx)
```

**Datos en `localStorage`** (versión 1, con copia `:corrupt` si algo se daña): `powerlock:routines:v1`, `powerlock:sessions:v1`,
`powerlock:active-session:v1` (foto de la sesión en curso, cada 10 s), `powerlock:sets:v1` (series, tope 10 000 ≈ 2 MB),
`powerlock:settings:v1`, `powerlock:last-backup:v1`. Borrar los datos del navegador borra todo: **haz copias de seguridad**.

## Pruebas y guardas (569)

`pnpm test` corre: motor del reloj (25), rutinas (27), ajustes (23), historial en 5 zonas horarias (47 × 5),
series y volumen en 5 zonas horarias (27 × 5), pulso con sensor simulado (34), catálogo (9), copia de seguridad (17),
service worker y manifiesto (24), **anti-simulación** (17) e **higiene** (23).

- **Anti-simulación:** falla si reaparecen datos aleatorios, esperas falsas, API keys en el cliente, CDNs, pulso que no venga del sensor, o series que se guarden sin que el usuario las confirme.
- **Higiene:** dependencias sin usar, módulos huérfanos, CSS sin definir, zoom bloqueado, `ignoreBuildErrors`, lockfile desincronizado y
  **layout**: orden de capas (nada queda tapado por la barra inferior), controles que no se recortan en 320–390 px, botones ≥ 40 px, modales que caben en pantallas bajas.

Las guardas de layout comprueban el **código**, no el render: no sustituyen a mirar la app en un móvil.
Las guardas y pruebas se validan por mutación (se rompe algo a propósito y se comprueba que fallan). El service worker se prueba ejecutando el propio `public/sw.js` en un entorno simulado (caché, red y eventos), no en un navegador real.

## Estado y documentos

- [ROADMAP.md](./ROADMAP.md): rondas 1–7, luz verde de cada una y propuesta de v2.
- [AUDIT.md](./AUDIT.md): informe de la auditoría multipantalla y lista de comprobación por tamaño de pantalla.

## Límites conocidos

- Sin sincronización entre dispositivos: los datos viven solo en ese navegador (se pueden mover con la copia de seguridad).
- Las fotos de ejercicios son fotos de stock (24 distintas para 37 ejercicios) y los videos son de YouTube: requieren red.
- Dos pestañas abiertas a la vez: gana la última que guarda.
- Solo kilos (sin libras). El peso y las reps se anotan solo en rutinas, no en Tabata/EMOM/FGB. Una serie ya guardada se puede borrar pero no editar.
- La instalación y el modo sin conexión están probados con un navegador simulado; **no se han probado en un móvil real** (ver ROADMAP, Ronda 8).
