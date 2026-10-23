# ADR-001 · Identidad privada, ámbitos académicos y catálogo docente separado

Estado: propuesto para revisión en issue #3; reglas ejecutables solo en emulador. Fecha: 2026-10-23.
Base: `main` `5df2258` (Auth publicada); Firebase informado por propietario: `optilab-cd829`, `(default)`, `northamerica-south1`, Spark, producción actualmente deny-all. No se consultaron ni escribieron documentos reales.

## Decisión y alternativas

1. **Identidad permanente bajo users/{uid}.** Frente a progreso dentro de un grupo, conserva continuidad al cambiar de curso/semestre y evita que la docente lea toda la vida personal del alumno. No guardar roles, correos, providers ni tokens en este documento; Auth conserva identidad/proveedores.
2. **Cursos raíz; periodos y grupos anidados.** Frente a groups raíz con campos courseId/termId filtrados por cada consulta, los paths fijan el ámbito, impiden colisiones entre grupos homónimos de otros semestres y simplifican comprobaciones de permisos. Campos de contexto redundantes se validan contra el path, no conceden autoridad.
3. **Grants por UID en colecciones members/staff.** Frente a arrays de 70 UIDs en un curso o roles en users, permiten revocación puntual sin documento caliente, sin autoconcederse rol y sin depender del refresco de custom claims. Se exige grant activo del curso **y** del grupo exacto, además de curso/periodo/grupo coherentes y activos. Staff de un grupo no hereda todos los grupos del curso. No hay administrador cliente.
4. **Progreso compacto + historiales append-only.** Frente a arrays crecientes de intentos en progress/current (reescritura completa, contención y límite de 1 MiB), separar diagnósticos, runs e hitos. Frente a un documento por juego practicado, un mapa acotado de 28 entradas reduce lecturas y conserva fechas. Reglas validan cada valor explícitamente, sin mapas arbitrarios opacos.
5. **Historial académico por ámbito, no historial personal global consultable por docente.** Una proyección futura por grupo conserva courseId/termId/groupId, uid, activityId/revisión y gimnasio **en el momento del intento**. Nunca inferir el grupo histórico desde la membresía actual.
6. **Catálogo base estático + definiciones docentes por curso.** No copiar los 28 juegos ni cinco gimnasios a Firestore; su identidad sigue en el catálogo versionado del repositorio. Las actividades externas se definen una vez por curso, se asignan por grupo y se ordenan de forma independiente. Un catálogo externo raíz obligaría a permisos multitenant más complejos y podría compartir borradores accidentalmente.

## Modelo

```text
Auth UID (permanente; sin cambios a Authentication)
users/{uid}                                  identidad mínima
  progress/current                           perfil y práctica privada, revision
  diagnostics/{attemptId}                     results locales normalizados
  gameRuns/{runId}                            gameResults; solo Memorama v1 hoy
  evolutionMilestones/{2|3}                   evidencia de hitos v1
  enrollments/{pointerId}                     índice de descubrimiento, NO permiso

courses/{courseId}                            materia, independiente del semestre
  members/{uid}                              grant de alumno del curso
  staff/{teacherUid}                          grant de docente del curso
  activities/{activityId}                     FUTURO: definición privada canónica
    revisions/{revision}                     FUTURO: versiones históricas inmutables
  terms/{termId}                              periodo académico
    groups/{groupId}                          oferta de un grupo en ese periodo
      members/{uid}                          grant del alumno en ese grupo
      staff/{teacherUid}                      asignación docente específica
      studentSummaries/{uid}                  proyección académica del ámbito
      leaderboard/{uid}                      proyección confiable, sin productor aún
      groupActivities/{activityId}            FUTURO: asignación pequeña + orden proyectado
      activityPlacements/{gymId}              FUTURO: secuencia y revision por gimnasio
      publishedActivities/{activityId}        FUTURO: vista sanitizada para alumnos
      activityAttempts/{attemptId}            FUTURO: historial académico contextualizado
      academicSummaries/{summaryId}           FUTURO: alumno/grupo/día/periodo/confianza
      invitations/{invitationId}              FUTURO: solo operación confiable

Catálogo base público: JSON/TypeScript existente, 28 juegos y 5 gimnasios
```

