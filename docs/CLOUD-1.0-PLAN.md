# OptiLab Cloud 1.0 · seguimiento verificado

Repositorio: `IsraelTiburcio-ai/optilab`. Base actual de #3: `main` en `5df2258`, con Authentication publicada mediante PR #11. QA público Safari/iPhone y logout entre pestañas reportados PASS por el propietario; #2 cerrado. Pendientes físicos restantes en el reporte Auth.

## GitHub

- [Milestone 1: OptiLab Cloud 1.0 — Cuentas, Grupos y Liga](https://github.com/IsraelTiburcio-ai/optilab/milestone/1), sin fecha límite.
- [EPIC #1: Plataforma educativa multigrupo](https://github.com/IsraelTiburcio-ai/optilab/issues/1).
- Catorce etiquetas creadas/reutilizadas con descripción y color: `epic`, `firebase`, `authentication`, `firestore`, `security`, `gamification`, `teacher-dashboard`, `analytics`, `frontend`, `backend`, `testing`, `priority:P0`, `priority:P1`, `priority:P2`.

| Fase | Ticket real | Dependencias reales |
|---|---|---|
| 01 | [#2 · Firebase Authentication](https://github.com/IsraelTiburcio-ai/optilab/issues/2) | Ninguna |
| 02 | [#3 · Firestore y reglas](https://github.com/IsraelTiburcio-ai/optilab/issues/3) | #2 |
| 03 | [#4 · Sincronizar y migrar progreso](https://github.com/IsraelTiburcio-ai/optilab/issues/4) | #2, #3 |
| 04 | [#5 · Cursos, grupos y permisos](https://github.com/IsraelTiburcio-ai/optilab/issues/5) | #4 |
| 05 | [#6 · Actividades de la profesora](https://github.com/IsraelTiburcio-ai/optilab/issues/6) | #5 |
| 06 | [#7 · Resultados, intentos y métricas](https://github.com/IsraelTiburcio-ai/optilab/issues/7) | #4, #6 |
| 07 | [#8 · Liga por grupo](https://github.com/IsraelTiburcio-ai/optilab/issues/8) | #5, #7 |
| P1 adicional | [#12 · Editor académico de gimnasios y actividades](https://github.com/IsraelTiburcio-ai/optilab/issues/12) | #3, #5, #6; relacionado con #9 |
| 08 | [#9 · Panel privado docente](https://github.com/IsraelTiburcio-ai/optilab/issues/9) | #3, #5, #7; #8 solo para clasificaciones |
| 09 | [#10 · QA, privacidad y lanzamiento](https://github.com/IsraelTiburcio-ai/optilab/issues/10) | #2–#9 y #12; transversal |

Cada ticket incluye contexto, alcance, dependencias, criterios, pruebas, seguridad y condiciones de cierre. El EPIC tiene diez subissues nativos, incluido el nuevo editor #12, todos en el milestone. #5 amplía administración de alumnos/invitaciones/transferencias, #6 proveedores externos seguros y #9 analíticas por ámbito/confianza. No hay un editor duplicado: #6 aporta integración, #12 edición/orden/publicación y #9 seguimiento.

Se inspeccionaron issues abiertos/cerrados, milestones y labels antes de crear. No existían tickets o milestones equivalentes. La creación buscó títulos/identificadores existentes y reutilizó labels para no duplicar entidades en una repetición. La asociación de milestone, etiquetas y referencias se verificó mediante la API después de crear.

## Corte actual de sincronización #4

PR #13 de [#3](https://github.com/IsraelTiburcio-ai/optilab/issues/3) fusionada/publicada en Pages en `adc8b17`; sus reglas/índices NO se publicaron en Firebase y #3 sigue abierto por aprobación/operación pendiente. Se implementa exclusivamente [#4](https://github.com/IsraelTiburcio-ai/optilab/issues/4) en `feat/cloud-progress-sync`, desde ese baseline, solo en emuladores. [ADR-002](architecture/ADR-002-progress-sync.md), [instrucciones/presupuesto/rollback](PROGRESS-SYNC.md). Los módulos #5–#10/#12 siguen planificados.

La PR #11 de Auth ya está fusionada/publicada. El reporte [AUTH-RELEASE-REVIEW.md](AUTH-RELEASE-REVIEW.md) distingue evidencia automática, QA local y el smoke publicado informado por el propietario.

Esta entrega de #4 se prepara sin fusionar ni desplegar funcionalidad/reglas/índices. Producción mantiene `optilab-v1` y no genera solicitudes Firestore. El modo explícito de desarrollo usa solo demo-optilab-sync; no se crean datos reales, grupos, roles o servicios de pago.

Orden recomendado: #3 → #4 → #5 → #6 → #12; #7 tras #4/#6; #9 base tras #5/#7 y Liga #8 cuando exista verificación confiable. El mecanismo privilegiado y sus costos se deberán aprobar antes de habilitar administración autónoma, publicación docente o estadísticas competitivas.
