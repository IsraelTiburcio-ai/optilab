# ADR-003 · Administración académica y raíz de confianza

**Estado: PROPUESTO, pendiente de aprobación del propietario. Solo diseño, no implementación.**
Fecha de análisis: 2026-10-23. Baseline: PR #14 fusionada en `7ab4e83a89510df6a8fc592904abc80a26714264`. Relacionado: [#5](https://github.com/IsraelTiburcio-ai/optilab/issues/5), [ADR-001](ADR-001-firestore-security.md), [ADR-002](ADR-002-progress-sync.md), [plan de entrega](../GROUPS-IMPLEMENTATION-PLAN.md).

## 1. Problema y límites

Una profesora necesita gestionar dos grupos y aproximadamente 60–70 alumnos por semestre, sin depender de editar código ni del desarrollador para cada clase. Se requiere continuidad entre periodos, varias membresías por alumno y autorización real por curso/grupo.

Actualmente los grants v1 de curso y grupo permiten lecturas acotadas; **todas las escrituras administrativas del navegador están denegadas**. `users/{uid}/sync/current` y sus epochs son progreso personal, no matrículas. Un enlace, un campo role o una pantalla oculta no conceden permisos.

No se modifican Rules, índices, Auth, IAM, billing, servicios, documentos reales o frontend en este ADR. No se despliegan Functions/Blaze ni se contrata hosting. Los nombres/IDs/calendario de los grupos reales siguen pendientes de la profesora.

## 2. Opciones investigadas

| Opción | Ventajas | Límites/seguridad | Costos y adecuación |
|---|---|---|---|
| A. Provisionamiento manual seguro | Bootstrap pequeño, revisión humana y sin servidor nuevo | Operador usa IAM fuera del navegador, manifiesto validado y auditoría. Console/Admin omiten Rules; errores del operador no los bloquean las reglas cliente | Operaciones Firestore y tiempo humano. Viable para bootstrap; no satisface autonomía cotidiana |
| B. Operador administrativo controlado | CLI/herramienta privada con dry-run, comandos enumerados, idempotencia y revisión de solicitudes | El operador es una raíz de confianza distinta del docente. No distribuirle credenciales IAM amplias a cada profesora; no pasar tokens, roster o secretos por issues/workflow inputs públicos | Menor infraestructura si se ejecuta bajo demanda en un equipo aprobado; necesita disponibilidad humana. Un procesador permanente ya es un backend y requiere aprobación |
| C. Backend mínimo confiable | Panel docente autónomo; validación central de identidad, ámbito, invitaciones, concurrencia y auditoría | Verifica ID token, vuelve a leer grants/capacidades y ejecuta transacciones. Debe validar todo porque Admin SDK **no pasa por Security Rules** | Firestore sigue consumiendo su cuota; CPU, TLS, disponibilidad, mantenimiento y alojamiento son costos separados. Servidor institucional existente es candidato, no disponibilidad/gratuidad confirmada |
| D. Firebase Functions / Cloud Run administrados | Integración y operación gestionadas | No autorizados. Functions desplegadas requieren Blaze; una cuota sin cargo no elimina requisitos de billing ni riesgo de sobreuso | Fuera de esta decisión bajo restricciones actuales; no habilitar para simplificar el código |
| E. Resolverlo solo abriendo Rules al cliente | Evita servidor para algunas operaciones muy acotadas | No resuelve por sí solo secretos de invitación, rate limiting, auditoría confiable y flujos complejos. Aumenta superficie y presupuesto de accesos Rules; no es la opción de este ADR | No se propondrá `allow write` administrativo como atajo para evitar un backend |

**Recomendación condicionada:** A para bootstrap autorizado; C para autonomía real, reutilizando un dominio/servidor institucional solo si existe y se aprueba. B es alternativa transitoria segura, explícitamente limitada; no venderla como panel autónomo. Si no se aprueba un lugar confiable donde ejecutar C, esa autonomía permanece bloqueada: no se compensa con privilegios cliente.

La siguiente aprobación puede limitarse al **prototipo local de C con emuladores**, dejando proveedor/hosting de producción sin decidir. Este ADR no constituye esa aprobación ni inicia el prototipo.

## 3. Frontera de autorización

