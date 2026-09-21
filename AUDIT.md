# Auditoría multipantalla (Ronda 7)

**Alcance:** botones tapados o que se pisan, y contenido recortado, en pantallas de 320 a 1024 px (vertical) y móvil en horizontal.

**Método y sus límites (importante).** Esta auditoría se hizo **sin navegador**: se leyó el CSS real de cada pantalla, se reconstruyó el orden de capas (z-index + orden en el DOM)
y se calcularon los anchos y altas disponibles con las medidas de las clases (`px-5` = 20 px, `w-10` = 40 px…). Es fiable para lo que es aritmético o de apilado
(lo que se marca ✔ abajo), y **no sustituye a ver la app en un móvil**: la última columna dice qué hay que mirar a ojo.
Los defectos corregidos quedan protegidos por guardas en `scripts/test-hygiene.ts` (validadas por mutación: 12 regresiones provocadas, 12 detectadas).

## Hallazgos

| # | Gravedad | Hallazgo | Causa medida | Estado |
|---|---|---|---|---|
| 1 | **Alta** | El botón **Guardar rutina** (y la lista del selector de ejercicios) quedaban bajo la barra inferior | Creador y barra tenían `z-50`; la barra va después en el DOM y se pinta encima | ✔ Creador `z-60`, barra `z-40` |
| 2 | **Alta** | **Probar avisos** y el pie del modal de sonido quedaban bajo la barra | Igual: modal `z-50` = barra `z-50`, barra posterior | ✔ Modal `z-70` |
| 3 | **Alta** | El botón **+** de repeticiones se recortaba en 320–390 px | Dos columnas de 128 px + hueco = 268 px; espacio útil 188 / 228 / 243 / 258 px (recorte de 80 / 40 / 25 / 10 px) | ✔ Las columnas bajan de línea (`flex-wrap`, mín. 8.5 rem) |
| 4 | **Alta** | El menú ⋮ (Editar / Duplicar / **Eliminar**) de la última rutina podía quedar bajo la barra | Menú `z-50` = barra `z-50` | ✔ Menú `z-50` > barra `z-40`; fondo `z-45` |
| 5 | Media | El nombre del ejercicio quedaba ilegible en el creador | Espacio para el nombre: 12 px (320), 52 px (360), 82 px (390) por miniatura + 3 botones | ✔ La cabecera baja los botones de línea; nombre ≥ 112 px |
| 6 | Media | Los números del reloj se salían de la pantalla | A 120 px "10:00" mide 334 px (no cabe en ≤ 360 px) y "100:00" 408 px (no cabe en ninguna) | ✔ Tamaño = mín(120 px, 17 % del alto, ancho disponible) |
| 7 | Media | El aviso de "no se pudo guardar" tapaba el engranaje y la cabecera | Era `fixed top-2` y permanente en modo privado | ✔ Ahora va en el flujo (`sticky`), empuja el contenido |
| 8 | Media | El botón flotante tapaba las últimas tarjetas y se pisaba con "Crear Rutina" del estado vacío | Margen inferior de 96 px < altura del botón flotante (112–168 px) | ✔ `pb-fab` (11 rem) y se oculta con la lista vacía |
| 9 | Media | El bloque del reloj se montaba sobre el banner de la rutina | Margen negativo `-mt-8` | ✔ Eliminado |
| 10 | Media | Modales cortados en horizontal (sin scroll): no se alcanzaba el botón de cerrar | Alto del modal > alto de pantalla y sin `overflow` | ✔ Sonido `max-h-90dvh` + scroll; video limitado por altura y scroll |
| 11 | Baja | Zonas táctiles de 16–36 px (cerrar aviso 16, borrar búsqueda 24, ± 36, enlaces de 10–12 px) | Tamaños de clase | ✔ Todos ≥ 40 px (guarda que lee cada `<button>`) |
| 12 | Baja | En tablet/escritorio todo se estiraba a todo el ancho | Sin ancho máximo | ✔ Columna de 32 rem centrada; botón flotante alineado (`right-shell`) |
| 13 | Baja | Márgenes superiores de 3–3.5 rem fijos (espacio perdido en navegador móvil) | `pt-12` / `pt-14` para una barra de estado que no existe | ✔ `pt-top` = 1.5 rem + zona segura |

