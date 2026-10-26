# Bienvenida de jugadores e inscripción automática · PR #18 revisada

Solo `demo-optilab-sync`, Auth/Firestore Emulator y API local. Se actualiza **la misma PR #18**, sin merge/despliegue. La [enmienda A de ADR-003](architecture/ADR-003-academic-administration.md) sustituye la aprobación individual como política normal del prototipo. Las pruebas manuales de la versión anterior no aprueban esta revisión; QA nuevo pendiente del propietario.

## Arranque en la Mac existente

Desde `feat/student-enrollment-emulator`, Node22 y Java21:

```sh
git fetch origin
git switch feat/student-enrollment-emulator
git pull --ff-only
npm ci
```

Conservar Auth9099 y Firestore8085 activos para demo-optilab-sync. No reiniciarlos, no `clearFirestore`, no borrar fixtures. El propietario reinicia **solo su API anterior** (Ctrl+C en su terminal) desde esta rama:

```sh
npm run academic:dev
```

Si Vite docente5195 ya está activo con `dev:academic-ui`, puede recargar los archivos de esta rama. Si no:

```sh
npm run dev:academic-ui
```

Puertos ocupados se informan, nunca se matan procesos. El gate exige DEV, loopback, proyecto demo exacto, Auth9099, Firestore8085 y flag académico emulator. No editar ni mezclar `.env.local` o variables productivas.

Si hacen falta otras cuentas ficticias, seed explícito opcional (crea otro conjunto, no borra nada):

```sh
read -s "ACADEMIC_FIXTURE_PASSWORD?Contraseña sintética (12–100 caracteres): "
export ACADEMIC_FIXTURE_PASSWORD
ACADEMIC_BOOTSTRAP=synthetic-v1 npm run academic:seed:panel
unset ACADEMIC_FIXTURE_PASSWORD
```

El seed nuevo prepara un activo en A por canje directo y **cero solicitudes pendientes**. Fixtures anteriores del propietario pueden conservar solicitudes históricas: no se borran. Usar B para distinguir claramente las nuevas altas.

## Prueba manual recomendada

1. Profesora: `http://127.0.0.1:5195/optilab/#/cuenta`, entrar como **teacherBoth**, Docente → grupo B → Invitaciones. Ver «Invita a tus alumnos», duración y **Crear enlace de invitación**. Confirmar y **Copiar enlace**. No aparecen tokens, UUID, JSON, límites de pendientes ni cupos de admisión.
2. Alumno: abrir el enlace en otra sesión de navegador de la misma Mac. Entrar como studentB o crear cuenta (correo o Google emulado). El enlace no activa nada por sí mismo; sus parámetros se retiran del fragmento y se conservan solo en memoria durante Auth.
3. Bienvenida: nombre académico → gamertag/disponibilidad → uno de los seis entrenadores reales → una de las cinco familias de OptiCriaturas → confirmar. Los personajes usan los assets actuales y las evoluciones existentes.
4. Cuenta con correo verificado: matrícula activa automáticamente; **sin solicitud pendiente y sin aprobación individual**. Actualizar roster docente y comprobar al alumno. Cuenta sin correo verificado: puede guardar su identidad/personalizar, pero el servidor rechaza el alta hasta verificar. Usar Cuenta y «Ya verifiqué mi correo · reintentar inscripción».
5. Reutilizar enlace con studentC: ambos pueden entrar. Revocarlo e intentar con otro usuario: falla. **Generar nuevo enlace** explica que el anterior deja de funcionar. La rotación no expulsa a inscritos existentes.
6. Dar baja a un alumno e intentar el enlace anterior: no readmite ni por replay. Solo una rotación posterior a la baja habilita nueva inscripción, si las demás políticas lo permiten.
7. Probar un gamertag ocupado con otras mayúsculas; editar desde Mi aventura → «Cambiar gamertag y equipo». El anterior se libera atómicamente, sin borrar prácticas ni evoluciones. Nombre completo repetido sí está permitido.
8. Comprobar que un alumno no ve Docente ni «Abrir panel de la profesora» en Cuenta; teacherA ve A, teacherB B y teacherBoth ambos. Acceso directo indebido también se rechaza. Logout/A→B limpia permisos e identidad cacheados y cancela respuestas anteriores.
9. Compartir u ocultar juego: opt-in al confirmar; después «Ocultar mi identidad de juego a la profesora» no borra el gamertag reservado ni la matrícula. Refrescar roster para comprobar la proyección.

