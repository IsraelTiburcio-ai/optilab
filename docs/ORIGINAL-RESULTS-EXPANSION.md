# Ampliación de resultados: 28/28 con emisores públicos

Esta rama parte de `1c7ab1da37b568cbcc222cb0309faf1ff5ef13b3`. Se completaron
los **25 emisores adicionales locales**: los diecisiete previos se conservan y
los ocho restantes están implementados y verificados. Con Memorama, Ahorcado y
Ordena ya publicados, el total es **28/28 PASS local**. El receptor genérico
admite 27 IDs; Memorama conserva su protocolo independiente y su integración.
Los 25 emisores adicionales están publicados y verificados. OptiLab sigue como
candidato local/rama de PR, pendiente de aprobación, merge y despliegue. Los
SHAs y workflows publicados están en [el registro de release](ORIGINAL-RESULTS-RELEASE-28.md).

| ID | `correct` / `total` | `score` | `durationMs` | Intentos y errores |
| --- | --- | --- | --- | --- |
| `system-lab` | Elementos acertados / 8 | Puntos nativos | Ausente: no hay cronómetro de partida | Ausentes: un elemento puede no responderse |
| `SystemScope` | Situaciones acertadas / 6 | Puntos nativos | Duración nativa mostrada, redondeada a segundos y expresada en milisegundos | Ausentes: tiempo agotado no equivale a un intento |
| `complexity-lab` | Rondas acertadas / 4 | Puntos nativos | Ausente: no hay cronómetro total de partida | Ausentes: una ronda puede expirar sin respuesta |
| `desviacion-express` | Tarjetas acertadas / 8 | Ausente | Tiempo activo de la partida | Ausentes: cada tarjeta se clasifica una vez; una tarjeta sin respuesta no es un intento |
| `torre-prioridades` | Colocaciones correctas / total de metas de la sesión | Ausente | Duración de la sesión | Intentos de colocación presentes; no se publican errores separados |
| `rompecabezas-metas` | Máquinas correctas al primer intento / 7 | Ausente | Duración en segundos | Ausentes: un reintento dentro de la misma máquina no cuenta como acierto al primer intento |
| `ruta-de-metas` | Retos superados / 5 | Ausente | Duración de la ruta | Ausentes: una elección por reto |
| `candado-simplex` | Aciertos al primer intento / 5 | Ausente | Duración en segundos | Movimientos totales presentes; no se publican errores separados |
| `espejo-dual` | Reflejos completados / 5 | Ausente | Tiempo nativo redondeado a segundos | Ajustes incorrectos; intentos ausentes |
| `balanza-dual` | Rondas resueltas / 5 | Ausente | Tiempo nativo redondeado a segundos | Ausentes: se corrige cada ronda hasta resolverla |
| `domino-holguras` | Conexiones completadas / 6 | Ausente | Tiempo nativo truncado a segundos | Selecciones incorrectas; intentos ausentes |
| `mercado-recursos-dual` | Decisiones correctas / 6 | Ausente | Tiempo nativo redondeado a segundos | Ausentes; el beneficio monetario no es puntuación |
| `semaforo-sensibilidad` | Retos correctos / 6 | Ausente | Tiempo nativo truncado a segundos | Ausentes: no se crea un contador de errores |
| `model-match` | Modelos acertados / 10 | Ausente: `score` nativo son aciertos | Tiempo nativo redondeado en segundos | `answerLog`: respuestas explícitas, incorrectas y expiraciones por separado |
| `lp-factory` | Piezas acertadas / 15 | `S.points`, puntos nativos | `S.elapsedMs`, cronómetro activo en milisegundos | `S.answers`: respuestas y selecciones incorrectas |
| `constraint-dash` | Restricciones acertadas / 10 | `gameRun.score`, puntos nativos | Tiempo nativo redondeado en segundos | Respuestas explícitas, incorrectas y expiraciones por separado |
| `feasible-drop` | Rondas acertadas / 6 | `state.score`, puntos nativos | `performance.now()` de la partida en milisegundos | Ausentes: el resultado nativo no separa intentos y errores |
| `OptiQuest1` | Zonas vencidas / 3, solo al completar la aventura | Ausente: las bayas no son puntos | Ausente: no hay cronómetro nativo | Ausentes: no se deducen respuestas a partir de vida o daño |
| `or-mission` | Fases correctas al primer intento / 8 | Puntos nativos | Segundos redondeados del resultado | `state.wrong`: fallos nativos, incluidas expiraciones; intentos omitidos |
| `solution-detective` | Sellos correctos / 8 | Ausente: `state.score` ya cuenta sellos | Segundos redondeados del resultado, mínimo nativo de un segundo | Omitidos |
| `planificador-produccion` | Estaciones y reto final correctos / 6 | `estado.puntos` | Segundos truncados del resultado | Omitidos; las cinco tarjetas finales constituyen un único reto |
| `mapa-produccion` | Tarjetas de la reconstrucción final / 5 | Ausente | Segundos truncados, ambas etapas incluidas | Ausentes: no se suman diez aciertos ni se inventa primer intento |
| `claves-planeacion-produccion` | Estaciones al primer intento / 5 | Ausente | Segundos redondeados del resultado | Omitidos; la selección final no aumenta el total |
| `rompecabezas-simplex` | Rondas al primer intento / modalidad de 6, 7 u 8 | `estado.puntos` | Cronómetro activo nativo en milisegundos | Comprobaciones y comprobaciones incorrectas agregadas de `resultados` |
| `caza-el-pivote` | Selecciones al primer intento / 15 previstas | `state.points` | Segundos activos truncados, máximo 120 s | `state.attempts` y `state.totalErrors`; las selecciones pendientes no son errores |

