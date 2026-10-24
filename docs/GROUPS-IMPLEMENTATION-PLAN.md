# Issue #5 · Plan técnico de cursos, grupos y permisos

**Avance del panel visual:** [TEACHER-PANEL.md](TEACHER-PANEL.md) documenta la implementación docente local, revisión CAS del roster, paginación y guía de aceptación. Pantallas de alumno e integración del editor siguen pendientes. PR visual sin merge/despliegue autorizados.

**Siguiente entrega local:** [inscripción estudiantil y perfil académico mínimo](STUDENT-ENROLLMENT.md), con enlace seguro, consentimiento y proyección autorizada. Editor y puertas productivas siguen pendientes; nueva PR sin merge.

**Prototipo local aprobado; backend entregado en PR separada sin merge ni despliegue.** [ADR-003](architecture/ADR-003-academic-administration.md) contiene la decisión y [ACADEMIC-ADMIN.md](ACADEMIC-ADMIN.md) el contrato implementado, manual Mac, pruebas y presupuesto medido. Baseline: main `41c2ebe` tras merge documental autorizado de PR #15. Las pantallas siguientes siguen siendo propuestas.

## Pantallas propuestas

### Profesora

1. **Mis cursos/periodos/grupos:** solo scopes devueltos tras comprobar grants; estados actual/archivado. Crear grupo/periodo solo si delegación confiable lo permite; no editor de roles.
2. **Integrantes:** páginas de hasta 50, inscritos/activos/inactivos definidos, búsqueda acotada, nombre elegido/verificado diferenciado. Detalle del estudiante autorizado con vínculos a historia contextual, no acceso global a users/progreso.
3. **Invitaciones:** crear/reemitir, copiar enlace una sola vez, vencimiento/uso, pendientes, revocar; un token perdido se reemplaza, no se recupera desde datos públicos.
4. **Solicitudes:** identidad y ámbito, aprobar/rechazar con confirmación; no mostrar secreto de canje ni permitir escribir un UID arbitrario como grant.
5. **Baja/transferencia:** preview origen/destino y consecuencias; confirmar, mostrar recibo y estado actual. Si no administra destino, denegar en API además de UI.
6. **Auditoría mínima:** transiciones de sus ámbitos, sin credenciales ni acciones fuera de alcance. Accesos a integración externa #6/editor #12 y analíticas #9 cuando se implementen.

### Alumno

1. **Mis grupos:** matrícula verificada, periodo y estado; perfiles personales siguen por UID fuera de cursos.
2. **Aceptar invitación:** confirmar cuenta y destino, pedir aprobación; estado pendiente/aprobado/rechazado/vencido, sin descubrir miembros ajenos.
3. **Baja o cambio:** mensaje claro de acceso retirado; progreso personal disponible. Una invitación antigua no vuelve a conceder ingreso.
4. **Mi historia permitida:** solo propia y según política aprobada; nunca listado/ranking de antiguos compañeros por mera pertenencia histórica.

## Contrato de comandos local

