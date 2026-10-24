# Administración académica · prototipo local (#5)

**Panel visual docente v1:** [arranque Mac, contrato ampliado, seguridad y QA](TEACHER-PANEL.md). La fase visual agrega `revision` al roster y capacidades/periodos paginados a `myScopes`; no habilita producción.

**Inscripción estudiantil y perfil mínimo:** [STUDENT-ENROLLMENT.md](STUDENT-ENROLLMENT.md) agrega el enlace HashRouter seguro, consultas/escritura autenticadas de perfil propio y proyección docente condicionada. No concede lectura de progreso ni modifica Rules.

Backend modular Node 22/TypeScript con Auth y Firestore Emulator. Rama basada en el merge documental de PR #15, `41c2ebe9fb79dbdb9ff358de5b07c65602c570da`. La entrega es una PR sin merge ni despliegue. Producción y UI administrativa requieren fases posteriores.

## Ejecución en Mac

Requisitos: Node 22, npm y Java 21. En esta Mac Java está en `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`; en otros equipos usar su instalación.

```sh
npm ci
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
npm run emulators:sync
```

Si Auth 9099 y Firestore 8085 ya están activos para `demo-optilab-sync`, reutilizarlos; no arrancar otra instancia, detenerlos ni vaciar su proyecto. En otra terminal:

```sh
read -s "ACADEMIC_FIXTURE_PASSWORD?Contraseña sintética (12–100 caracteres): "
export ACADEMIC_FIXTURE_PASSWORD
ACADEMIC_BOOTSTRAP=synthetic-v1 npm run academic:seed
unset ACADEMIC_FIXTURE_PASSWORD
npm run academic:dev
```

`read -s` corresponde a zsh, shell predeterminado de macOS. El seed imprime solamente IDs y correos sintéticos `@example.test`, nunca la contraseña. Cada ejecución crea un curso nuevo con UUID completo, periodo, dos grupos y seis actores: `teacherA` (solo A, puede crear periodo/grupo), `teacherB` (solo B, sin capacidades de creación), `teacherBoth` (A y B), `studentA/B/C`. La profesora real no tiene que editar grants para esta prueba. Solo el bootstrap local prepara staff/capacidades; no existe endpoint de asignación docente.

El API escucha `http://127.0.0.1:5200`; `/health` devuelve únicamente modo/proyecto. Los launchers fijan configuración demo explícita y rechazan valores heredados incompatibles. No leen `.env.local`. No pasar contraseñas o secretos como argumentos de shell ni publicarlos en GitHub.

### CLI por la misma API

`academic:client` recibe un único JSON por stdin: `{email,password,operation,payload}`. Hace login contra Auth Emulator y envía su ID token a la API; no usa Admin ni bypass. Por defecto redacta el token de invitación. Para copiar una invitación sintética en una terminal privada, añadir `--reveal-invitation`.

Esta entrada interactiva evita guardar la contraseña en el historial del shell:

```sh
python3 -c 'import getpass,json,sys
def ask(label):
    print(label, file=sys.stderr, end=" ", flush=True)
    return input()
print(json.dumps({"email":ask("Correo sintético:"),"password":getpass.getpass("Contraseña sintética: "),"operation":ask("Operación:"),"payload":json.loads(ask("Payload JSON:"))}))' | npm run academic:client -- --reveal-invitation
```

Usar los IDs/correos del seed. Para cada comando nuevo generar una clave con `python3 -c 'import uuid; print(uuid.uuid4())'`; para reintentar una respuesta perdida conservar la clave y el payload exactos.

### Recorrido de aceptación

1. Como `teacherA`, `myScopes` con `{"kind":"teacher"}` descubre A. `teacherB` descubre solo B; `teacherBoth`, ambos.
2. Como `teacherA`, `createInvitation` con scope A, clave nueva, `expiresInSeconds:3600`, `maxUses:10`, `maxPending:10`. Copiar `inviteId` y el token de esa respuesta privada.
3. Como `studentA`, `requestMembership` con ese scope, locator, token y clave nueva. `requestStatus` con el `requestId` muestra pendiente, sin acceso activo.
4. Como `teacherB` o alumno, intentar aprobar A: 403. Como `teacherA`, aprobar con `requestId`, `expectedVersion:1` y clave nueva. `roster`, `myScopes` del alumno y `requestStatus` confirman matrícula activa.
5. Como `teacherA`, dar baja con UID del roster, versión devuelta por la aprobación y clave nueva. Se conserva login/progreso/historia y el grupo B si existiera. La invitación antigua no readmite; hacen falta invitación nueva, solicitud y aprobación explícita.
6. Repetir admisión y transferir A→B: `teacherA` recibe 403; `teacherBoth` puede transferir con versión actual y `destinationGroupId`. Origen revocado/destino activo se confirman conjuntamente. `membershipEvents` conserva los eventos originales y añade `transfer-out/in`.
7. Repetir un `createInvitation` con la misma clave/payload: devuelve el mismo locator y `replayed:true`, **sin token**. Cambiar payload manteniendo clave: 409. Si se perdió el secreto, `reissueInvitation` con clave nueva revoca el anterior y genera uno nuevo.
8. Crear periodo y grupo como `teacherA`; `teacherB` recibe 403. El nuevo grupo asigna solamente al creador, sin parámetro para añadir otros docentes.