## Ronda 8 (v2.0): revisión de la interfaz nueva
Misma metodología (aritmética de anchos y orden de capas; sin render real).

| # | Elemento | Comprobación | Estado |
|---|---|---|---|
| 14 | Barra inferior con **4 pestañas** | Necesita ≈ 265 px; hay 304 (320 px de pantalla) → cabe. Se redujo el relleno de cada botón | ✔ |
| 15 | Tarjeta de **registro de serie**: bloques peso/reps | Cada uno necesita 156 px (40+6+64+6+40); el mínimo era 144 → se saldría ~12 px hacia 375 px. Ahora mínimo 9.75 rem y **bajan de línea** | ✔ (guarda) |
| 16 | Tarjeta en el Reloj | Está **en el flujo** (no flotante): no tapa ni se pisa con nada. Con la tarjeta el número del reloj se limita al 12 % del alto | ✔ |
| 17 | **Ajustes** ampliados (sonido + instalar + copia) | Más alto que la pantalla en móviles bajos o en horizontal → `max-h-90dvh` con scroll; capa 70 por encima de la barra | ✔ |
| 18 | Historial con detalle de series | Botones de borrar serie de 40 px; el detalle crece dentro de la tarjeta, sin capas | ✔ |
| 19 | Progreso: gráfica SVG | Escala con el ancho (viewBox); a 320 px las etiquetas quedan de ≈ 9.6 px | ⚠ pequeñas |
| 20 | Botones nuevos | La guarda que lee cada `<button>` exige ≥ 40 px | ✔ |

**Sin verificar (mirar en el móvil):** que la tarjeta de series, con el teclado numérico abierto, no quede tapada por el teclado; en pantallas de ≤ 700 px de alto el Reloj con la tarjeta visible puede pedir scroll para llegar a los botones de control (no quedan tapados: hay margen inferior).

## Capas (orden final)
`sticky headers 20` < `botón flotante 30` < `barra inferior 40` < `menú de rutina 45/50` < `creador y selector 60` < `modal de sonido 70` < `aviso de almacenamiento 80` < `video 100`.
Regla protegida por guarda: **todo lo que cubre la pantalla debe estar por encima de la barra; el botón flotante por debajo de cualquier modal.**

## Lo que NO se pudo verificar (mírese en el móvil)
- El **render real**: espaciados, que nada "se vea raro", tipografías. Las cifras de arriba son del código, no de una captura.
- **Teclado virtual:** en Chrome Android el teclado no reduce el alto de la página; al escribir en el creador, la barra "Guardar" puede quedar detrás del teclado hasta cerrarlo.
- **Horizontal:** en pantallas de menos de ~480 px de alto el Reloj puede pedir scroll para llegar a los controles (mitigado: el número no pasa del 17 % del alto).
- **Contraste y tamaño de texto:** hay textos de 10–11 px (etiquetas de modos, insignias) que conviene revisar con la accesibilidad del sistema.
- Que las **fotos y videos** carguen (dependen de terceros).

## Lista de comprobación por tamaño (marca lo que ves bien)

| Pantalla | Reloj (4 modos, número, Iniciar, tarjeta de series) | Rutinas (lista, ⋮, flotante) | Creador (± / nombre / Guardar) | Historial (detalle de series) | Progreso (gráfica) | Ajustes (sonido, instalar, copia) |
|---|---|---|---|---|---|---|
| 320 × 568 (móvil pequeño) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 360 × 640 (Android común) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 390 × 844 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 412 × 915 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Horizontal 844 × 390 | ☐ | ☐ | ☐ | ☐ | ☐ (¿se alcanza cerrar?) | ☐ |
| Tablet 768 × 1024 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Escritorio (columna centrada) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

Cómo probar tamaños sin tener tantos móviles: Chrome de escritorio → F12 → icono de dispositivo → elegir tamaño (y girar para horizontal).
