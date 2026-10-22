# Pantalla grande · arena reutilizable

## Entrega verificada · 22 de octubre de 2026

**Estado: COMPLETADO y publicado.**

- URL: https://israeltiburcio-ai.github.io/optilab/#/jugar/memorama-simplex
- OptiLab, implementación `2b50ce0`: [Actions 39835531136](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39835531136), **success**.
- Memorama, adaptación CSS `7a58545`: [Actions 39835143524](https://github.com/IsraelTiburcio-ai/memorama-simplex/actions/runs/39835143524), **success**.

### QA ejecutado

| Viewport | Arena pública Chromium | Arena pública WebKit | Partida intacta y resultado único |
|---|---|---|---|
| 390 × 844 | PASS | PASS | PASS |
| 820 × 1180 | PASS | PASS | PASS |
| 1180 × 820 | PASS | PASS | PASS |
| 1440 × 900 | PASS | PASS | PASS |

**10 pruebas públicas PASS** (5 por motor, sin interceptar recursos): cuatro recorridos completos y un caso de navegación/limpieza desde pantalla grande. El caso móvil usa un contexto táctil y toca el botón de salida. Los recorridos comprueban identidad del nodo/ventana/documento, `src` y sesión estables, cartas e intentos, continuidad del cronómetro, una sola carga del juego, un solo inicio y una sola finalización. Resultado real: ocho parejas en ocho intentos, 100%, guardado una vez y conservado tras recargar el gimnasio.

La arena local también pasó cinco casos en Chromium y cinco en WebKit. Se cubrieron los **38 casos locales distintos de regresión y arena**: la ejecución completa aprobó 34 y detectó contraste insuficiente en el botón normal; tras corregir la precedencia CSS, los cuatro casos afectados se repitieron y aprobaron. Los cuatro casos públicos anteriores de `pilot-public.spec.ts` estaban omitidos de esa ejecución local por configuración, no se contabilizan como aprobados en ella. `npm run build`: **PASS**, incluido TypeScript.

Se verificó también accesibilidad automática Axe en la arena, scroll anfitrión bloqueado, área táctil de salida de al menos 44 px, restauración del foco y posición de scroll. Se corrigió el caso de scroll en iPad vertical capturando su posición antes del cambio de layout.

### Archivos de esta entrega

OptiLab:
- Nuevos: `src/components/GameArena.tsx`, `src/components/GameArena.css`, `tests/arena.spec.ts`, `docs/PANTALLA-GRANDE.md`.
- Modificados: `src/pages/GamePlayer.tsx`, `README.md`.

Memorama Simplex:
- Modificados: `optilab-theme.css`, `index.html` (versión de la hoja de estilos).

`GamePlayer.css`, `protocol.ts` y `GameCard.tsx` se inspeccionaron y no necesitaron cambios. Los otros 27 repositorios no se modificaron.

## Uso

En el reproductor de Memorama Simplex, pulsar **Pantalla grande**. El juego ocupa el viewport con una barra mínima de título, regreso al gimnasio y **Salir de pantalla grande**. No abre otra pestaña ni requiere la API nativa de Fullscreen.

- Salida por botón (toque, clic o teclado).
- Escape cuando el foco está en el documento anfitrión.
- Regreso al gimnasio desde la barra ampliada o navegación de la aplicación.
- Escape del iframe no se supone propagado: siempre hay un control de salida fuera del juego.

## Arquitectura

`src/components/GameArena.tsx` recibe `title`, `region`, `returnTo`, `controls` y `children`. No contiene reglas de Memorama ni modifica el protocolo. `GamePlayer` simplemente envuelve su barra de estado y su contenedor de iframe con esta arena.

El mismo subárbol React permanece montado. La expansión solo añade una clase al contenedor: no hay portales, segundo iframe, movimiento manual del nodo, cambio de `key`, modificación de `src` ni nueva sesión. `retry()` sigue siendo un control explícito en la vista normal.

`GameArena.css` usa `position: fixed`, `inset: 0`, `width: 100%`, `height: 100dvh` (con fallback `100vh`) y Flexbox: barra de altura natural y área de juego que consume todo el espacio restante. Respeta las cuatro áreas seguras. El iframe ampliado sustituye sus límites de altura normales por `height: 100%` y `min-height: 0`.

No se usa Fullscreen API: el comportamiento CSS es el mismo en Chromium y WebKit y no depende del soporte de Safari iOS.

## Scroll, foco y contenido secundario

- Se captura la posición de scroll **antes** de aplicar el modo fijo, evitando que el navegador la reduzca al salir el iframe del flujo.
- El cuerpo se bloquea con posición fija, desplazamiento negativo y overflow oculto; también se bloquea overflow/overscroll del documento.
- Se ocultan y vuelven inertes los hermanos de la arena a lo largo de sus ancestros, sin volver inerte ningún ancestro del iframe. La visibilidad conserva las dimensiones originales para restaurar la posición.
- Los resultados que aparezcan mientras se juega también permanecen visualmente ocultos hasta restaurar la vista.
- La arena ampliada se identifica como diálogo modal. El foco pasa al botón de salida. Límites de tabulación mantienen el foco anfitrión en el área activa.
- Al cerrar se restauran estilos, visibilidad, atributos, scroll y foco en el botón original. La restauración de scroll se termina con el layout normal ya recuperado. Al navegar, el router toma el foco de la página de destino.
- El iframe puede desplazarse internamente si el contenido académico no cabe; el botón exterior no se desplaza con él.

## Adaptación interna de Memorama

Solo se ajustó `optilab-theme.css`, bajo `.optilab-embedded`: se eliminan los límites generales de ancho de aplicación/juego, el tablero vertical se centra con un límite amplio y el horizontal distribuye HUD y cartas usando anchura y altura del iframe. Las cartas crecen con mínimos legibles, sin escalar su texto ni alterar sus respuestas. `index.html` versiona la URL de esa hoja para evitar la caché anterior.

No se modificaron `script.js`, `data.js`, el puente ni `src/integration/protocol.ts`. La apariencia independiente conserva sus reglas originales.

## Pruebas reproducibles

```sh
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npx playwright test tests/arena.spec.ts --browser chromium
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npx playwright test tests/arena.spec.ts --browser webkit
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npm test
npm run build

# Tras publicar, sin interceptar recursos:
VERIFY_PUBLIC=1 npx playwright test tests/arena.spec.ts --browser chromium
VERIFY_PUBLIC=1 npx playwright test tests/arena.spec.ts --browser webkit
```

Los cuatro tamaños son 390×844, 820×1180, 1180×820 y 1440×900. La prueba guarda la identidad del elemento iframe, su `contentWindow`, una marca del documento hijo y su `src`. Descubre parejas y deja una carta abierta, amplía, continúa, restaura, comprueba scroll/foco/cronómetro, sale con Escape, amplía otra vez y completa el tablero.

Se exige una sola navegación del iframe, un solo inicio, una sola finalización y un solo resultado guardado. Se verifica ausencia de overflow horizontal, bloqueo del scroll anfitrión, botón táctil de al menos 44 px y accesibilidad Axe. Un quinto caso navega al gimnasio desde pantalla grande y verifica limpieza del bloqueo y ausencia de resultados inventados.

Las pruebas usan viewports emulados y motores automatizados, no hardware iPhone/iPad físico. Las áreas seguras están implementadas mediante `env(safe-area-inset-*)`; su comprobación física queda pendiente.