Las pruebas automatizadas ejecutan estos casos por HTTP y añaden concurrencia, revocación entre preflight y commit, grants malformados, claims falsos, curso suspendido, clientes directos, límites y control de mutación. El recorrido manual no se presenta como QA físico ya realizado por la profesora.

## Contrato HTTP

`POST /v1/{operation}`, `Content-Type: application/json`, `Authorization: Bearer <ID token de Auth Emulator>`. El servidor verifica el token con revocación, rechaza Anonymous y usa el UID verificado. Host exacto loopback, CORS solo Vite 5195, JSON ≤16 KiB, `Cache-Control:no-store`. El cliente local no sigue redirecciones. Campos desconocidos se rechazan; no se aceptan roles, actorUid, rutas Firestore ni métodos arbitrarios.

Scope = `courseId,termId,groupId`. Todas las mutaciones requieren `idempotencyKey` (16–80 caracteres alfanuméricos, `_` o `-`). IDs de scope/entidad ≤80, UID/cursor ≤128. Nombres `title` de 1–120 caracteres sin controles. Las versiones se consultan en la entidad/resultado actual; no inferirlas por contador local.

| Comando | Campos además de scope/clave | Autoridad |
|---|---|---|
| `createInvitation` | `expiresInSeconds,maxUses,maxPending` | staff curso + grupo exacto + manageInvitations |
| `reissueInvitation` | anteriores + `inviteId,expectedVersion` | misma |
| `revokeInvitation` | `inviteId,expectedVersion` | misma |
| `requestMembership` | `inviteId,token` | identidad no anónima, secreto/contexto vigente; solo solicita para sí |
| `approveMembership` / `rejectMembership` | `requestId,expectedVersion` | staff curso + grupo exacto + manageMembers; target sale de solicitud |
| `revokeMembership` | `uid,expectedVersion` | manageMembers; UID debe tener membresía autoritativa |
| `transferMembership` | `uid,destinationGroupId,expectedVersion` | manageMembers en origen y destino; mismo curso/periodo |
| `createTerm` | solo `courseId,title` + clave, sin termId/groupId | staff curso + createTerms |
| `createGroup` | solo `courseId,termId,title` + clave, sin groupId | staff curso + createGroups |

Invitaciones: CSPRNG 32 bytes/256 bits, base64url 43 caracteres, locator UUID independiente, SHA-256 persistido. TTL 1–604800 segundos (máximo configurable a la baja), usos y pendientes 1–100. Aprobación obligatoria. Vencida/revocada/agotada/secreto incorrecto devuelven el mismo 404 `INVITATION_UNAVAILABLE`. Los límites son política sintética del prototipo, no fechas/cupos de grupos reales.

| Lectura | Entrada | Respuesta mínima |
|---|---|---|
| `myScopes` | `kind:student/teacher`, paginación | scopes propios comprobados y título; pointers no conceden autoridad |
| `roster` | scope, paginación | UID interno, etiqueta, estado/revisión y perfil mínimo nullable; correo Auth solo en proyección autorizada |
| `requestStatus` | scope, requestId o inviteId propio | estado de solicitud/invitación, membershipStatus y accessAllowed; nunca secreto |
| `groupRequests` | scope, paginación, status opcional pending/approved/rejected | solicitudes sanitizadas; manageMembers |
| `groupInvitations` | scope, paginación | metadata/counters, nunca token/hash; manageInvitations |
| `membershipEvents` | scope, paginación | eventos del grupo; readHistory |

Paginación por ID con `limit` 1–50 (scopes 1–20), `cursor` y `nextCursor`. Puede haber página final vacía. Consultas/contexto/autorización comparten una transacción de solo lectura: snapshot coherente, no permiso perpetuo. Una revocación posterior al snapshot retira las siguientes lecturas; no puede retirar datos ya entregados. No hay listeners globales, scans de users/Auth, búsqueda pública ni lectura de progreso ajeno.

