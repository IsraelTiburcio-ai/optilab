# QA del MVP · 22 de octubre de 2026

## Entorno y alcance

- Ejecución final: **20 pruebas PASS**, incluido HTTP de los 28 juegos; build de producción PASS.
- Node 22.23.1; TypeScript estricto; build Vite de producción.
- Playwright/Chromium automatizado, capturas y revisión de composiciones.
- Axe: reglas WCAG 2 A/AA y 2.1 AA en las siete experiencias principales.
- Viewports emulados, no hardware físico. No se afirma haber probado Safari, iPhone o iPad físicos.

## Lista ejecutada

| Área | Resultado | Evidencia / alcance |
|---|---|---|
| Catálogo | PASS | 28 registros, 5 gimnasios, agrupación 5/8/5/5/5; cada nombre y URL coincide con JSON |
| Enlaces | PASS | Los 28 destinos devolvieron HTTP 200; apertura real de Memorama en pestaña nueva |
| Seguridad de apertura | PASS | `target=_blank`, `rel=noopener noreferrer` en los 28 enlaces |
| Búsqueda/filtros | PASS | Nombre sin distinguir mayúsculas, tema, filtro por los 5 gimnasios, vacío recuperable |
| Detalles | PASS | Expandir ficha y comprobar repositorio real |
| Navegación | PASS | Inicio → mapa → gimnasio; rutas de todas las pantallas; regreso vía navegación y enlaces |
| Práctica honesta | PASS | Abrir enlace no marca; marcar/desmarcar actualiza progreso |
| Persistencia | PASS | Recarga conserva práctica, insignia, ruta y diagnóstico |
| Insignias | PASS | Cinco prácticas de G3 obtienen Pivote; reinicio elimina; cancelar no modifica |
| Ruta | PASS | Configuración predeterminada genera dos juegos reales y se conserva al recargar |
| Reto | PASS | Cinco preguntas, corrección, resultado 4/5 con error deliberado, recomendación específica |
| Resultados | PASS | Error de holgura recomienda Rompecabezas Algebraico; perfil conserva 4/5 |
| Storage bloqueado | PASS | App sigue funcionando, muestra aviso y mantiene estado en memoria |
| Teclado/táctil | PASS | Selección del mapa con Enter; nodos mayores de 44×44; navegación de gimnasio tras selección |
| Recarga interna | PASS | `#/gimnasio/1` conserva pantalla tras recargar, compatible con Pages |
| Consola | PASS | Sin excepciones JS en las siete rutas y los nueve tamaños |
| Build | PASS | `tsc -b && vite build` |
| Accesibilidad básica | PASS | Axe sin infracciones A/AA detectadas en siete pantallas; no equivale a auditoría exhaustiva |

## Responsive

Pruebas de overflow y renderizado en cada pantalla:

| Viewport | Resultado |
|---|---|
| 375×812 | PASS |
| 390×844 | PASS |
| 768×1024 | PASS |
| 820×1180 | PASS |
| 1024×768 | PASS |
| 1180×820 | PASS |
| 1366×768 | PASS |
| 1440×900 | PASS |
| 1920×1080 | PASS |

Móvil: navegación inferior, mapa vertical propio y una columna de cartuchos. Tablet vertical: mapa ancho con panel debajo y dos columnas de catálogo. Tablet horizontal/escritorio: mapa con panel lateral y tres columnas. El botón de inicio permanece visible en el primer viewport móvil. Se corrigió overflow de la ilustración en anchuras intermedias y contraste de textos secundarios tras detectarlos en QA.

## Verificación matemática

Las cinco claves se comprobaron por álgebra y los criterios de la convención `zⱼ−cⱼ`, con hipótesis de factibilidad explícita. Hay comprobaciones numéricas de equivalencias, holgura y razón en la suite; la justificación completa está en `ACADEMIA.md`.

## Pendientes y límites

- Prueba manual con VoiceOver y lector de pantalla, controles switch y dispositivos físicos.
- Safari iOS/iPadOS, Firefox y navegadores Android reales.
- Jugar y completar los 28 sitios externos; HTTP 200 no verifica sus reglas o compatibilidad interna.
- Medición Lighthouse/Core Web Vitals en red y dispositivos reales. Build observado: ~308 KB JS (~98 KB gzip), ~28 KB CSS (~7 KB gzip); SVG ligero, sin imágenes pesadas, vídeo ni audio automático.
- Revisión docente de preguntas y de Mapa de Producción. La comprobación matemática no implica aprobación oficial de la profesora.

## Reproducir

`npm ci`, `npx playwright install chromium`, `npm test`, `npm run build`.

Las capturas están en `test-results/` y el informe HTML en `playwright-report/` tras una ejecución. Son artefactos locales ignorados por Git.