Los campos opcionales omitidos no se deducen ni se convierten en ceros. La
validación exige exactamente los campos permitidos y total de rondas propio de cada
juego, sin relajar origen opaco, sesión, ventana, secuencia o antirreplay. Los
puentes reutilizan el protocolo de PR #23 y la misma implementación, con las
listas de IDs correspondientes a cada lote.
No se ha modificado el protocolo de Memorama ni el almacenamiento de OptiLab.

## QA ejecutado

Build/typecheck PASS; contrato y seguridad **9/9**; pruebas controladas del
reproductor **35/35 por motor**. Con HTML y scripts candidatos locales servidos
mediante interceptación, datos reales de Pages y `sandbox="allow-scripts"`, los
tres juegos completaron partidas reales, repetición, rechazo de duplicados,
abandono de la ruta, modo independiente sin emisión y ausencia de cambios en
progreso/Firebase: **6/6 Chromium y 6/6 WebKit**. La falsificación de origen,
fuente, sesión y duplicados también se prueba en el receptor puro. No se trata de
una verificación de los sitios publicados: los emisores siguen solo locales.

### Lote Gimnasio 5

Los cinco juegos nuevos del Gimnasio 5 reutilizan el mismo emisor y receptor,
sin protocolos adicionales. Con candidatos locales servidos por interceptación
y datos reales de Pages, completaron partidas reales, repetición con run nuevo,
rechazo de duplicados, abandono sin informe y modo independiente sin mensajes:
**10/10 Chromium y 10/10 WebKit**. La suite del reproductor quedó en **31/31** y
la regresión local de los tres juegos previos en **6/6**. Contrato y seguridad
pasan **10/10**; build PASS. No se modificaron mecánicas ni los tres juegos ya
adaptados.

### Lote Gimnasio 4

Los cinco emisores y su puente opcional están modificados localmente en sus
repositorios originales; no se han publicado. Los campos exactos permitidos se
validan por ID, con duración en múltiplos de 1000 ms para reflejar la precisión
nativa mostrada por cada juego. Espejo y Dominó registran rondas completadas,
no aciertos al primer intento; sus ajustes/selecciones fallidas son errores
propios. En Mercado se omite expresamente el beneficio monetario.

**Balanza:** se detectó que el sandbox `allow-scripts` bloqueaba el envío nativo
del formulario. Se reutilizó la misma función de comprobación desde clic/Enter,
con `reportValidity()` y sin permitir `allow-forms`; la mecánica matemática no
cambió. La prueba incluye entrada inválida y activación mediante Enter.

QA con HTML/scripts locales interceptados y resto de recursos reales: partidas
completas, segunda partida, duplicados, origen/fuente falsos, aborto por navegación
y modo independiente sin canal, **11/11 Chromium y 11/11 WebKit**. La validación
incluye comparación con métricas mostradas, sandbox opaco, ausencia de resultados
persistidos y cero solicitudes Firebase en los recorridos instrumentados.
Regresión de los ocho previos: **6/6 Chromium** para el primer lote; **10/10 por
motor** para Gimnasio 5. Reproductor/fixtures **35/35 por motor**; contrato
**11/11**; build/typecheck PASS. La suite del primer lote no se repitió en
WebKit en este cierre; su verificación anterior sigue documentada arriba.

### Lote Gimnasio 2: cuatro juegos

