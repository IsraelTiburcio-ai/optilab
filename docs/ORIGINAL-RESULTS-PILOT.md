# Piloto local de resultados · Ahorcado y Ordena

Contrato separado: `optilab-original-results`, versión 1. No modifica el protocolo
de Memorama, `Progress`, Firebase, calificaciones, insignias ni recompensas.
`OriginalGamePlayer` solo activa el canal en `ahorcado-simplex` y `ordena-simplex`.
Los otros 25 genéricos conservan el visor sin receptor de resultados.

## Métricas nativas, con unidades explícitas

| Campo | Ahorcado Simplex | Ordena el Simplex |
| --- | --- | --- |
| `correct` | Palabras acertadas (`estado.aciertos`) | Colocaciones correctas acumuladas: `evaluated - errors` |
| `total` | Palabras previstas en la partida (3, 4 o 5) | Colocaciones evaluadas en todas las comprobaciones, incluidas las repetidas |
| `attempts` | Letras distintas aceptadas por ronda, acumuladas; repetir una letra no cuenta | Comprobaciones de líneas completas, acumuladas; comprobar con huecos no cuenta |
| `errors` | Letras falladas acumuladas | Tarjetas fuera de lugar al comprobar, acumuladas |
| `durationMs` | Tiempo nativo de partida, máximo 90 s; incluye lectura entre palabras | Cronómetro nativo activo, excluye pestaña oculta y se detiene al resolver la última ronda |
| `score` opcional | Omitido: no hay puntos nativos | Omitido: su precisión nativa no se transforma en puntos |

Se añaden dos contadores observacionales: `letrasIntentadas` y `checksTotal`.
El contador de intentos por ronda de Ordena permanece intacto, incluida su lógica
de pistas. No se cambian palabras, pasos, temporizadores, reglas ni puntuaciones.
No hay equivalencia entre palabras, letras, colocaciones y comprobaciones.

## Canal y ciclo de vida

La URL del iframe piloto recibe un UUID efímero `optilabSession` y `optilabOrigin`.
No incluye UID, nombre, correo, curso ni grupo. Tras el primer `load`, el host envía
`host:init` exclusivamente al `contentWindow` esperado. Usa `targetOrigin="*"`
solo en esa dirección porque el receptor tiene origen opaco.

El puente opcional `optilab-results.js` es idéntico en ambos repositorios y usa
`OptiLabResults.create(gameId)`. Verifica fuente padre, origen explícito autorizado
(Pages oficial o loopback de desarrollo), nonce, ID, versión y claves de init.
Responde al origen concreto del padre y emite:

- `game:ready` después de un init válido.
- `game:started` con UUID nuevo para cada partida.
- `game:completed` con el mismo runId y métricas reales al mostrar resultados.
- `game:aborted` al abandonar mediante el flujo del juego; nunca implica resultado.

Cada envoltorio tiene `protocol`, `version`, `gameId`, `session`, `type`; las partidas
añaden `runId`, y solo completion añade `result`. El resultado tiene los campos de
la tabla y `reason: completed | time-limit`. Un límite de tiempo de Ahorcado finaliza
la partida sin implicar palabras perfectas ni victoria. Ordena no usa time-limit.
El puente conserva en memoria una partida que termine antes del handshake y la
reenvía al conectar; sin configuración o fuera de iframe no publica nada.

El host exige **origin `"null"` y además ventana directa, nodo conectado, URL de
sesión exacta, nonce, ID, claves/tipos/rangos y orden ready → started → completed**.
El origen null por sí solo no concede confianza. Rechaza otros frames, sesiones,
protocolos, resultados antes de empezar, duplicados, runs sustituidos o cancelados.
El historial antirreplay se limita a 256 runs por montaje. Una nueva carga del
documento retira el canal; reabrir la ruta crea otra sesión. Ampliar/restaurar no
recarga el iframe ni cambia la sesión.

## Presentación y confianza

Solo se muestra el informe actual en el componente montado. Empezar otra partida
limpia el anterior; salir de la ruta descarta todo. No se escribe en almacenamiento,
historial personal, sincronización o backend. Son **datos reportados por el juego**:
validar formato/canal no acredita identidad, aprendizaje ni rendimiento académico.

## QA reproducible

```sh
npm run build
npm run typecheck:academic
npm run test:original-results:security
npm run test:original-games -- results-fixtures.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit npm run test:original-games -- results-fixtures.spec.ts --reporter=dot
```

`results-local.spec.ts` admite `RESULT_PILOT_REPOS` (JSON ID → raíz del repositorio
local) para servir HTML/script/puente candidatos, o `RESULT_PILOT_PUBLIC=1` para
usar exclusivamente las URLs publicadas sin interceptar recursos. Resuelve partidas
mediante controles reales y compara contadores nativos contra el informe.
Ejecutar con `ORIGINAL_GAME_BROWSER=chromium|webkit` y `--workers=2`.

Los fixtures y tests puros cubren mensajes falsificados, fuente ajena con origen
null, esquema inválido, replay, duplicados, recarga y sesión desmontada. El QA de
candidatos y URLs públicas cubren partidas completas, errores reales, letras repetidas,
checks incompletos, dos partidas por sesión, replay, abandono y handshake tardío/falso,
además de juego independiente sin canal. Cada ejecución compara `practiced`,
`results`, `gameResults` y `badges` y comprueba ausencia de peticiones Firebase.

Los cambios de pruebas de `visited` ya presentes al iniciar este trabajo se
conservaron; distinguen visitas legítimas de resultados. No se modifica el modelo
de progreso ni se registran informes en almacenamiento.

Resultado local: build/typecheck PASS; contrato **7/7**; fixtures y regresión del
visor **35/35 por motor** (31 existentes + 4 de mensajes); candidatos reales
**9/9 por motor**; pilotos publicados sin conector nuevo **20/20 por motor**;
Memorama/arena y aventura/catálogo **31/31**. Actividades externas: seguridad
**4/4** y fixtures **15 PASS + 1 omitida por motor** (asignación privada pendiente).

## Publicación de emisores

Las URLs reales se probaron sin mocks contra OptiLab local, **9/9 por motor**.
Cada juego completó dos partidas en una sesión, con métricas comparadas a sus
contadores, eventos duplicados/tardíos y ausencia de guardado. También se verificó
modo independiente y rechazo de inits falsificados. Viewports 390×844 y 1440×900
son emulación, no pruebas físicas.

| Juego | Emisor | Commit Pages final | Workflow |
| --- | --- | --- | --- |
| Ahorcado | `a106073a4f96135966b22487ddd879835d8c7e77` | `37b5f2a6688bb5930052ad82459a834bd9309d97` | [SUCCESS](https://github.com/IsraelTiburcio-ai/ahorcado-simplex/actions/runs/41140998663) |
| Ordena | `620e4e1184dc4e63c47906690d105038e116aeb7` | `822a60f25ed87aa5a1963909ad654b2f68ea0955` | [SUCCESS](https://github.com/IsraelTiburcio-ai/ordena-simplex/actions/runs/41140997989) |

Los primeros workflows, aunque exitosos, omitieron `optilab-results.js` de su lista
de archivos y devolvían HTTP 404 para el puente. Los commits Pages finales añaden
únicamente ese archivo al artefacto; se verificaron HTTP 200 y hashes Git idénticos
al commit final para index, script y puente en ambos juegos.