```text
Navegador docente/alumno
  Firebase Auth ID token + comando acotado + idempotencyKey
       ↓ HTTPS (loopback únicamente en prototipo)
Servicio de comandos confiable
  verifica token/UID → valida esquema → lee grants y capacidades actuales
  → transacción + evento/auditoría/recibo → proyecciones sanitizadas
       ↓ credencial servidor IAM mínima, nunca en VITE/Pages
Firestore
```

- Actor = UID del token verificado con issuer/audience del proyecto esperado; ignorar role, actorUid, isAdmin y membresías enviados por cliente. Tokens anónimos no administran grupos.
- Docente requiere curso activo, grant staff de curso y **grupo exacto**, además de capacidad delegada para la operación. Curso staff no equivale a administrar todos sus grupos.
- Operador es una identidad IAM/proceso controlado por el propietario, no `users/{uid}.role=admin`. Solo operador asigna/revoca docentes y capacidades iniciales. No hay rol administrativo autoasignable desde UI.
- Admin SDK/REST con credencial de servicio usa IAM y omite Rules. **Deny-all productivo no protege contra un proceso Admin apuntado por error a producción**: los guards de proyecto/host/modo deben ejecutarse antes de inicializarlo. IAM no se presenta como aislamiento por path de alumno/grupo: el servicio aplica esa política en cada comando y lectura, incluyendo replays.
- Diseñar rol IAM mínimo para las lecturas/transacciones/create/update necesarios; sin permisos para desplegar Rules/índices, cambiar Auth/billing ni borrar históricos. El rol concreto/credenciales deben revisarse y probarse antes de producción, no se crean hoy. Evitar llaves descargables; ADC/WIF es candidato según host aprobado. Nunca PAT, service account o secreto privilegiado en frontend.
- Verificar revocación de tokens/usuario deshabilitado puede requerir lectura Auth adicional: decidir y autorizar permisos de lectura, sin conceder modificación de Auth. Las revocaciones académicas se comprueban de todas formas leyendo grants actuales, no esperando a renovar claims.
- CORS/origen no es autorización. HTTPS, Authorization Bearer, límites de tamaño/frecuencia, rechazo de campos desconocidos, paths construidos por servidor y respuestas sin enumeración. No aceptar rutas Firestore o métodos arbitrarios como entrada.
- Un callback o pantalla de una cuenta previa no puede ejecutar comandos para otra: aplicar la generación de sesión de ADR-002, limpiar vistas y validar el UID también en servidor.

## 4. Modelo propuesto y compatibilidad

Conservar identidad y paths de ADR-001. **No añadir campos a documentos v1 de keys exactas sin migración explícita.** Preferir grants mínimos v1 como autoridad de pertenencia, capacidades confiables adicionales para comandos y documentos operativos v2 separados, escritos conjuntamente por el servicio:

```text
courses/{c}                                  metadata v1
  staff/{teacherUid}                         grant v1, solo operador/servicio
  members/{uid}                              afiliación de curso v1
  administration/{teacherUid}                PROPUESTO: capacidades de curso v2
  terms/{t}
    groups/{g}                               metadata v1
      staff/{teacherUid}                     asignación concreta v1
      administration/{teacherUid}            PROPUESTO: capacidades de grupo v2
      settings/current                       PROPUESTO: revisión CAS de configuración
      members/{uid}                          grant mínimo v1: active/revoked
      membershipDetails/{uid}                PROPUESTO: versión, admissionId/eventRef, timestamps
      invitations/{inviteId}                 PROPUESTO: hash secreto y límites, nunca token raw
      membershipRequests/{requestId}         PROPUESTO: solicitud ligada al UID verificado
      roster/{uid}                           PROPUESTO: proyección docente privada y mínima
      membershipEvents/{eventId}             PROPUESTO: transiciones históricas/contexto original
      academicOperations/{commandId}         PROPUESTO: idempotencia y resultado mínimo
users/{uid}/enrollments/{pointerId}            descubrimiento privado, NO autoridad
users/{uid}/sync/current + epochs/...         PROGRESO PERSONAL: no lo escribe el servicio académico
```

Capacidades propuestas: curso `createTerms/createGroups`, grupo `manageInvitations/manageMembers/readHistory`. Inicialmente todas denegadas hasta delegación confiable. Crear un grupo dentro de un curso requiere delegación de curso; el servicio puede asignar al creador solo el conjunto predeterminado aprobado para ese nuevo grupo. No permite asignar otros docentes ni apropiarse de grupos existentes. Crear cursos o delegar staff continúa como operación de operador.