Operaciones enumeradas: `createInvitation/reissueInvitation/revokeInvitation`, `requestMembership`, `approveMembership/rejectMembership`, `revokeMembership`, `transferMembership`, `createTerm/createGroup` si delegados y lecturas `myScopes/roster/requestStatus/groupInvitations/groupRequests/membershipEvents`. Esquemas exactos y límites en [el contrato local](ACADEMIC-ADMIN.md#contrato-http).

Actor desde token, target desde una solicitud o membresía autoritativa, IDs/path con límites del ADR-001 y contextos coherentes. Cada mutación lleva idempotencyKey + fingerprint del comando y expectedRevision de la entidad operativa. Staff/capacidades se leen dentro de la transacción antes del commit, incluyendo replay: una revocación concurrente causa retry/denial. Estados no confirmados no se muestran como completados.

Progreso (`sync/current`, epochs, prácticas, equipo/hitos/resultados) fuera del repositorio de escritura académico. Solo se permiten paths administrativos construidos por servidor y pointers de descubrimiento. No endpoint para borrar Auth, asignar staff desde docente, alterar stats verificadas o editar reglas/índices/billing.

## Plan incremental de trabajo

| Etapa | Entrega futura | Puerta de aceptación |
|---|---|---|
| 0 · Decisión | ADR-003, modelo, pantallas y presupuesto | Aprobado únicamente el prototipo local |
| 1 · Política local | Validadores puros, matriz y especificación de comandos | Tests negativos por operación, sin credenciales reales |
| 2 · Backend emulado | Servicio local + Auth/Firestore Emulator del proyecto demo-optilab-sync | Guards antes de SDK/Admin: loopback, demo exacto, sin ADC/keys reales; negar tráfico Firebase no emulado |
| 3 · Integrantes/invitaciones | Roster, requests, aprobación, baja/readmisión y recibos | Concurrencia, límites, no escalada, no bypass por Admin SDK |
| 4 · Periodos/transferencia | Oferta nueva, varios grupos/periodos y archivo | Autoridad ambos ámbitos, historia inalterada, progreso personal intacto |
| 5 · UI | Panel profesor/alumno con estados, accesibilidad y paginación | Chrome/WebKit y QA físico de profesora; ninguna escritura administrativa directa |
| 6 · Revisión de lanzamiento | Hosting/IAM/secretos, reglas/índices concretos, rollout/rollback | Autorizaciones independientes; nada se activa por el mero merge |

Emuladores de #4 usan Auth 9099 y Firestore 8085; API local usa loopback 5200. La CLI del prototipo autentica y llama la misma API. No se ha implementado UI administrativa; una UI futura deberá conservar gate DEV/demo.

El emulador no prueba IAM, TLS, WIF, cuotas productivas, firma real de tokens o revocación bajo infraestructura real. No asumir que pasar Rules tests protege llamadas Admin: tests del servicio deben ejecutar su política real. Solo fixtures podrán usar bypass para preparar actores/grants, no los handlers sujetos a prueba.

## Matriz mínima de pruebas futuras

- Actores: sin sesión, Auth Anonymous, alumno A/B, docente asignado/ajeno/revocado, operador controlado. Grants/caps ausentes, extra fields, scope falso y relaciones incoherentes fallan cerrados.
- Escalada: client role/admin/actorUid, UID libre de payload, paths con slash/encoding, tampering de course/term/group, endpoints que permitan leer o escribir progreso ajeno; todos denegados.
- Invitaciones: random válido, secreto/locator incorrectos, expiración por reloj servidor, revocado, límite de uso, UID no vinculado, dos canjes simultáneos con último cupo, retry/replay y raw token ausente de logs/Firestore/receipts/referrer.
- Solicitudes: dos aprobaciones simultáneas, revocar invite durante aprobación, actor staff revocado entre lectura/commit, misma idempotencyKey con otro payload y reenvío tras baja sin auto-readmisión.
- Transferencia: docente administra solo origen o destino; una transacción falla completa; varios grupos activos; curso suspendido; no borrar Auth ni tocar bytes de progreso/epochs; no cambiar contexto de intentos previos.
- Historia: periodo/grupo homónimo en otro curso, archivado privado, lector histórico revocado, alumno retirado sin roster/ranking ajeno, estudiante con nuevo periodo conserva progreso.
- UI: URL directa y requests HTTP forjados, callbacks tardíos A→B, offline no finge éxito de administración, paginación/cursor y límites, 390/820/1180/1440, teclado/Axe, copy/reissue sin publicar secretos.
- Control de mutación: una política deliberadamente permisiva debe hacer fallar los negativos del **servicio**, no solo de Rules. Conservar las suites 30 core, 95 rules, Auth y regresión de #4.

## Presupuesto Spark administrativo

Las estimaciones previas de writes por admisión/baja quedaron por debajo del prototipo con índice multigrupo y auditoría global. Usar la [tabla de intentos medidos y proyección revisada](ACADEMIC-ADMIN.md#presupuesto-local-y-spark). Son intentos locales del SDK, no facturación medida en producción.

70 alumnos, dos grupos, un operador de bootstrap y una profesora. No incluye duplicar los 100–500 intentos por alumno: el progreso de #4 tiene su propio presupuesto y comparte las mismas cuotas.

| Operación/carga | Muestra local / proyección revisada |
|---|---|
| Bootstrap sintético | 27 documentos Firestore + seis usuarios Auth; datos reales de grupos pendientes |
| Solicitud válida | 5 writes, 9 intentos read |
| Aprobación/admisión inicial | 11 writes, 22 intentos read |
| Baja | 8 writes, 19 intentos read; ningún delete de cuenta/progreso |
| Transferencia | 13 writes, 42 intentos read; validación de dos scopes |
| Revisar roster de70 activos dos veces/día | ~888 intentos read/día con perfil mínimo, detalle CAS y páginas20 (ocho páginas totales) |
| Incorporación de 70 | ~2170 reads/1120 writes, más invitaciones/retries y operaciones Auth |
| Almacenamiento metadata/roster/events/requests | Reserva de ~1–5 MiB por semestre bajo ~1.000–2.000 documentos compactos; crecimiento depende de auditoría/retención |
| Transferencia de administración | Orden <0,1 GiB/mes con páginas pequeñas y sin históricos completos; no incluye assets/proveedores |

Cuotas de referencia: Firestore gratis 50.000 reads/día, 20.000 writes/día, 20.000 deletes/día, 1 GiB y 10 GiB salientes/mes, compartidas por el proyecto. Añadir este presupuesto al estimado #4 (~18.500–22.500 reads/día normal), no tratarlo como cuota separada por grupo. Operaciones rechazadas/reintentos y un enlace filtrado pueden consumir recursos. No hay garantía contra abuso por contar solo 70 alumnos.

Backend externo: **sin cotización aprobada**. Un host institucional ya disponible podría evitar contratación, pero necesita responsable, TLS, actualizaciones, disponibilidad, custodia de credenciales, rate limits y monitoreo. No se cotiza “gratis” Cloud Run/Functions por sus free tiers. Spark puede mantenerse como objetivo de Firestore sin que el alojamiento externo esté cubierto por Spark. No se contrata ni configura nada en esta preparación.

Consultas implementadas por ID y filtro status opcional, cursor/limit≤50, sin scans globales ni listeners por alumno. No necesitan un índice compuesto nuevo; no se modifican índices. Un filtro/orden por fecha, exenciones de campos y políticas de retención futuras requieren validación aparte. El emulador no valida requisitos de índices productivos; no presentar índices/exenciones propuestos como publicados.

## Dependencias y decisiones para el propietario

- #3 aporta raíz de confianza/aislamiento; sus reglas productivas siguen sin desplegar. #4 aporta UID permanente y progreso separado, fusionado solo para emuladores; su puerta productiva sigue abierta.
- #5 desbloquea asignación segura de #6, órdenes/grupos de #12 y ámbitos docentes de #9. No implementar ahora proveedores, editor, métricas o Liga; el dashboard base no necesita que Liga esté terminada.
- El prototipo backend local está aprobado. La delegación real, el responsable de operación y los límites de producción siguen pendientes; los fixtures sintéticos no los deciden.
- Antes de producción: host/operación/costos, IAM/credenciales y validación Auth; política de datos de roster/historia tras baja y archivo; conservación/auditoría y defensa de cuota/abuso. El operador debe recibir los datos reales de grupos/periodos en canal privado, no inventarlos ni publicarlos en GitHub.
- La aceptación formal de conflicto/reset, retención/borrado, Mac/iPhone y activación real de #4 es independiente. Ni esta documentación ni un futuro merge de #5 autorizan reglas, servicios pagos o operaciones reales.

Resultado actual: backend modular local, fixtures sintéticos, CLI y pruebas reales contra emuladores; ver [manual y evidencia](ACADEMIC-ADMIN.md). #5 permanece abierto hasta completar las fases autorizadas y revisar UI/lanzamiento. Los permisos administrativos directos del navegador siguen denegados.
