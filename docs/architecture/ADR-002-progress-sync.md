# ADR-002 · Sincronización privada v2, consentimiento y generaciones

Estado: implementación emulada propuesta para revisión en issue #4. Base: `adc8b174d5a7a4c32eeb2256570d99717806f90e`. No autoriza producción, merge, reglas/índices, Blaze ni servicios nuevos. Complementa [ADR-001](ADR-001-firestore-security.md); contratos v1 siguen explícitos y no se convierten silenciosamente.
Adenda de preparación, base `8aa4d22`: [Fase 1 productiva](../CLOUD-PRODUCTION-PHASE-1.md). Las garantías siguientes se conservan; se prepara otro factory con gates acumulativos y workflow forzado OFF, sin activar producción.

## Contexto y decisión

El perfil legado es del navegador, no tiene UID confiable. Auth por sí solo no prueba propiedad de `optilab-v1`. El store original sigue funcionando cuando la integración está deshabilitada, como exige el workflow de esta fase. La cuenta abre su propia instancia `CloudProgress`, con key UID y copia/journal separados, solo en el modo emulado explícito o tras una futura activación productiva autorizada del factory separado; al salir se desmonta esa instancia y vuelve invitado. AuthProvider no migra ni reinicia datos.

Se descartan dos alternativas: last-write-wins del perfil completo perdería campos independientes; una unión de mapas de práctica resucitaría elementos desmarcados. También se descarta un CRDT basado en reloj de cliente: no es una fuente confiable para resolver preferencias ni intención de borrado.

Elegimos **CAS global para serializar transacciones + versiones/causalidad por campo**, con conflictos explícitos y una generación (`epoch`) para reinicios. Prioridad: integridad y revisión de conflictos sobre resolver todo automáticamente.

## Esquema y límites v2

```text
users/{uid}/sync/current
  schemaVersion: 2, uid, epoch, revision, operationId, createdAt, updatedAt
users/{uid}/epochs/{epoch}/fields/{fieldId}
  schemaVersion: 2, uid, epoch, revision, operationId, value
users/{uid}/epochs/{epoch}/diagnostics/{attemptId}  payload validado v1, append-only
users/{uid}/epochs/{epoch}/gameRuns/{runId}        payload validado v1, append-only
users/{uid}/epochs/{epoch}/receipts/{receiptId}
  schemaVersion: 2, uid, epoch, kind, operationId, sourceHash, createdAt
```

Campos posibles: 28 `practice--{repo}`, cinco `visit--{1..5}`, nickname, avatarId, companionId, route, celebrated y dos `milestone--{2|3}`: **40 documentos como máximo**. Las reglas comprueban IDs, tipos, tamaños, fechas, evidencias y umbrales originales; `practice=null` es un tombstone. Los historiales usan el mismo contrato de payload v1 validado por ADR-001, pero ahora su path fija la generación. Datos personales no se mezclan con cursos/semestres ni estadísticas de grupo.

La separación por campo aumenta la lectura inicial respecto al documento compacto v1, pero evita evaluar un mapa entero complejo en cada actualización y conserva causalidad independiente dentro de los límites de 1.000 expresiones de Rules. El caso máximo probado importa 40 campos, 30 diagnósticos y 50 partidas en una transacción de 122 escrituras, por debajo de 500.

`sync/current` crea epoch=1/revision=1. Cada commit incrementa revision exactamente en uno; epoch se mantiene o aumenta exactamente en uno. uid/createdAt no cambian. Las escrituras hijas exigen `getAfter(head)`, avance real respecto a `get(head)`, misma revisión/operación y timestamp de servidor en **esa misma transacción**. Historias y recibos no admiten update/delete. Generaciones anteriores son legibles solo por su propietario y no escribibles. No se abren roles, membresías, cursos ni rankings.