`membershipDetails` no duplica el status autoritativo: guarda versión/eventos; el permiso lo decide `members/{uid}`. Roster/status son proyecciones, no fuente de privilegios. Cada transición actualiza grant, detalle, pointer, solicitud/invitación aplicables, evento y recibo en una transacción. Las lecturas sensibles de roster se proponen por API validada, paginada y dentro del grupo, sin abrir listas globales de users/Auth.

El roster no usa nickname como identidad oficial. Etiquetar nombre elegido frente a identidad académica verificada; decidir qué datos personales son necesarios. No copiar correos a rankings ni mostrar el roster completo a compañeros. Los pointers solo contienen referencia/contexto, no títulos privados como sustituto de una comprobación de acceso.

## 5. Matriz de permisos propuesta

| Acción | Alumno | Docente asignado | Docente ajeno/anónimo | Operador confiable |
|---|---|---|---|---|
| Leer progreso personal | Propio, según ADR-002 | Solo propio; no todo users del alumno | Denegado a datos ajenos | Sin tarea rutinaria de leer/escribir progreso |
| Ver matrícula/solicitud | Propia, respuesta mínima | Roster/solicitudes del ámbito autorizado | Denegado | Ámbitos aprobados, auditado |
| Crear invitación / aprobar / baja | Solicitar incorporación, sin grant | Comando autorizado y capacidad activa | Denegado | Comando autorizado |
| Transferir | No autotransferencia | Debe administrar origen **y destino** | Denegado | Excepción solo aprobada/auditada |
| Crear periodo/grupo | Denegado | Solo delegación de curso explícita | Denegado | Bootstrap/operación aprobada |
| Asignar staff/capacidades | Denegado | Denegado | Denegado | Exclusivo, no rol cliente |
| Leer historia académica | Propia solo por política aprobada | Grupo/periodo histórico autorizado + readHistory | Denegado | Auditoría/finalidad aprobada |
| Escribir directamente grants/invitaciones | Denegado | Denegado | Denegado | Fuera del navegador, con IAM y validadores |
| Borrar cuenta Auth/progreso/historial | Denegado en #5 | Denegado | Denegado | No es comando de #5 |

Las filas de API son diseño, no rutas habilitadas. Las reglas actuales también rechazan listados de members/leaderboard y scopes archivados; no declarar cubiertas esas lecturas nuevas hasta extender reglas/contratos y pruebas con aprobación.

## 6. Invitaciones y concurrencia

1. Docente autorizado pide crear/reemitir. Servidor fija ámbito y genera token CSPRNG de 32 bytes (256 bits), locator aleatorio independiente y hash SHA-256; token raw se devuelve una sola vez. Reemitir revoca el anterior. No almacenar token en Firestore, logs, telemetría, URLs de backend ni recibos. Si se pierde el ACK de creación, retry devuelve metadata/estado, no un secreto recuperado del hash; la UI ofrece reemitir mediante un comando nuevo y revocar el anterior.
2. Enlace/código de copia/pega de alta entropía. No código corto enumerable. Transportar secreto en fragmento, limpiarlo al consumir y guardarlo solo en memoria durante Auth; estudiar contenedor fuera del subtree keyed por UID de ADR-002 para no perderlo al entrar. Nunca guardarlo en optilab-v1, backups de progreso o postMessage a actividades.
3. Expiración obligatoria según reloj servidor, maxUses acotado y status active/revoked. Duración/rangos son política pendiente, sin fechas o códigos académicos reales inventados.
4. Modo inicial recomendado: **solicitud + aprobación docente**. Conocer un enlace no crea membresía. Alta directa futura solo para invitación ligada a UID confiable y tras aprobación de esa política; no basta email o UID declarados en payload.
5. Alumno autentica y confirma cuenta/ámbito. API verifica secreto y crea solicitud única por UID/invitación; errores inválido/vencido/revocado genéricos, con rate limiting por UID/IP/invitación y límite de pendientes. Un contador pendingCount/maxPending de invitación se actualiza transaccionalmente al crear/resolver solicitudes; no se cuenta una query vacía como protección contra carreras. Rate limiting debe actuar antes de lecturas costosas; si hay varias instancias, necesita coordinación aprobada. No hay consultas públicas para buscar grupos o invitaciones.
6. Aprobar vuelve a leer staff/capacidades, contexto, invitación, solicitud y membresía en transacción. UID destino proviene de la solicitud vinculada al token Auth, no un uid libre del cliente. Solicitud e invitación deben seguir vigentes al aprobar. Si la afiliación de curso está revocada por el operador, el docente de un grupo no puede reactivarla: se rechaza/escalará para revisión del operador.
7. Consumo se cuenta por aceptación única, no cada retry. Receipt/request fingerprint hace el comando idempotente; dos approvals/canjes simultáneos no exceden maxUses. Cambiar payload con la misma clave se rechaza. Revocar invitación compite con aprobación sobre el mismo documento; si revocación gana, no se admite.
8. Reintentos se autorizan **de nuevo**; un recibo no es un permiso ni reactiva una membresía revocada. Estudiante ya activo no consume otro uso. Baja no devuelve usos automáticamente. Readmisión requiere nueva aprobación; un enlace viejo no revierte una baja.

