# Reporte real · Fase 2 · Piloto Memorama Simplex

Fecha: 22 de octubre de 2026.

## Estado: COMPLETADO

- OptiLab: https://israeltiburcio-ai.github.io/optilab/
- Reproductor: https://israeltiburcio-ai.github.io/optilab/#/jugar/memorama-simplex
- Juego independiente: https://israeltiburcio-ai.github.io/memorama-simplex/

## Repositorios modificados

1. `IsraelTiburcio-ai/optilab`, implementación `9b818f1`.
2. `IsraelTiburcio-ai/memorama-simplex`, integración `e95a8c0`, empaquetado corregido `2b1c833`.

Los otros 27 repositorios no se modificaron. El catálogo JSON y el banco `data.js` de Memorama no cambiaron. Se conserva la aplicación existente y se añade una experiencia integrada.

## Entrega funcional

- `GamePlayer` con entrada animada breve, movimiento reducido, navegación al gimnasio y alternativa externa siempre disponible.
- Iframe de URL permitida, handshake por sesión y protocolo versionado.
- Validaciones de origen, ventana emisora, sesión, juego, tipos, campos, orden de eventos y coherencia matemática.
- Resultado real desde la función de finalización del juego: parejas, intentos, errores, tiempo activo y precisión.
- Historial local deduplicado (máximo 50), último resultado en Mi Aventura y estado visible en la ficha.
- Práctica manual e insignias conservan su significado y regla original.
- Tema OptiLab aplicado al juego solo tras conexión validada; independiente mantiene su tema.
- Cinco portadas SVG originales: cartas vinculadas, rompecabezas algebraico, tablero de vocabulario, escalera del algoritmo y tabla con pivote.

## Pruebas locales ejecutadas

**33 casos locales distintos aprobados en Chromium:** 20 de regresión del MVP, 12 del piloto y 1 de portadas. Durante el desarrollo se corrigieron selectores de prueba, contraste, enfoque del repaso final y ancho útil móvil. La ejecución de regresión pasó 31 casos; el caso de ciclo de vida corregido se repitió y pasó por separado; la prueba de portadas también pasó por separado.

**12 casos del piloto aprobados en WebKit.** Incluyen:

- Cuatro recorridos integrados con una equivocación real seguida de las ocho parejas: 9 intentos, 1 error, 89% de precisión.
- Cuatro partidas independientes completas: 8 intentos y 100%.
- Rechazo de mensajes con origen, `source`, sesión, juego, versión/esquema u orden incorrectos; números inconsistentes, NaN y finalizaciones sin partida activa.
- Timeout de handshake: alternativa externa, reconexión y ausencia de victoria inventada.
- Migración de datos del MVP: apodo, práctica, ruta y diagnóstico anteriores conservados.
- Salida anticipada sin resultado; validación del handshake también en el hijo; duplicados sin doble registro; nueva partida con otro resultado; borrado global.

Las pruebas se resuelven mediante clics reales sobre las cartas del tablero. El banco del juego se consulta solo como oráculo en automatización para identificar parejas; no se añade un modo de victoria o resolución a producción.

Las comprobaciones de accesibilidad Axe pasan en las siete pantallas anteriores y en el resultado integrado, incluido el iframe. Las capturas de las cinco portadas se generaron en los cuatro tamaños.

## Producción: sin interceptar recursos

**8 casos públicos aprobados: 4 Chromium + 4 WebKit.** Cada caso prueba tanto la integración como el juego independiente, con los recursos realmente publicados en GitHub Pages.

| Viewport | Integrado Chromium | Integrado WebKit | Independiente ambos |
|---|---|---|---|
| 390 × 844 | PASS | PASS | PASS |
| 820 × 1180 | PASS | PASS | PASS |
| 1180 × 820 | PASS | PASS | PASS |
| 1440 × 900 | PASS | PASS | PASS |

En cada tamaño se verificó: apertura desde gimnasio sin pestaña adicional, handshake, una pareja incorrecta, partida completa, resultado 89% coherente, regreso al gimnasio, persistencia tras recargar, resultado en Mi Aventura, ausencia de overflow y excepciones JavaScript. Después se completó una partida independiente con 100%.

Son navegadores automatizados con viewports emulados. WebKit aporta cobertura de su motor; no equivale a probar un iPhone/iPad físico ni todas las particularidades de Safari iOS.

## Build y despliegue

- `npm run build`: PASS, TypeScript + producción Vite (~320 KB JS, ~101 KB gzip).
- OptiLab: [Actions 39828173527](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39828173527), `success`.
- Memorama: [Actions 39828967203](https://github.com/IsraelTiburcio-ai/memorama-simplex/actions/runs/39828967203), `success`.
- La primera prueba pública detectó que el workflow de Memorama copiaba una lista fija y no incluía los nuevos archivos. Se corrigió el artefacto antes de repetir las ocho pruebas públicas exitosas. Este fallo confirmó el funcionamiento de la alternativa externa.

## Reproducir

```sh
# Candidatos locales de ambos repositorios
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npm test
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npx playwright test tests/pilot.spec.ts --browser webkit
npm run build

# Sitios realmente publicados, sin mocks/proxy de recursos
VERIFY_PUBLIC=1 npx playwright test tests/pilot-public.spec.ts --browser chromium
VERIFY_PUBLIC=1 npx playwright test tests/pilot-public.spec.ts --browser webkit
```

Instalación de motores cuando sea necesario: `npx playwright install chromium webkit`.

Sin `MEMORAMA_DIR`, se omiten explícitamente los casos del candidato local. Sin `VERIFY_PUBLIC=1`, se omiten los casos de producción para evitar depender de la red en cada sesión. Los artefactos se generan en `test-results/` y `playwright-report/`, ignorados por Git.

## Límites reales

- Resultados informados y validados en el cliente, sin firma de servidor ni garantía antitrampas.
- El origen compartido no ofrece aislamiento frente a código malicioso de ese mismo origen. El protocolo añade ventana emisora, sesión y juego para no confiar solo en `origin`.
- Solo Memorama tiene integración; el patrón para los demás está en `INTEGRACION-JUEGOS.md`.
- Sin sincronización entre dispositivos. Si se bloquea el almacenamiento, funciona la sesión en memoria y se informa la limitación.
- Pendiente prueba en dispositivos físicos y con lector de pantalla real.
