# Cierre de integración de los 28 juegos originales

Base: PR #21 fusionada, `ffb4dbc69dfaedb4be3a167bb5e7358ba89765da`.
**28/28 integrados**: Memorama mantiene su reproductor/protocolo; los otros 27
usan `OriginalGamePlayer` y el mismo `GameArena`, sin reconstruirlos.

Las URLs se obtienen del catálogo original y deben coincidir exactamente con
`https://israeltiburcio-ai.github.io/{repo}/`. No se aceptan URLs arbitrarias.
Ampliar/restaurar conserva iframe, ventana, documento y estado del juego. Salir
o recargar termina la sesión. La apertura externa sigue disponible como fallback.

Los 27 usan **solo `sandbox="allow-scripts"`**, sin `allow-same-origin`, con
referrer omitido y permisos de dispositivos/autoplay/fullscreen denegados. No
pueden leer el DOM o almacenamiento del host aun compartiendo origen en Pages.
Memorama conserva su iframe existente sin sandbox y su protocolo intacto; no se
afirma que use la política de los otros 27.

## Dependencias publicadas y revalidadas

Los siete bloqueados inicialmente abortaban al leer localStorage. Sus parches se
publicaron por separado, antes de habilitarlos aquí, con estas referencias:

| Repositorio | Commit publicado |
| --- | --- |
| system-lab | `9acd8912d045a652f4335987466fed70d0e43032` |
| SystemScope | `290cd013bb4c090631d86c724e09a62787edc29f` |
| complexity-lab | `182f7e5fa602028dfe83b9cb4a23910607b1caf1` |
| model-match | `865479ecbc45f76e7105869d567b9c04436bf464` |
| planificador-produccion | `1b03661625b564a9b5c8d97677a6c5f458c97ea6` |
| mapa-produccion | `da6f730648363bb3b3b03d3c71ad44668e9265eb` |
| claves-planeacion-produccion | `af55afe654f6c8729ce64603c5b0c2de1c058fef` |

Mapa devolvió HTTP 503 en una comprobación anterior. En el cierre respondió
correctamente, su JavaScript público coincidió con el blob del commit publicado y
pasó **8/8 escenarios públicos**: Chromium/WebKit, escritorio/móvil y sandbox/independiente.
Los seis restantes ya habían pasado esa misma matriz pública. No se vuelve a
modificar ninguno de esos repositorios en esta PR.

## Pruebas y reproducción

```sh
npm run build
npm run typecheck:academic
npm run test:original-games -- player.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit npm run test:original-games -- player.spec.ts --reporter=dot
VERIFY_ORIGINAL_GAMES=1 npm run test:original-games -- remaining-real.spec.ts --workers=2 --reporter=dot
ORIGINAL_GAME_BROWSER=webkit VERIFY_ORIGINAL_GAMES=1 npm run test:original-games -- remaining-real.spec.ts --workers=2 --reporter=dot
VERIFY_ORIGINAL_GAMES=1 npm run test:original-games -- tests/original-games/ui/real.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit VERIFY_ORIGINAL_GAMES=1 npm run test:original-games -- tests/original-games/ui/real.spec.ts --reporter=dot
```

- Matriz de los 23 restantes: **46 escenarios funcionales por motor**, a 390×844
  y 1440×900, sin mocks. Ya no hay casos que esperen un bloqueo de almacenamiento.
- Fixtures: **31 por motor**; rutas internas de los 28, sandbox de los 27,
  mensajes ignorados, ausencia de resultados, fallback y limpieza de navegación.
- Cuatro pilotos reales: **20 escenarios por motor**, cuatro tamaños.
- Regresiones de Memorama/arena y aventura/catálogo; actividades externas en sus
  suites de fixtures, seguridad y proveedores reales.
- CI PR-only existente ejecuta los fixtures. La red real sigue siendo opt-in local.
- `storage-candidates.spec.ts` conserva el arnés opt-in de reparación local:
  `STORAGE_CANDIDATE_SCRIPTS` es un mapa JSON ID → ruta de script candidato.
  Sus **37/37 pruebas por motor** fueron QA previo de parches, no sustituyen las
  pruebas de URLs públicas y de integración de este cierre.

Resultado del cierre: build/typecheck y diff PASS; matriz **46/46 por motor**,
fixtures **31/31 por motor**, pilotos **20/20 por motor**, Memorama/arena y
aventura/catálogo **31/31**. Actividades externas: seguridad **4/4**, fixtures
**15 PASS + 1 omitida por motor**, proveedores reales **9/9 Chromium** y
**8 PASS + 1 omitida WebKit**. No se presentan las omisiones como aprobadas.

Se usan controles reales (teclado, puntero, tacto emulado), sin inyectar resultados
o respuestas en el estado del juego. El probe desplaza el host cuando es necesario
para no tocar la barra de navegación móvil. Solo se acredita interacción y
conservación de partida; no finalización completa ni aprendizaje de cada juego.

## Límites y alcance

QA físico móvil pendiente. Las omisiones anteriores de asignaciones privadas y
finalización real LearningApps WebKit siguen pendientes; el issue #6 no se cierra.
El QA manual del propietario de los cinco juegos del Gimnasio 3 consta en el
documento del piloto; no se extiende esa aprobación manual a los otros 23.

Sin telemetría nueva ni cambios en progreso, recompensas, resultados de Memorama,
Firebase, backend académico, OCR, catálogo o repositorios individuales. Este cierre
autoriza commit/push/una PR; **no autoriza merge ni despliegue de OptiLab**.