V1 y v2 no pueden crearse conjuntamente ni bifurcarse: `existsAfter` en ambos singles impide esa carrera. Si existe `progress/current` v1, el cliente informa que requiere migración explícita y no crea un perfil v2 vacío. No hay documentos v1 productivos creados por las fases anteriores; un eventual backend legado necesita un flujo de migración aprobado, no se afirma soportarlo automáticamente. El legado **local** `optilab-v1` sí se importa con consentimiento.

## Journal y réplica local

- Namespace `optilab-sync:v2:{encodeURIComponent(uid)}:`; cache con UID/schema, una clave por operación UUID y respaldos por UID. Nunca usar email o grupo como clave ni escribir datos de cuenta en `optilab-v1`.
- Operaciones inmutables, con epoch, UUID, afterId y cambios `{value, baseRevision, predecessor}`. Orden topológico por afterId y desempate estable por ID, no por reloj. Una clave por operación evita sobrescribir la cola completa de otra pestaña.
- Consentimiento por UID/navegador en una clave independiente del cache; snapshots no pueden revocarlo o concederlo accidentalmente. Marcadores duraderos de revisión, resolución, ACK y descarte evitan que otra pestaña omita una revisión o reactive su copia volátil de una operación retirada.
- El cache remoto y el journal son distintos: proyectar operaciones pendientes no las marca confirmadas. Snapshots de un mismo epoch se combinan por revisión de campo; eventos viejos no sustituyen valores ya confirmados más nuevos.
- El journal se guarda **antes** de actualizar la vista local. Sin almacenamiento, cambios siguen en memoria con alerta/exportación; no se promete persistencia imposible. Si el navegador bloquea almacenamiento, importar/restaurar/reiniciar queda bloqueado sin respaldo persistente.
- Un snapshot que cambia de epoch conserva primero una recuperación local de la vista previa. El raw se guarda antes del hash asíncrono; un logout/cierre durante hashing deja un borrador que se finaliza en la siguiente sesión del mismo UID.
- Desmontaje cancela suscripciones/timers y vuelve inertes callbacks tardíos. La transacción comprueba que Auth todavía tiene el UID capturado, antes de enviar; una escritura ya aceptada por servidor no se puede deshacer mediante logout. Siempre apunta a A, nunca a B, y su ACK tardío no modifica la nueva vista.
- En este modo emulado, un fence de logout por UID y señales locales sin credenciales limpian inmediatamente la vista y bloquean transporte en todas las pestañas, incluso ante carreras de persistencia del SDK. Solo un acceso interactivo completado puede retirar ese fence; no se deriva identidad de un mensaje IPC. Cada pestaña confirma su usuario con su propio SDK, o permanece invitada hasta recargar/entrar. Esto no revoca tokens en el servidor ni cierra sesiones de otros dispositivos. La coordinación es opt-in desde main con la misma guarda de sync; el modo Auth publicado por defecto no la activa.
- Solo se ingieren snapshots confirmados, sin `fromCache`/`hasPendingWrites`. Valores de paths de un epoch viejo nunca se mezclan en el snapshot del epoch nuevo al reportar un conflicto. Si el primer estado de servidor retrocede respecto al cache (por ejemplo, borrar el emulador), se bloquea el reenvío y se pide exportar/elegir remoto explícitamente, en vez de declarar sincronizado un cache huérfano.
- Caché Firestore solo en memoria, sin IndexedDB de Firestore. Un SDK compartido puede conservar documentos en memoria de proceso; el store/journal y todas las referencias visibles están particionados por UID. Esto no es aislamiento criptográfico frente a código malicioso del mismo origen. GitHub Pages comparte origen con otros repos: revisar dominio/aislamiento antes de activación real.

## Política de conflictos