Los emisores locales reutilizan el puente opcional idéntico en los cuatro repos.
En Model Match, `answerLog.timedOut` separa expiración de respuesta incorrecta.
Constraint Dash añade el indicador observacional `timedOut: choiceIndex < 0` a
su registro de respuestas, sin cambiar la selección ni el cronómetro. Las
validaciones exigen `correct + errors = attempts` y `attempts + timeouts = 10`.
LP Factory informa puntos reales y tiempo activo; Feasible Drop no inventa
contadores de error. Resultados siguen solo en memoria; el campo `timeouts` tiene
una etiqueta propia y no se mezcla con `errors`.

Partidas reales completas con HTML/scripts locales interceptados, dos partidas,
abandono, duplicados, mensajes con fuente/origen falsos y modo independiente:
**8/8 Chromium y 8/8 WebKit**. Model Match y Constraint Dash incluyeron en cada
partida una expiración real y una respuesta incorrecta. No se inyectaron eventos
de respuesta ni resultados para finalizar. Contrato **12/12**, fixtures del visor
**35/35 por motor**, build/typecheck PASS. Es QA local; emisores no publicados.

Para reproducir (ejecutar secuencialmente para no compartir el puerto 5189):

```sh
npm run build && npm run typecheck:academic && npm run test:original-results:security
RESULT_EXPANSION_REPOS='{"system-lab":"/ruta/system-lab","SystemScope":"/ruta/SystemScope","complexity-lab":"/ruta/complexity-lab"}' npm run test:original-games -- results-expansion-local.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit RESULT_EXPANSION_REPOS='{"system-lab":"/ruta/system-lab","SystemScope":"/ruta/SystemScope","complexity-lab":"/ruta/complexity-lab"}' npm run test:original-games -- results-expansion-local.spec.ts --reporter=dot
GYM5_RESULT_REPOS='{"desviacion-express":"/ruta/desviacion-express","torre-prioridades":"/ruta/torre-prioridades","rompecabezas-metas":"/ruta/rompecabezas-metas","ruta-de-metas":"/ruta/ruta-de-metas","candado-simplex":"/ruta/candado-simplex"}' npm run test:original-games -- gym5-results-local.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit GYM5_RESULT_REPOS='{"desviacion-express":"/ruta/desviacion-express","torre-prioridades":"/ruta/torre-prioridades","rompecabezas-metas":"/ruta/rompecabezas-metas","ruta-de-metas":"/ruta/ruta-de-metas","candado-simplex":"/ruta/candado-simplex"}' npm run test:original-games -- gym5-results-local.spec.ts --reporter=dot
GYM4_RESULT_REPOS='{"espejo-dual":"/ruta/espejo-dual","balanza-dual":"/ruta/balanza-dual","domino-holguras":"/ruta/domino-holguras","mercado-recursos-dual":"/ruta/mercado-recursos-dual","semaforo-sensibilidad":"/ruta/semaforo-sensibilidad"}' npm run test:original-games -- gym4-results-local.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit GYM4_RESULT_REPOS='{"espejo-dual":"/ruta/espejo-dual","balanza-dual":"/ruta/balanza-dual","domino-holguras":"/ruta/domino-holguras","mercado-recursos-dual":"/ruta/mercado-recursos-dual","semaforo-sensibilidad":"/ruta/semaforo-sensibilidad"}' npm run test:original-games -- gym4-results-local.spec.ts --reporter=dot
```

### Cierre de los ocho restantes

`remaining-results-local.spec.ts` completa dos partidas por juego dentro de
OptiLab y una partida independiente, comprueba abandono, ventana/origen falsos,
duplicados, replay retirado y coincidencia con métricas nativas. OptiQuest recorre
el mapa con teclado, habla con los tres NPC y vence las tres batallas en cada
aventura; no se finaliza al vencer solamente una zona. Mapa completa ambas etapas
de cinco tarjetas. Los demás juegos incluyen una respuesta/comprobación
incorrecta real antes de finalizar. Caza incluye además abandono desde pausa y
una expiración real de 120 segundos, con cero intentos y cero errores.

**Los 17 casos pasan en ambos motores.** En Chromium, la ejecución completa
terminó con 15 PASS y dos fallos de selectores de QA en Claves (HTML con
subíndices); corregidos los selectores, la repetición dirigida terminó 2/2 PASS.
WebKit terminó 17/17 PASS en una ejecución completa. Los primeros fallos de QA
de OR/Solution/Claves se corrigieron sincronizando cambios de pantalla y leyendo
el contenido nativo, sin cambiar las mecánicas de los juegos.