`progress/current` es una subcolección de **cada** usuario, no una ruta raíz compartida. No hay leaderboard global ni colección raíz de staff con poder universal. No implementar búsquedas collectionGroup privadas; paths explícitos y punteros privados permiten descubrir ámbitos sin escanear cursos.

## Contrato de progreso para #4 (sin migración implementada)

| Campo local | Representación Cloud v1 | Regla/semántica |
|---|---|---|
| practiced | progress/current.practiced: map repo → Timestamp | Solo 28 IDs base; cada fecha tipada y no futura; declaración del usuario |
| visited | progress/current.visited | Conjunto de IDs 1–5, máximo cinco |
| badges | No duplicar en Cloud; derivar de practiced y catálogo v1 | No aceptar insignias autoritativas declaradas |
| nickname | progress/current.nickname | Hasta 30 caracteres; no usar como rol ni alias público automáticamente |
| route | progress/current.route | Lista ordenada de hasta 28 IDs base únicos |
| avatarId / companionId | progress/current | Seis entrenadores/cinco familias o null |
| evolutionCelebratedStage | progress/current | Entero 1–3; estado de presentación, no prueba competitiva |
| results | diagnostics/{attemptId} | answers de cinco enteros 0–2, score 0–5 coherente con diagnóstico v1; append-only |
| gameResults | gameRuns/{runId} | UUID v4, fecha y payload Memorama conservados; métricas coherentes con protocolo existente |
| evolutionMilestones | evolutionMilestones/{2|3} | stage, ruleVersion=1, unlockedAt y mapa de evidencia; 6/2 y 18/4 exigidos estructuralmente |

`schemaVersion=1`, `uid`, `createdAt` de servidor y `updatedAt`/revision de progreso permiten versionado y CAS. El cliente no cambia uid/createdAt ni salta/repite revision. Historial e hitos no se actualizan ni borran desde cliente. Los timestamps de ocurrencia/evidencia son **autorreportados**, distintos de la recepción en servidor. Evidencia de práctica no demuestra haber jugado. Ni siquiera la coherencia matemática de Memorama o diagnóstico convierte los resultados en estadísticas competitivas verificadas.

La futura importación debe convertir fechas ISO a Timestamp y volver a ISO al reconstruir, derivar badges y normalizar evidencia por ID. Diseñar IDs idempotentes para diagnósticos sin runId local y preservar orden de eventos con cursores fecha+ID. No importar silenciosamente el perfil compartido del navegador a una cuenta nueva: respaldo, elección explícita, aislamiento de caché por UID y resolución de conflictos en #4. Si hay fechas futuras, IDs desconocidos, rutas duplicadas o campos antiguos incompatibles, conservar respaldo local e informar; nunca descartarlos silenciosamente ni sobrescribir optilab-v1. La política de reset/borrado remoto requiere decisión separada en #4; las reglas actuales deniegan deletes. El historial local sigue teniendo sus límites existentes de 30/50: no inventar intentos que ya no existen.

## Administración, actividades y orden (contratos previstos, rutas cerradas)

- `ActivityDefinition`: activityId estable, provider, URLs validadas, título/descripción/instrucciones, estado, revisión, telemetría real, createdBy y timestamps. No HTML arbitrario. Providers iniciales Wordwall/LearningApps; cada nuevo proveedor requiere adaptador/allowlist revisados.
- `GroupActivityAssignment`: referencia a definición/revisión + ámbito + gimnasio, disponibilidad, estado y displayOrder materializado. La misma actividad puede tener diferente gimnasio, orden y disponibilidad en dos grupos sin duplicar la definición completa.
- `ActivityPlacement`: un documento por grupo/gimnasio con lista de IDs (propuesta máximo 100) y revision. Futura transacción lee revision y actualiza secuencia/assignment projections consistentemente. No “last writer wins” silencioso; conflictos se notifican. Un máximo 100 mantiene operaciones por debajo de los límites del batch; hay que validar acceso por operación y límites de Rules antes de habilitar escrituras cliente.
- `PublishedActivityView`: copia mínima sanitizada por grupo, necesaria porque Firestore no oculta campos de un documento. Alumnos no leen definiciones/borradores. Publicador confiable valida estado, asignación, calendario y revisión y retira la vista al ocultar/archivar. La regla futura también deberá comprobar publicación/ventana autoritativas: una vista obsoleta no puede conceder acceso.
- `ActivityAttempt`: referencia estable y revisión usada, gymIdAtAttempt y ámbito original. Mover/reordenar/archivar una actividad no modifica intentos ni referencias de revisiones. Mantener tombstone/revisiones mientras existan historiales referenciados.
- `AcademicSummary`: agregados separados por confianza y periodo. Valores ausentes son desconocidos, no ceros de rendimiento. #9 consulta resúmenes y páginas, no descarga todo el historial para cada gráfica.