| Dato/operación | Política |
|---|---|
| Cambios en campos distintos | Se rebasan sobre head actual sin sustituir todo el documento |
| Misma preferencia/práctica, versión vieja y valor diferente | Conflicto; comparar remoto/propuesto y elegir explícitamente |
| Edición local posterior a otra aún pendiente | predecessor acepta la causalidad del op anterior |
| Mismo valor | Convergencia, no conflicto de contenido |
| Desmarcar práctica | Tombstone null versionado; un marcado atrasado no puede sobreescribirlo |
| Visitas | Unión monotónica true dentro del epoch |
| Hitos | Unión de evidencia válida por ID/fecha; no involucionan al desmarcar; umbrales 6/2 y 18/4 intactos |
| Celebraciones | Máximo confirmado dentro del epoch, acotado por la evolución de la vista |
| Diagnósticos | IDs UUID para nuevos; hash de contenido + ordinal de repetición para legado sin ID |
| Memorama | runId estable; mismo ID/datos es repetición; distinto contenido es conflicto histórico, nunca update |
| Importación | Une adiciones/historia; fecha más antigua entre dos prácticas afirmativas; diferencias de preferencias y tombstones requieren revisión |
| Reset/restore en otro dispositivo | Conflicto de epoch; nunca rebasing silencioso. Conservar remoto o restaurar respaldo con confirmación nueva |

Las fechas de ocurrencia siguen siendo autorreportadas; escoger la más antigua al unir evidencia/importación es una convención de conservación, no una prueba competitiva ni árbitro de preferencias. El diagnóstico debe coincidir con las respuestas; entradas incompatibles se conservan en respaldo y se rechazan con aviso. Nunca se “corrige” un score histórico en silencio.

La pantalla de conflicto muestra **ambos valores**, incluso si el resultado conflictivo estaba fuera de la ventana reciente y se leyó puntualmente en la transacción. Elegir local solo se permite para los campos conflictivos revisados del mismo epoch, con las versiones de esa vista; no rebasa otras operaciones sin revisar. El apodo captura su base al enfocar, para detectar un cambio remoto durante la edición, no solo al hacer blur. Los resultados históricos incompatibles no se sobrescriben. Elegir remoto respalda primero: retira la parte conflictiva, conserva adiciones/historia independientes y descarta operaciones de generaciones obsoletas solo después del respaldo. Si cambió la cola durante hashing, la decisión se detiene sin descartarla.

## Importación, recibos y recuperación

1. Login carga únicamente el cache/Cloud del UID. La decisión inicial es pendiente. Ofrecer importar invitado, conservar remoto, revisar y cancelar. No escribir Cloud por el solo login; las modificaciones locales siguen pendientes hasta aceptación.
2. Guardar raw exacto recuperable y SHA-256 antes de parsear o preparar un envío. Guardar también una copia original del legado antes de normalizaciones por acciones de invitado. Validación defensiva no descarta campos/fechas/IDs incompatibles silenciosamente.
3. Normalizar instantes ISO a Timestamp y de vuelta ISO UTC, y badges derivados. Orden de historiales: fecha + ID; la fecha no arbitra conflictos. La vista conserva límites existentes de 30 diagnósticos/50 runs; todo intento enviado sigue almacenado append-only en su epoch.
4. Preparar operación/journal persistente y recibo `i_{hash del JSON de origen validado/canonicalizado}`. No se usan timestamps nuevos de hitos derivados para identificar el origen, pues harían distinta la misma importación antigua. El recibo y TODOS los datos del legado acotado se escriben atómicamente. No hay importación parcial visible, ni un checkpoint “complete” antes del commit. El checkpoint local es el op duradero, raw y recibo esperado.
5. Si se pierde el ACK tras commit, reintentar lee el recibo y no repite escrituras/eventos. En otras operaciones el recibo es `o_{UUID}`. Reimportar no revierte cambios posteriores: usar restauración si esa es la intención.

Los diagnósticos viejos no tienen ID de origen: hash + ordinal distingue duplicados idénticos dentro de un respaldo, pero no demuestra identidad física entre dispositivos que produjeran eventos indistinguibles. No se inventa información para resolver esa ambigüedad.

