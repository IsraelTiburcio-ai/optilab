# Inscripción y perfil académico mínimo · solo emuladores (#5)

Base: `f5b660f61ae5805d2445ad61a4c2faae7245ab5b` (PR #17). Esta entrega agrega inscripción visual y una proyección académica mínima; no autoriza merge ni producción. Reutiliza [ADR-003](architecture/ADR-003-academic-administration.md), [API](ACADEMIC-ADMIN.md) y [panel docente](TEACHER-PANEL.md).

## Probar en Mac con los procesos existentes

Node22 y Java21. En la rama `feat/student-enrollment-emulator`:

```sh
npm ci
```

Conservar Auth9099 y Firestore8085 ya activos para `demo-optilab-sync`, sin reiniciarlos ni vaciarlos. Si todavía no existen, usar `npm run emulators:sync` con Java21. No usar el proyecto real `optilab-cd829`.

El API5200 necesita **esta rama**: el propietario debe cerrar únicamente su API anterior con Ctrl+C en su terminal y ejecutar:

```sh
npm run academic:dev
```

En otra terminal, frontend5195:

```sh
npm run dev:academic-ui
```

Si ya hay Vite docente activo en5195, puede servir los archivos de esta rama mediante su recarga local; no se detiene automáticamente. Si no está en modo académico emulado, el launcher informa la colisión y el propietario decide qué proceso local cerrar. Nunca matar/vaciar emuladores automáticamente. El cliente muestra error recuperable si el API anterior no conoce el nuevo contrato.

Se pueden reutilizar los correos/contraseña sintéticos del propietario. Para otro conjunto nuevo, preparación explícita opcional, sin borrar fixtures anteriores:

```sh
read -s "ACADEMIC_FIXTURE_PASSWORD?Contraseña sintética (12–100 caracteres): "
export ACADEMIC_FIXTURE_PASSWORD
ACADEMIC_BOOTSTRAP=synthetic-v1 npm run academic:seed:panel
unset ACADEMIC_FIXTURE_PASSWORD
```

### Recorrido visual completo

1. En una ventana, abrir `http://127.0.0.1:5195/optilab/#/cuenta` y entrar con el correo sintético de **teacherBoth**. Abrir Docente y seleccionar **B** (el seed anterior tiene solicitudes de demostración en A).
2. Invitaciones → elegir duración en horas/días y límites → Generar → Confirmar → **Copiar enlace de invitación**. El enlace solo se puede copiar de la primera respuesta o de una reemisión; no se recupera el secreto desde Firestore/listas/recibos.
3. Abrirlo en **otra sesión de navegador** en la misma Mac (ventana privada u otro perfil), para no reemplazar la sesión docente. El enlace es local: en otro dispositivo127.0.0.1 apuntaría a ese otro dispositivo. GitHub Pages sigue bloqueando la funcionalidad.
4. Entrar como alumno sintético (por ejemplo studentB), o registrarse con un correo sintético. La invitación sobrevive a la navegación a Cuenta, sin quedar en la URL. La verificación de correo usa el flujo Auth existente; no concede por sí misma matrícula ni permisos.
5. Volver a **Mi perfil académico e inscripción**, declarar nombre completo y revisar el aviso de nombre/correo. La identidad de juego es optativa: compartir muestra una vista previa de los campos disponibles de la aventura de esa cuenta. Guardar y confirmar.
6. **Solicitar inscripción → Confirmar**. Se muestra pendiente, sin presentarlo como grupo activo.
7. Como teacherBoth, actualizar B → Solicitudes. Revisar nombre declarado, correo de Auth y, si se compartieron, gamertag/entrenador/OptiCriatura. Aprobar desde la interfaz.
8. Como alumno, **Actualizar perfil y estado**: comprobar aprobación, acceso activo y grupo devuelto por `myScopes`.
9. Probar rechazo con otra solicitud, retirar identidad de juego y refrescar el panel docente; comprobar que desaparece la proyección de juego. Cambiar nombre es otra actualización CAS del perfil; no cambia el apodo de la aventura.
10. Recargar la inscripción: informar pérdida de invitación en memoria. Reabrir el enlace original recupera el estado de la solicitud propia, incluso si ya no se puede canjear. Nunca pegar enlaces/códigos/correos/UID/identificadores de fixtures ni capturas con secretos en GitHub.

No se afirma QA manual de esta entrega hasta que el propietario lo confirme.

## Enlace y sesión

Formato: `<origen local>/optilab/#/unirse?courseId=…&termId=…&groupId=…&inviteId=…&token=…`. Los parámetros están **dentro del fragmento**, no en el query HTTP. Se usa `BASE_URL` de Vite para conservar `/optilab/` sin romper HashRouter. No QR ni códigos cortos.

El consumidor se instala antes de renderizar HashRouter/Auth. Valida claves únicas, tamaños y formatos, y hace `history.replaceState` para retirar los parámetros antes de que el router los lea; también en `popstate/hashchange`, enlaces malformados y producción deshabilitada. No se registra el fragmento. El secreto queda solo en memoria del módulo, fuera del subtree por UID, para sobrevivir a login/registro. Se vincula al primer UID autenticado; logout/A→B lo descartan. Cada reapertura tiene una generación independiente para cancelar callbacks anteriores, aunque el enlace sea idéntico.

Tras confirmar o recuperar una solicitud se elimina el token de memoria y se conserva solo su contexto no secreto, ligado a la sesión. Recarga/cierre de pestaña lo pierde; reabrir original permite la consulta privada por locator. No localStorage/sessionStorage, progreso, Firestore, logs, analytics, recibos ni historial académico con el token. La copia al portapapeles es una acción explícita de la profesora; no se imprime el enlace en el panel estudiantil. No se envía en enlaces de verificación de Auth.

Cliente con ID token del SDK existente, comprobaciones de UID/generación antes y después de cada respuesta, AbortControllers y timeout. Intenciones idempotentes mantienen clave/payload ante ACK perdido; no hay éxito optimista. Es posible salir de la cuenta desde la confirmación pendiente: no garantiza cancelar una solicitud ya recibida por el servidor. Se recupera su estado al volver, sin aplicarlo a otra cuenta.

El gate académico completo no cambia: DEV, hostname loopback, proyecto demo exacto, Auth9099/Firestore8085 exactos y `VITE_ACADEMIC_ADMIN=emulator`. Fuera del gate no existen rutas docentes/estudiantiles ni se solicitan sus chunks o API. Authentication productivo no se modifica.

## Perfil y autorización

Documento separado **`academicProfiles/{uid}`, schemaVersion2**: UID, revisión CAS, nombre completo declarado (3–120), correo y `emailVerified` obtenidos por Admin Auth `getUser(uid)`, consentimiento de juego, nickname (≤30)/avatarId/companionId opcionales y timestamp. Sin cambios a documentos v1. El API no lee progreso para construirlo: el alumno ofrece explícitamente solo los tres campos de identidad de su aventura aislada por cuenta, nunca prácticas/resultados/hitos/evoluciones/backups.

El nombre y la identidad de juego son declarados, no verificados. El correo es una **instantánea de Auth al guardar**, no un campo libre ni una garantía perpetua de verificación. Se muestra su fecha y se puede guardar otra vez después de verificar/cambiar correo. Auth y Firestore no forman una transacción distribuida. Los IDs de entrenador/criatura se validan contra el catálogo actual; ausencia no usa personajes predeterminados como datos compartidos.

Consentimiento de juego desmarcado inicialmente; con él, el formulario muestra la copia mínima que se compartirá. Cambiar la aventura no publica actualizaciones automáticamente: hay que actualizar la copia y confirmar. Desmarcar/retirar consentimiento reemplaza todos los campos de juego por null en la misma actualización CAS. Nombre/correo básicos permanecen para identificación académica; eliminación/retención completa sigue pendiente de política. No se guardan snapshots de PII en recibos/eventos, ni se publican nombres/correos en rankings.

Las proyecciones docentes se unen al perfil **actual dentro del mismo snapshot de lectura** después de autorizar staff/capacidad de curso/grupo exactos. Solo integrantes activos con afiliación de curso vigente o solicitudes pendientes canjeables del propio ámbito. Solicitudes rechazadas, vencidas/revocadas/agotadas o anteriores a la última baja no abren acceso fresco al perfil. Tras transferencia, el antiguo grupo no conserva lectura del perfil actualizado por la matrícula revocada. La retirada se refleja en las próximas consultas; no puede retirar lo ya descargado.

Sin perfil en fixtures anteriores, se conserva la etiqueta heredada claramente no verificada y se muestra ausencia del perfil; no se deducen correos ni personajes. UID oculto de la lista principal, disponible en detalles técnicos. La autorización docente existente permanece intacta y nunca abre `users/{uid}/sync/current` ni epochs.

## Contratos ampliados, enumerados y autenticados

| Operación | Entrada | Salida / regla |
|---|---|---|
| `getAcademicProfile` (nueva lectura) | `{}` | `{profile,revision}`, propio UID del token; ausente = null/revisión0 |
| `updateAcademicProfile` (nuevo comando) | idempotencyKey, expectedVersion, fullName, shareGameIdentity, nickname/avatarId/companionId nullable | UID/correo/rol nunca aceptados del payload; CAS e idempotencia; correo desde Auth; recibo solo metadata |
| `requestMembership` | contrato existente | Sin cambios de grants ni alta directa; la UI requiere perfil guardado; clientes/fixtures anteriores pueden seguir solicitando sin él |
| `requestStatus` | scope + **uno** de requestId o inviteId | Consulta privada; con inviteId el servidor resuelve exclusivamente la solicitud del UID autenticado, sin necesitar secreto para recuperar su estado |
| `requestStatus` salida | campos existentes + invitationState | active/expired/revoked/exhausted/unavailable; separar estado de solicitud, membresía y accessAllowed |
| `roster` / `groupRequests` | contratos existentes | Agregan academicProfile nullable con datos mínimos/consentimiento actual; schema/grants v1 sin modificaciones |
| `myScopes` | `kind:student` existente | Paginación de matrículas reales, sin convertir pendientes en activas |

Errores de un canje inicial inválido/vencido/revocado/agotado siguen siendo **el mismo404**, por anti-enumeración de ADR-003. La UI informa indisponibilidad y pide otro enlace, sin fingir conocer la causa. Para una solicitud propia existente sí se devuelve el estado de invitación concreto. Una invitación agotada/revocada después de la aprobación no revoca por sí misma una matrícula activa; una baja o suspensión sí cambia el acceso efectivo.

Perfil propio:1 intento read; actualizar sin retry:2 intentos read/3 writes confirmados + lookup Auth, sin facturación medida. Roster activo con perfil: `6+6n` intentos read/página (incluye consultas de pertenencia/proyección);70 alumnos, dos grupos de35, dos recorridos/día con páginas20 ≈888 intentos read. Requests añaden validación de invitación/readmisión. Se mantienen límites/paginación y cuotas compartidas con #4; sin listeners académicos ni scans de perfiles/Auth.

## Pruebas y límites de entrega

Se reutilizan los wrappers `test:academic`, `test:teacher` y la matriz Chromium/WebKit de PR, sin nuevos servicios. Con emuladores propios libres, comandos del manual docente. Con emuladores/Vite del propietario ya activos, entorno explícito de `ACADEMIC-ADMIN.md`, más `TEACHER_REUSE_VITE=1` (solo opt-in local; CI no reutiliza servidores) y `npm run test:teacher:ui`. No se modifican ni vacían procesos/fixtures del propietario; el backend de tests continúa en loopback efímero con transporte real.

Cobertura de esta entrega:60 pruebas académicas;20 escenarios nuevos de inscripción por navegador más26 del panel previo =46 UI por navegador. Incluye Auth/registro/verificación, estados, carreras, CAS, consentimiento, acceso A/B, personal no autorizado/revocado, ACK perdido, cambio de cuenta, token fuera de red/almacenamiento/DOM, recarga/reapertura, móvil/teclado/Axe. Gate productivo en ambos navegadores. CI reutiliza Auth/Rules/sync y agrega regresión existente de aventura, entrenadores y evoluciones. Resultados finales y cualquier fallo se registran en la PR.

En desarrollo se corrigieron dos fallos reales detectados: la reapertura idéntica necesitaba generación propia para refrescar el estado, y la confirmación pendiente necesitaba una salida de sesión accesible. No se presentan las primeras ejecuciones parciales como verdes.

#5 sigue abierto por QA manual nuevo, políticas definitivas, privacidad/retención, alojamiento y seguridad productiva. Puertas #3/#4 pendientes. No despliegue backend/Pages/Rules/índices, cambios Auth o datos reales, billing/Blaze/Functions/Vercel, juegos externos, adjuntos, editor, analíticas ni Liga.
