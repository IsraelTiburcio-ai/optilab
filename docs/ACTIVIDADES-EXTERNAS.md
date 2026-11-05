# Editor docente de actividades externas

Rama `codex/activities-editor`, base `main` `72d956dceac4ca3897be016fc97984a410ce3555`. Fecha: 4 de noviembre de 2026.

Alcance: Firestore Emulator, API académica local y cuentas sintéticas. **Sin producción, sin despliegue, sin merge y sin modificar los 28 juegos.**

## Resultado

`#/docente` → grupo → **Actividades** permite, sin cambiar código ni desplegar:

- Crear un borrador Wordwall o LearningApps con título, descripción, instrucciones, URL de origen, URL de embed, recurso, gimnasio y uno o varios grupos autorizados.
- Previsualizarlo en un iframe con la política restringida existente.
- Publicarlo; el alumno activo lo ve únicamente en su gimnasio y solo si está publicado.
- Reordenarlo con drag-and-drop en Chromium y con Subir/Bajar/Mover en todos los navegadores.
- Moverlo entre los cinco gimnasios y guardar secuencias independientes por grupo.
- Ocultarlo, reactivarlo y archivarlo conservando la revisión publicada.
- Recargar y recuperar el orden y el estado desde Firestore Emulator.

La asignación es una referencia: la definición vive una vez por curso; cada grupo tiene su asignación, gimnasio y orden. Los 28 juegos originales, sus identidades, resultados y evolución permanecen fuera de este namespace.

## Datos y operaciones

```text
courses/{courseId}/activities/{activityId}
courses/{courseId}/activities/{activityId}/revisions/{definitionRevision}
courses/{courseId}/terms/{termId}/groups/{groupId}/groupActivities/{activityId}
courses/{courseId}/terms/{termId}/groups/{groupId}/activityPlacements/{gymId}
```

Lecturas API:

- `activityWorkspace`: docente con `manageMembers` del grupo exacto; devuelve definiciones visibles para el grupo, asignaciones y cinco placements. Incluye borradores, ocultas y archivadas.
- `publishedGroupActivities`: alumno con curso/grupo activos; devuelve solo asignaciones publicadas, ordenadas por el placement de cada gimnasio.
- `publishedActivity`: acceso directo; exige membresía activa y publicación, nunca lee borradores.

Escrituras API:

- `saveActivityDraft`: crea/actualiza definición y asignaciones borrador para los grupos seleccionados; CAS por `expectedVersion`; una definición publicada editada pasa a borrador con nueva revisión.
- `publishActivities`: publica la revisión actual en los grupos indicados; escribe la revisión inmutable y actualiza asignación/placement. También reactiva ocultas.
- `reorderActivities`: CAS del placement; exige la lista completa de publicadas del gimnasio; actualiza `displayOrder`.
- `moveActivity`: CAS de la asignación; mueve la referencia y recompone source/target placement.
- `setActivityStatus`: oculta/archiva sin borrar; retira del placement. Archivada es terminal para publicación en el MVP.

Todas usan `academicOperations` (idempotencia + replay sin repetir efectos), `academicAudit` del comando y autorización dentro de la transacción. Los recibos no guardan URLs ni contenido completo.

## Seguridad

- URL solo HTTPS, host exacto, sin credenciales, puerto no estándar, hash, parámetros duplicados ni PII/tokens. LearningApps exige `/watch?v=id` y `/show.php?id=id`; Wordwall exige source `/resource/<numérico>/<slug>` y embed exacto `/es/embed/<hash>?themeId&templateId&fontStackId`. No se acepta HTML/JavaScript.
- El servidor repite la allowlist; no confía en la validación del navegador.
- Iframe con `sandbox="allow-scripts allow-same-origin allow-forms"`, `referrerPolicy="no-referrer"`, sin navegación superior, popups, descargas, fullscreen ni dispositivos. Fallback externo con `noopener noreferrer`.
- Alumno: membresía activa de curso y grupo; docente ajeno: 403 en workspace y mutaciones. Borradores nunca se incluyen en lecturas publicadas.
- No se inventan finalizaciones, notas, tiempos, aciertos ni telemetría. `telemetry.evidence='none'` en este MVP.
- Archivar/ocultar/mover no cambia `activityId` ni borra revisiones; no hay operación de delete.
- Las Rules de cliente siguen denegando estos paths; la autoridad es el API local con Admin SDK, que reautoriza en transacción. No se añadieron Rules productivas ni se desplegó nada.

## Coste explícito

- Docente: hasta 50 definiciones + 50 asignaciones + 5 placements por carga de workspace.
- Alumno: 5 placements + una lectura de asignación y revisión por actividad publicada.
- Reordenar es O(n) sobre las actividades publicadas de un gimnasio (máximo 50) y escribe placement + asignaciones en la misma transacción. No se recomienda un write por evento de puntero: se guarda al soltar/confirmar.
- No se implementan agregados ni contadores globales. El catálogo no crece en lecturas de progreso de los 28 juegos.

## Evidencia ejecutada

| Verificación | Resultado |
|---|---|
| `npm run test:academic:api` | 87/87 |
| `npm run test:activities:security` | 4/4 |
| Suite docente Chromium | 75/75 |
| Suite docente WebKit | 74/74, drag nativo skip (botones accesibles cubiertos) |
| Actividades públicas Chromium/WebKit | 15/15 cada uno |
| `npm run typecheck:academic` | PASS |
| `npm run build` | PASS |

Capturas sintéticas: [editor](qa/teacher-activities/editor.png) y [editor móvil](qa/teacher-activities/editor-mobile.png). Sin credenciales, tokens ni datos reales.

El flujo UI usa profesora A, alumno B y docente ajeno (teacherB). Incluye borrador no visible, publicación, recarga, orden independiente por gimnasio/grupo, movimiento, ocultar/reactivar/archivar, acceso directo, revocación, URLs peligrosas y 28 juegos intactos.

## Limitaciones para producción

- No hay despliegue de API académica ni Rules de lectura directa para alumnos; el adaptador Vercel está preparado pero cerrado. Ver `docs/VERCEL-ACADEMIC-PILOT.md`.
- No hay persistencia de intentos/telemetría por actividad, rankings ni analíticas; las capacidades se declaran como no verificadas.
- No hay fechas de disponibilidad, edición masiva de asignaciones ni publicación multi-grupo en una sola acción de UI (la API acepta varios grupos; la UI publica el grupo abierto).
- Archivar es terminal en la UI; no hay restauración de archivadas en este MVP.
- No se validó el embed real de Wordwall/LearningApps en una red/iframe de producción ni la disponibilidad de sus hosts; el fallback externo está siempre disponible.
- El coste de reordenamiento y la cuota Spark deben revisarse antes de un piloto real; no se añade infraestructura de pago.

## Reproducción local

```sh
npm ci
npm run typecheck:academic
npm run build
npm run test:academic:api
npm run test:activities:security
npm run test:teacher
TEACHER_BROWSER=webkit npm run test:teacher
```

Con procesos activos: `TEACHER_REUSE_VITE=1 npm run test:teacher:ui`; Memorama requiere `MEMORAMA_DIR`. No se modifican workflows ni lockfiles.