URLs locales: alumno `http://127.0.0.1:5195/optilab/#/bienvenida` (también `#/unirse` al recibir enlace); profesora `http://127.0.0.1:5195/optilab/#/docente`. El enlace no es público ni funciona en otros dispositivos apuntando a127.0.0.1. GitHub Pages bloquea estas rutas, chunks y peticiones; no se desplegó el backend.

## Contrato y datos nuevos

| Operación enumerada | Autoridad / propósito |
|---|---|
| `groupEnrollmentLink` | staff curso/grupo + manageInvitations; devuelve estado/revisión/vencimiento, nunca secreto/locator/hash |
| `rotateEnrollmentLink` | mismos permisos + expectedVersion/idempotencyKey/TTL; reemplaza atómicamente el único enlace; devuelve secreto una vez |
| `revokeEnrollmentLink` | mismos permisos + CAS; bloquea canjes nuevos, no borra miembros |
| `redeemInvitation` | UID de token, Auth actual habilitado/email verificado, enlace válido, contexto activo, identidad completa y pertenencia coherente; alta directa transaccional |
| `getPlayerIdentity` | propia; identidad privada con gamertag/equipo/revisión, comprobando integridad de su reserva |
| `gamertagAvailability` | autenticada, solo booleano; orientativa, no revela dueño ni reserva |
| `savePlayerIdentity` | propio UID, expectedVersion/expectedProfileVersion, gamertag/nombre/equipo/consentimiento; reserva y perfil atómicos |

Paths nuevos v2: `groups/{g}/enrollmentLink/current` bajo el curso/periodo; `playerIdentities/{uid}` y `gamertagReservations/{sha256(normalized)}`. Sin campos añadidos a documentos v1. Se reutiliza `admissionWrites` para grants/detalle/index/pointer/roster y el sistema de auditoría/recibos. Sin escrituras administrativas de Firestore desde React. El repositorio sigue excluyendo progreso/epochs.

El enlace usa token CSPRNG32 bytes/256bits + SHA256; un pointer único sustituye cualquier enlace directo anterior del grupo. No se guarda texto recuperable. El enlace perdido se regenera/rota, nunca se muestra desde un hash/recibo. Caducado/revocado/rotado/incorrecto produce indisponibilidad genérica. Los enlaces de la versión previa, que generaban solicitudes, no sirven para el canje directo; generar uno nuevo desde la interfaz. APIs heredadas y registros previos se conservan para compatibilidad, no como flujo normal.

El canje verifica de nuevo dentro de la transacción, incluidos replays. Un estudiante ya activo no duplica grants ni consumo. Una baja impide usar un enlace creado antes de su última revocación. La política multigrupo de curso y una suspensión de afiliación siguen prevaleciendo. Una rotación concurrente/revocación compite sobre el mismo documento; no hay check-then-write no transaccional.

### Capacidad transferible y uso justo

**Cambio de riesgo:** ya no hay filtro humano por alumno. Quien reciba por reenvío un enlace vigente y tenga cuenta/correo verificado/onboarding podrá inscribirse. No se implementa allowlist institucional ni acceso por correo conocido. Compartir solo con el grupo, caducar y revocar/rotar ante filtraciones. El enlace nunca concede staff o permisos docentes.

No maxUses/cupo70 ni límite total de estudiantes en el enlace nuevo. `acceptedCount` es telemetría interna, no un límite. Existe una ventana transaccional de **30 nuevas altas/10 segundos**, que se repone; y el limiter HTTP IP/UID configurable ya existente (default60/minuto, memoria acotada). Reintentos del mismo miembro no consumen otra alta. Son controles temporales técnicos, no cupos académicos; pueden devolver429 y deben reintentarse después. Verificado/onboarding, límites de entrada, tokens de alta entropía y transacciones complementan esos controles. No se afirma defensa distribuida/productiva completa ni costo garantizado.

### Gamertag global e identidad