Errores sanitizados: 400 entrada, 401 sesión, 403 autorización, 404 indisponible, 409 conflicto/version/payload idempotente, 413 tamaño, 429 límite (Retry-After 60), 500 genérico. El limiter acota memoria a 1000 claves y opera por IP y UID/minuto antes de lecturas académicas. Al compartir IP loopback, sus actores comparten el límite IP. No es limitación distribuida ni protección de cuota productiva. Variables locales: `ACADEMIC_RATE_LIMIT` 1–10000 (default 60), `ACADEMIC_ADMIN_PORT` default 5200 y `ACADEMIC_MAX_TTL_SECONDS` default 604800.

## Frontera privilegiada y modelo

`server/academic/config.ts` valida modo/host/proyecto/env antes de imports SDK privilegiados. Solo `development`, modo `emulator`, proyecto exacto `demo-optilab-sync`, Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8085`. Rechaza credenciales/keys, FIREBASE_CONFIG, proyectos heredados distintos, metadata/cloud runtime y trazas gRPC. Ambos puertos se prueban antes de inicializar Admin; si falta uno, el arranque falla sin fallback.

`sdk.ts` usa una credencial marcadora local `owner` para Auth, Firestore explícito sin TLS y GoogleAuth con PassThroughClient/universe explícitos: evita búsqueda de ADC y metadata de google-gax incluso en emulador. No certificados, service accounts ni ADC reales. El repositorio solo acepta instancias creadas por ese factory. Admin, google-auth-library y tipos Node son dependencias de desarrollo; el frontend no los importa.

Admin **omite Rules**. `authorization.ts` aplica staff v1 exacto de curso y grupo + capacidades v2 separadas, curso/periodo/grupo activos y relaciones coherentes. Todas las mutaciones vuelven a autorizar dentro de la transacción, también en replay. Reintentos de Firestore limitados a tres. Lecturas antes de writes; CAS, contadores de pendientes/usos e índice multigrupo compiten transaccionalmente. Auth del alumno se comprueba antes de aprobar; su revocación académica se comprueba de nuevo en transacción. Auth y Firestore no forman una transacción distribuida.

Se conservan metadata/grants v1 sin añadir campos. Nuevos documentos v2: `administration/{uid}` de curso/grupo, `academicSettings/current` y `academicMemberships/{uid}` de curso; `settings/current`, `membershipDetails/{uid}`, `invitations`, `membershipRequests`, `roster` y `membershipEvents` por grupo; `users/{uid}/enrollments` y `teachingScopes`; recibos globales `academicOperations/{hash(uid:clave)}` y `academicAudit/{commandId}`. El índice por alumno permite política de múltiples grupos por periodo; detalles conservan la última invitación y fecha de baja para impedir readmisión por enlace antiguo.

El repositorio construye paths permitidos, sin deletes. `users/{uid}/sync/current`, epochs y activityAttempts quedan fuera de la allowlist académica. Baja conserva Auth, progreso y otras matrículas; transferencia añade historia en ambos scopes sin mover eventos originales. Afiliación de curso revocada no se repara desde un grupo. Archivado deniega lecturas incluso históricas; su acceso y retención requieren política posterior. Auditoría append-only por aplicación, no inmutabilidad frente a operador privilegiado. Recibos ligados a actor/operación/payload no almacenan secretos ni recuperan tokens de invitación.

## Verificación reproducible

Con puertos libres:

```sh
npm run typecheck:academic
npm run build
npm run test:academic
npm audit
```

Con los emuladores del propietario ya activos, ejecutar la suite directamente, sin vaciar datos:

```sh
NODE_ENV=development ACADEMIC_ADMIN_MODE=emulator ACADEMIC_ADMIN_HOST=127.0.0.1 \
ACADEMIC_ADMIN_PROJECT=demo-optilab-sync FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GCLOUD_PROJECT=demo-optilab-sync \
GOOGLE_CLOUD_PROJECT=demo-optilab-sync ACADEMIC_BOOTSTRAP=synthetic-v1 \
ACADEMIC_RATE_LIMIT=10000 npm run test:academic:api
```

Fixtures únicos por prueba, sin `clearFirestore` ni borrado de cuentas. El test intercepta sockets durante inicialización SDK/Auth/API/gRPC y exige cero intentos no-loopback. La CLI se prueba como proceso aparte contra la API real. El control de mutación confirma que quitar deliberadamente la política del servicio rompe el mismo negativo HTTP; el deny de Rules no oculta un servicio permisivo. CI `academic-ci.yml` corre solo en pull_request, Node22/Java21/emuladores demo; no tiene pasos ni credenciales de despliegue.

Evidencia local del 2026-10-23: 48 pruebas académicas (incluido el rechazo de configuración del child de CI), 95/95 Rules, 30/30 sync core, 5/5 sync UI por navegador Chromium/WebKit, 67 regresiones generales y los cuatro casos públicos opt-in de Memorama; gate de producción 1/1 y guest/config 6/6 por navegador. Typecheck, build y auditorías full/omit-dev pasan, cero vulnerabilidades. Para no ocupar el Vite del propietario en 5195, las pruebas sync locales usaron una configuración temporal con frontend 5215 (el caso Memorama conserva su URL explícita 5195); CI usa la configuración canónica aislada.

La ejecución Auth local tuvo 8/9 en Chromium: el caso de códigos de verificación consulta `demo-optilab-auth`, pero el emulador ya activo está arrancado para `demo-optilab-sync`. No se reinició ni vació ese proyecto. El resultado completo de Auth Chromium/WebKit se debe comprobar en los jobs existentes de la PR con su proyecto aislado correcto; no tratar 8/9 como suite verde.

El primer CI confirmó Auth completo en ambos navegadores, Rules y sync. Detectó que `firebase emulators:exec` inyecta `FIREBASE_CONFIG`; el backend lo rechazó antes de SDK. El launcher padre sigue rechazando cualquier configuración heredada. Solo `academic-test-child.mjs` valida exactamente los tres valores demo generados por la CLI y ambos hosts, los retira del entorno del proceso de tests y aplica de nuevo las guardas. La API/CLI/seed continúan rechazando `FIREBASE_CONFIG`; no se añade una excepción al backend.

## Presupuesto local y Spark

Muestras sin retry de la suite (2026-10-23). Son intentos de documentos leídos y writes confirmados del SDK local, **no facturación medida en producción**. Incluyen preflight y transacción, auditoría global/eventos/recibos; no incluyen login/verificación Auth, red, CPU, índices ni herramientas/bootstrap. Errores/replays/concurrencia pueden aumentar lecturas/intentonas; writes de intentos abortados no se cuentan como committedWrites.

| Operación | Intentos read | Writes confirmados |
|---|---:|---:|
| Crear invitación | 13 | 4 |
| Reemitir / revocar invitación | 14 / 14 | 5 / 4 |
| Solicitar matrícula | 9 | 5 |
| Aprobar matrícula inicial | 22 | 11 |
| Rechazar solicitud | 20 | 5 |
| Dar baja | 19 | 8 |
| Transferir | 42 | 13 |
| Crear periodo / grupo | 8 / 9 | 3 / 8 |
| Roster con n integrantes activos (detalle CAS y perfil académico) | 6 + 6n | 0 |
| Lista de invitaciones/eventos con n filas | 6 + max(n,1) | 0 |
| Estado de solicitud propia (incluye estado de invitación) | 7 | 0 |

70 admisiones iniciales ≈2170 reads +1120 writes (solicitud+aprobación), más invitaciones y perfil. 70 bajas ≈1330 reads/560 writes; 70 transferencias ≈2940 reads/910 writes. Con detalle CAS y perfil mínimo, revisar70 activos en dos grupos de35 dos veces/día (páginas20, ocho páginas totales) ≈888 intentos read/día. Reservar margen para retries/rechazos y sumar presupuesto de progreso #4 (~18500–22500 reads/día normal), compartiendo cuota.

Referencia Spark Firestore: 50000 reads/día, 20000 writes/día, 20000 deletes/día, 1 GiB almacenado y 10 GiB salientes/mes. No son cuotas separadas por grupo ni garantías antiabuso. Estimación inicial de metadata 1–5 MiB/semestre requiere revisar crecimiento de recibos/eventos/índices y retención; no se activan TTL ni deletes automáticos. API no consulta status+fecha: usa ID y filtro status opcional. No necesita un índice compuesto nuevo para estas consultas; el emulador no valida requisitos de índices productivos. Revisar índices/exenciones y coste antes de una aprobación de producción.

Hosting/TLS/CPU/disponibilidad de un servidor externo tienen presupuesto separado, sin cotización aprobada. Pasar tests locales no valida IAM/WIF, tokens firmados reales, seguridad TLS ni cuotas facturadas. Continúan abiertas las puertas productivas de #3/#4 y el alcance restante de #5 (UI, operación, políticas reales y lanzamiento).