No hubo errores JS en las partidas integradas instrumentadas, cambios en progreso
protegido ni solicitudes Firebase. Los ocho puentes siguen siendo opcionales:
una partida independiente no emite mensajes del contrato. El sandbox permanece
`allow-scripts`. OptiQuest pasa las comprobaciones de su `AGENTS.md`; su JSON,
contenido duplicado, audio y sistema de guardado permanecen intactos.

Verificaciones finales: build y typecheck PASS, contrato/seguridad **13/13**,
reproductor/fixtures **35/35 Chromium y 35/35 WebKit**. Regresión de los emisores
publicados Ahorcado/Ordena contra el host candidato **9/9 por motor**; regresión
Memorama/arena/aventura **31/31 Chromium**, sin editar Memorama. Las evidencias
anteriores de los diecisiete emisores locales siguen arriba. No hay bloqueos
pendientes para el tracking local de estos 28 juegos.

Reproducción del último lote (rutas de repos locales en un JSON; ejecutar cada
motor secuencialmente por el puerto 5189):

```sh
REMAINING_RESULT_REPOS='<JSON ID → raíz de los ocho repos>' npm run test:original-games -- remaining-results-local.spec.ts --workers=2 --reporter=dot
ORIGINAL_GAME_BROWSER=webkit REMAINING_RESULT_REPOS='<mismo JSON>' npm run test:original-games -- remaining-results-local.spec.ts --workers=2 --reporter=dot
```

## Archivos de la ampliación

En **cada uno de los 25 repositorios publicados**: `index.html`,
`optilab-results.js` nuevo (incluido explícitamente en el commit) y el archivo de lógica siguiente.
Los diecisiete anteriores y sus archivos nuevos se conservan; los `.DS_Store`
preexistentes de Planificador/Rompecabezas de Metas no forman parte de la entrega.

| Repositorio | Archivo de lógica |
| --- | --- |
| `OptiQuest1` | `app.js` |
| `system-lab` | `js/game.js` |
| `SystemScope` | `js/game.js` |
| `complexity-lab` | `js/game.js` |
| `or-mission` | `js/game.js` |
| `model-match` | `script.js` |
| `lp-factory` | `script.js` |
| `constraint-dash` | `js/game.js` |
| `feasible-drop` | `script.js` |
| `solution-detective` | `script.js` |
| `planificador-produccion` | `script.js` |
| `mapa-produccion` | `script.js` |
| `claves-planeacion-produccion` | `script.js` |
| `rompecabezas-simplex` | `script.js` |
| `caza-el-pivote` | `script.js` |
| `espejo-dual` | `script.js` |
| `balanza-dual` | `app.js` |
| `domino-holguras` | `app.js` |
| `mercado-recursos-dual` | `app.js` |
| `semaforo-sensibilidad` | `script.js` |
| `desviacion-express` | `script.js` |
| `torre-prioridades` | `app.js` |
| `rompecabezas-metas` | `script.js` |
| `ruta-de-metas` | `app.js` |
| `candado-simplex` | `src/app.js` |

En **OptiLab**:

- `src/integration/originalResults.ts`
- `src/components/OriginalSessionResult.tsx`
- `src/App.tsx`
- `tests/original-games/results.test.ts`
- `tests/original-games/ui/player.spec.ts`
- `tests/original-games/ui/results-fixtures.spec.ts`
- `tests/original-games/ui/results-expansion-local.spec.ts` (nuevo)
- `tests/original-games/ui/gym2-results-local.spec.ts` (nuevo)
- `tests/original-games/ui/gym4-results-local.spec.ts` (nuevo)
- `tests/original-games/ui/gym5-results-local.spec.ts` (nuevo)
- `tests/original-games/ui/remaining-results-local.spec.ts` (nuevo)
- `docs/ORIGINAL-RESULTS-EXPANSION.md` (nuevo)
- `docs/ORIGINAL-RESULTS-RELEASE-28.md` (nuevo)
- `tests/pilot.spec.ts` y `tests/arena.spec.ts`: opt-in de emisor Memorama público
  conservando el host candidato local para regresión en ambos motores.

Las secciones históricas de QA anteriores usaron candidatos locales interceptados.
El cierre de release ejecutó los mismos recorridos con
`RESULT_EXPANSION_PUBLIC=1`, sin interceptar recursos de juegos, y verificó
75/75 recursos públicos idénticos a sus commits. Los 52 casos de los 25 emisores
pasan en ambos motores; Memorama, Ahorcado y Ordena también pasan desde sus
emisores públicos contra el host candidato. Véase el registro de release.
