# OptiLab Cloud 1.0 · seguimiento verificado

Repositorio: `IsraelTiburcio-ai/optilab`. Base de implementación: `main` en `df90101`, con OptiCriaturas integrada y build de producción aprobado antes de cambios.

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
| 08 | [#9 · Panel privado docente](https://github.com/IsraelTiburcio-ai/optilab/issues/9) | #5, #7, #8 |
| 09 | [#10 · QA, privacidad y lanzamiento](https://github.com/IsraelTiburcio-ai/optilab/issues/10) | #2–#9 |

Cada ticket incluye contexto, problema, objetivo, alcance, exclusiones, dependencias, propuesta técnica, archivos candidatos, criterios verificables, pruebas, riesgos y condiciones de cierre. Los diez issues están asociados al milestone. GitHub aceptó las nueve relaciones nativas de subissue; el EPIC mantiene además la checklist enlazada y el grafo de dependencias en Markdown.

Se inspeccionaron issues abiertos/cerrados, milestones y labels antes de crear. No existían tickets o milestones equivalentes. La creación buscó títulos/identificadores existentes y reutilizó labels para no duplicar entidades en una repetición. La asociación de milestone, etiquetas y referencias se verificó mediante la API después de crear.

## Corte de esta PR

Solo se implementa [#2](https://github.com/IsraelTiburcio-ai/optilab/issues/2) en `feat/firebase-auth`. Los tickets #3–#10 son planificación, no funcionalidades construidas en esta rama.

Entrega de revisión: **[PR #11](https://github.com/IsraelTiburcio-ai/optilab/pull/11)**, con capturas del emulador y reporte manual real PASS del propietario. El ticket #2 permanece abierto hasta resolver su cierre después de la revisión/publicación autorizada.

La PR se entrega sin fusionar ni desplegar. Authentication no significa sincronización: el progreso sigue en `optilab-v1`. No se crean documentos Firestore, grupos, roles, métricas competitivas ni nuevas reglas de producción. No se activa Blaze.

La API key fue configurada por el propietario y validada junto con los cinco valores públicos restantes. No se creó una key ficticia ni se solicitó una cuenta de servicio. Se comprobó el arranque local de lectura y el propietario reportó PASS para Google/correo reales, verificación, recuperación, persistencia, logout y conservación de progreso. Dominio público y dispositivos físicos permanecen pendientes. Detalles y plan de publicación/reversión: [AUTH-RELEASE-REVIEW.md](AUTH-RELEASE-REVIEW.md).