- Normalización definida: **Unicode NFKC → trim → minúsculas ECMAScript independientes de locale**. Se permite el resultado ASCII A–Z/a–z/0–9/underscore,3–20 caracteres (entrada cruda≤80). Compatibilidad fullwidth/NFKC y mayúsculas colisionan; acentos/otros alfabetos no se admiten en gamertag por esta política de namespace. El nombre académico conserva Unicode y puede repetirse.
- Una reserva normalizada pertenece a un único UID; se leen identidad, reserva nueva/previa y perfil antes de todos los writes. Cambiar gamertag libera el anterior como tombstone `released` y asigna el nuevo en la **misma transacción**. No borrar índices desde el navegador, no reserva por consulta de disponibilidad, no UID libre. Una carrera devuelve409 sin sobrescribir la identidad previa.
- Disponibilidad es orientativa. Los reintentos conservan idempotencyKey/payload; doble clic no duplica. Reserva válida y coherente se comprueba también antes de canjear.
- **Borrado de cuenta:** no se agrega endpoint de borrar Auth ni liberación por UID suministrado. La política conservadora es retener la reserva al borrar/deshabilitar una cuenta, evitando suplantación y reutilización accidental. Antes de habilitar liberación por eliminación se requiere operación confiable que compruebe ausencia definitiva en Auth, revisión/propiedad del índice, plazo de retención aprobado y auditoría; nunca liberar solo porque una consulta falló. Cambio voluntario de gamertag sí libera el anterior ya implementado. No hay limpieza automática de fixtures/cuentas en esta entrega.
- Usuarios anteriores sin identidad reservada hacen una única migración guiada, prellenando nombre y opciones propias disponibles; deben confirmar la reserva. Usuarios completados no repiten el wizard al abrir otra invitación. La identidad de cuenta se restaura en cosméticos faltantes de la aventura UID-bound; nunca resetea resultados, rutas, epoch ni evidencia evolutiva. Al confirmar un cambio explícito, solo actualiza nickname/avatar/compañero por el motor existente. La persistencia global no usa localStorage ni el progreso como índice.
- Correo/estado de verificación provienen de Auth actual del servidor, no del payload. Se puede completar onboarding sin correo verificado, pero no recibir una nueva matrícula directa. Nombre/juego son declarados. El consentimiento sigue optativo/revocable; perfiles antiguos tolerados. La API heredada de perfil no puede falsificar un gamertag reservado: proyecta la identidad canónica si ya existe. No hay rankings públicos ni acceso docente a progreso privado.

## Seguridad de navegador y pruebas

Se conserva HashRouter `/optilab/#/unirse?...` con token en fragmento, limpieza antes del router/Auth, validación y memoria fuera del subtree UID durante login; sesiones/reaperturas se aíslan por generación. No tokens en logs/storage/FireStore/progreso/historial ni URLs HTTP. Tras confirmar, se descarta el secreto; para recuperar un enlace perdido, la profesora lo rota. La disponibilidad/identidad/acceso docente consultan el backend con el ID token existente y AbortControllers. `myScopes` real confirma accesos; no emails/roles cliente/nombres hardcodeados. Ocultos hasta comprobar y limpios en logout/A→B, con revalidación al volver al foco.

Wrappers y entorno: los de [ACADEMIC-ADMIN.md](ACADEMIC-ADMIN.md). Con procesos propios libres: `npm run test:academic`, `npm run test:teacher`, `TEACHER_BROWSER=webkit npm run test:teacher`, gates de producción. Con procesos del propietario ya activos, usar entorno explícito + `TEACHER_REUSE_VITE=1 npm run test:teacher:ui`; solo opt-in local, nunca CI. El transporte de tests usa HTTP real a backend loopback efímero, conservando Auth/Firestore/autoridad; no toma5200 ni borra fixtures.

Cobertura backend:68 casos, incluyendo60 anteriores conservados y8 nuevos de alta directa/reservas/race/liberación/verificación/rotación/ventana técnica. UI:44 por navegador (18 de jugadores y26 del panel/históricos adaptados al nuevo producto), Google/correo, estudiantes/docentes, matrícula sin aprobación, baja, caducidad/revocación, reaperturas, cambios, reserva orientativa/real, privacidad y390/820/1180/1440/teclado/Axe. CI revalida Auth/Rules/sync y35 regresiones existentes de aventura/entrenadores/evoluciones. QA manual nuevo no aprobado; resultados finales del HEAD se registran en PR #18.

## Siguiente PR (solo alcance, no implementada)

Continuar en #5, sin duplicar #9/#12: «Mis grupos» en vez de «Periodos y grupos»; IDs técnicos fuera de vistas principales; explicar semestre/oferta y mostrar tarjetas amigables; acción por alumno «Mover de grupo» con modal «¿A qué grupo quieres mover a este alumno?», destinos como tarjetas/botones y confirmación dentro; preservar origen+destino autorizados, transacción y CAS; nombres/correos/gamertags claros; retirar solicitudes históricas de la experiencia normal y conservar reutilización de periodos entre generaciones. No se inicia otra PR ahora.

#5 sigue abierto por QA/políticas reales/retención/hosting/seguridad. Puertas #3/#4 pendientes. No merge, backend/Pages/Rules/índices desplegados, IAM/Auth/datos reales, billing/Blaze/Functions/Vercel, adjuntos, editor, estadísticas o Liga.