Un backup contiene schema, UID propietario, fecha, procedencia, raw y checksum; también conserva el journal completo, su hash y epoch proyectado. Una marca por operación identifica cuáles pertenecen a la vista capturada: guardar bytes antiguos no autoriza reactivarlos al restaurar un checkpoint posterior a reset. Exportación permite rescatar incluso si no cabe otra copia en localStorage. Restore rechaza UID distinto o checksum incorrecto; el hash detecta corrupción, no autentica un archivo frente a una persona que lo edite/recalcule. No contiene tokens/contraseñas/almacenamiento SDK. Archivos privados no cifrados: no publicarlos en issues ni usar el apodo como alias público.

## Reset, restauración y borrado

Reset de aventura crea epoch+1 vacío y recibo, con respaldo previo. Mantiene generaciones/historiales anteriores y no elimina cuenta Auth. Reset de una cuenta todavía completamente vacía no necesita crear un documento. Restore confirmado crea una generación nueva con el respaldo; en una cuenta aún sin datos inicializa epoch=1. Una cola vieja no puede volver a escribir su generación anterior. Resolver un conflicto de reset con restore es una nueva intención explícita, no resurrección automática.

Restaurar un archivo con más historia offline que la ventana visible valida TODO el journal activo antes de preparar envíos. Reutiliza IDs originales, confirma la nueva aventura con su ventana actual y encola bloques adicionales de hasta 30 diagnósticos/50 runs con recibos propios. La restauración grande permanece pendiente hasta todos sus ACK y se retoma tras interrupciones; no se presenta como una transacción atómica ilimitada. Se probó la recuperación de 120 diagnósticos no enviados sin duplicarlos. Los eventos anteriores al reset capturado quedan en el archivo, pero no se reenvían al epoch restaurado. La importación normal del legado de hasta 80 históricos sigue siendo una única transacción.

Eliminar definitivamente historiales, generaciones, recibos o cuenta NO está implementado ni permitido desde cliente. Retención/exportación administrativa requiere aprobación independiente. Archivar no equivale a borrar.

## Offline y consumo

Sin internet se mantiene la copia/journal local y se muestra Sin conexión. Al volver online se intenta enviar; ante fallo, operación retenida y error recuperable con reintento explícito. Transacciones solo online, con hasta tres intentos SDK; si el emulador devuelve permission-denied por una carrera CAS, solo se vuelve a intentar (máximo dos veces adicionales) tras comprobar que head avanzó. Un denial sin avance se conserva como error, nunca se interpreta como éxito/duplicado.

No hay intervalos de escritura ni envío por render/snapshot. Debounce de 600 ms por actividad; apodo confirma al salir del campo. Cuatro listeners acotados por UID/epoch: head, campos ≤40, diagnósticos últimos 30 y runs últimos 50. Cambiar epoch/sesión desmonta los anteriores; sin listeners por juego ni escaneos de historiales completos.

No se añade service worker: una pestaña abierta sigue trabajando offline; recargar/abrir de cero sin los recursos web disponibles puede necesitar reconexión. El journal permanece para la próxima carga. “Offline” no garantiza que el navegador conserve datos si el usuario los borra o bloquea almacenamiento.

## Puerta de producción

Requisitos acumulativos del factory de emuladores: DEV, origen loopback, flag literal emulator, proyecto exacto demo-optilab-sync, Auth Emulator 127.0.0.1:9099 y Firestore 127.0.0.1:8085. Se mantienen intactos. La adenda prepara un factory productivo distinto para el proyecto/origen exactos, build PROD y flags explícitos sin endpoints emulados. El workflow conserva valores OFF forzados: activar exige otra PR/permiso, políticas, reglas e índices revisados y QA autorizado. Ninguna variable de repositorio por sí sola activa esta fase. No hay deploy Firebase ni permisos de escritura en CI.

Pruebas, instrucciones, presupuesto y publicación/rollback: [PROGRESS-SYNC.md](../PROGRESS-SYNC.md). Dispositivos físicos y producción no se declaran probados por contextos automatizados.