Un token compartido filtrado permite solicitudes abusivas: aprobación evita grants arbitrarios, pero sigue haciendo falta límite de peticiones y moderación. Rules no es rate limiter y App Check no reemplaza autorización; su eventual incorporación y costo se decide aparte.

## 7. Bajas, transferencias e historia

Baja cambia solo grant del grupo a revoked, incrementa versión y registra evento. No elimina Auth ni toca progreso/epochs. No revoca afiliación de curso unilateralmente porque puede haber otras membresías. Mantener el grant de curso puede permitir leer metadata mínima del curso; no concede privados de grupos sin su grant activo. Suspensión de curso completa es operación de operador y bloquea sus grupos incluso si quedan grants de grupo activos.

Transferencia normal se propone dentro del mismo curso y periodo, con autoridad de ambos grupos: revocar origen, activar destino, actualizar pointers y escribir eventos/recibo atómicamente. No reescribir courseId/termId/groupId de intentos previos. Nuevo semestre es nueva matrícula/oferta, no mover la historia al periodo nuevo. Un alumno puede pertenecer a varios grupos cuando la política lo permite.

Conservar datos no concede lectura perpetua: grupos archivados siguen privados. Proponer endpoint histórico separado con staff actual del scope y capacidad readHistory; revocar staff retira próximas lecturas, también de históricos. La política de historial propio del alumno tras la baja necesita decisión explícita; nunca conservar acceso al ranking/roster de compañeros por haber pertenecido antes. Lo descargado no puede revocarse retroactivamente; vistas docentes en memoria y limpieza al salir/cambiar UID/ámbito.

## 8. Auditoría y decisiones pendientes

Eventos con actor verificado, operación, scope original, versión anterior/nueva, timestamp servidor, resultado y commandId; datos mínimos, sin tokens. Append-only por aplicación y sin escrituras cliente. No afirmar inmutabilidad frente a una identidad IAM privilegiada que puede omitir Rules; una garantía externa de auditoría requiere diseño/costo aprobado.

Se necesita decidir: mecanismo y responsable, host/TLS/disponibilidad y presupuesto, identidad IAM/secretos, delegación docente exacta, inscripción/aprobación/readmisión, caducidad/uso de invitaciones, datos de roster, acceso histórico tras baja, retención y límite de abuso. No se han implementado ni probado estos componentes de #5.

## 9. Fuentes oficiales consultadas

- [Firestore IAM](https://firebase.google.com/docs/firestore/security/iam): SDK servidor usa IAM; permisos mínimos deben validarse en su entorno real.
- [Firestore REST](https://firebase.google.com/docs/firestore/use-rest-api): Firebase ID token aplica Rules; credencial de servicio OAuth usa IAM y puede omitir Rules.
- [Functions: primeros pasos](https://firebase.google.com/docs/functions/get-started): se puede emular sin Blaze, pero desplegar Functions requiere Blaze. No se propone habilitarlo.
- [Cuotas Firestore](https://firebase.google.com/docs/firestore/quotas) y [pricing](https://firebase.google.com/docs/firestore/pricing): cuota gratuita no cubre automáticamente alojamiento/CPU de un backend externo.

Consulta documental, no prueba de IAM, costos reales ni provisión de infraestructura. Revalidar condiciones cuando el propietario apruebe una implementación/ventana real.