En #3 estas rutas, incluido leer actividades supuestamente publicadas, están **denegadas por defecto** y probadas así. Los tipos y el índice propuesto no implementan ni prueban publicación, reorder, invitaciones, telemetría o dashboard. #5/#6/#12 deberán implementar sus productores y extender reglas/tests antes de habilitar cualquier acceso. No se anuncian rankings o analíticas funcionando.

## Raíz de confianza y operación privilegiada

Un operador identificado y autorizado puede, en una fase posterior, crear grants verificados del curso/grupo usando Console o un proceso administrativo fuera del navegador con IAM mínimo. Las librerías servidor/Admin omiten Rules: ese proceso debe validar ámbito, tipos, aprobación, idempotencia y registrar auditoría; no equivale a un usuario cliente con campo admin. Aquí el único operador es `withSecurityRulesDisabled` del emulador y sus fixtures sintéticos.

Para autonomía docente de #5/#12 será necesario un servicio privilegiado aprobado o reglas transaccionales específicas mucho más acotadas. Este ADR elige **no** habilitar escrituras administrativas desde cliente en #3. Un operador manual sirve como bootstrap, no satisface autonomía. Diseñar mecanismo, autenticación, autorización transaccional, límites, auditoría y presupuesto antes de implementarlo. Firestore Spark no proporciona por sí mismo servidor de validación: no prometer Functions gratis; no crear Functions, activar Blaze, alojar backend ni descargar cuentas de servicio ahora. Resultados competitivos verificados exigen verificador independiente y una fuente medible; los mensajes postMessage de un cliente controlable no bastan.

Revocar grant de grupo o curso bloquea las próximas lecturas remotas del ámbito, aunque un pointer quede obsoleto. No borra Auth, progreso personal o históricos. Un curso/periodo archivado actualmente cierra también sus vistas: el acceso histórico futuro requerirá permiso explícito y pruebas nuevas. Datos ya descargados/capturados no pueden revocarse retroactivamente; #4 deberá limpiar caché y listeners al cambiar UID, y no persistir datos académicos compartidos sin política aprobada.

## Consultas e índices

Ahora: get de progreso/metadata por path, gameRuns/diagnostics por fecha descendente con limit ≤50 y cursor, hitos limit ≤2, enrollments limit ≤20. Prohibidos list users/courses/groups/members/leaderboard y escaneos collectionGroup; docente usa únicamente gets de proyecciones autorizadas en esta base técnica. No existe dashboard que haga N gets; las consultas agregadas vendrán con #9 y sus índices.

Exenciones `*` eliminan indexación automática de mapas/arrays y textos. Solo date DESC de runs/diagnostics se habilita para la consulta actual. Un compuesto **previsto**, collection-scope `groupActivities(status ASC, gymId ASC, displayOrder ASC)`, prepara la consulta por grupo/gimnasio/orden de #12 sin abrir permisos. La vista publicada podrá necesitar un índice equivalente al implementar su consulta; no anticipar todos los filtros posibles de #9. Los índices no confieren permisos. Emulator no obliga a tener índices compuestos: probar permisos allí no acredita que un índice esté desplegado/READY en producción.

Costos y matriz: [FIRESTORE-SECURITY.md](../FIRESTORE-SECURITY.md) y [FIRESTORE-BUDGET.md](../FIRESTORE-BUDGET.md). Roadmap: #3 → #4 → #5 → #6 → #12; #7 después de #4/#6; #9 base después de #5/#7 y clasificación al integrar #8; QA #10 transversal.
