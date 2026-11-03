# Sprint: aventura e intentos privados entre dispositivos

## Entrega y auditoría

Base: main `80eb1e72340f5484c2e7fc3c46c87ce7ef8e4a69`. Se revisó #26 en `0c4dac6541a44239f9d2c99a98aefb6f1cc310db`, sin fusionar su rama. Se reutilizan selectivamente su validador de operaciones, factories separadas y gates acumulativos, protección de receipts/CAS y pruebas de presupuesto. El destino se actualiza a **https://optilab.club**, base **/** y release **private-progress-and-attempts-v1**; los gates del antiguo github.io no sirven. Se conservan #28/iframeLoadGate y #29/historial local v1.

Pages fuerza Sync `disabled`, release/proyecto/origen vacíos y endpoints emulados vacíos. Un merge de esta PR no activa Cloud. Ninguna prueba de esta entrega utiliza datos de alumnos o Firebase productivo. No cambia juegos ni rankings.

## Funcionamiento implementado

- **Aventura:** se reutiliza el journal por UID con CAS por campo, epochs para reset/restauración, importación voluntaria con hash/receipt, respaldo previo, offline, conflictos explícitos y restauración por chunks. Invitado conserva `optilab-v1`; cuentas no importan automáticamente.
- **Observaciones de actividad:** canal independiente `users/{uid}/reportedAttempts/{activityId}--{id}`. Se reutiliza el ledger v1 de #29. Es append-only e idempotente; conserva únicamente campos recibidos, con unidades nativas. `observedAt` es hora cliente; `serverReceivedAt` es tiempo del servidor. No se confunden esos tiempos con duración ni con finalización.
- Aperturas/prácticas declaradas permanecen `declaration`; resultados `client-report`. Las rutas de resultados validados están cerradas a clientes. Los resultados legacy de Memorama de aventura siguen separados; no se duplican para rankings.
- Consentimiento de aventura e intentos independientes. “Sincronizar historial de esta cuenta” revisa y respalda la copia UID existente; “Importar historial invitado y sincronizar” es una acción distinta, conserva invitado y crea respaldo etiquetado. Pausar detiene nuevos envíos; no puede cancelar una transacción ya enviada al servidor. Una operación enviada como A no se reasigna a B.
- Intentos: unión por actividad/id y comparación de payload completo. Un ID con contenido distinto produce conflicto y respaldos local/remoto. Elegir remoto requiere acción explícita y respalda local primero. Restaurar usa unión, preserva eventos nuevos y no modifica documentos inmutables. No elimina replay fences ni borra Cloud. Una restauración conflictiva se detiene y conserva archivos.
- Persistencia local de intentos en IndexedDB transaccional por UID y espejo JSON exportable. Las escrituras y merges comprueban la sesión dentro del bloqueo y la transacción. Sin almacenamiento seguro se falla de forma visible. El almacenamiento del navegador no protege contra quien controla físicamente ese navegador.
- Los intentos Cloud exigen propietario autenticado **con correo verificado**, también en Rules. El canal legacy de aventura conserva su autorización por UID de #3/#4; el requisito de correo verificado para todo el piloto es una política adicional por aprobar. No se atribuye a Rules una restricción que no tiene.

## Reproducción sin tocar servicios reales

Con Node 22.12+, JDK 21 y los motores Playwright instalados:

```bash
npm ci
npx playwright install chromium webkit
npm run test:cloud-sprint
npm run test:sync:production
```

El primer comando de pruebas crea Auth en 127.0.0.1:9199 y Firestore en 127.0.0.1:8185, proyecto **demo-optilab-sync**, con las reglas candidatas; Vite usa 5296. No modifica los emuladores ya abiertos en 9099/8085. Las pruebas estándar/CI conservan su par canónico. No se permiten endpoints arbitrarios. El segundo comando comprueba un build de producción con switches emulados: debe permanecer cerrado, sin peticiones Firebase ni carga de módulos Sync.

El test de dos contextos reproduce escritorio y móvil 390×844, importación separada, entrega entre clientes, offline/reconexión, restauración/export, cambio A/B y preservación del invitado. Esto no certifica un iPhone físico. La partida real legacy de Memorama necesita `MEMORAMA_DIR` con su checkout; cuando falta se registra SKIPPED, nunca PASS.

## Reglas e índices preparados, no publicados

- Nuevos intentos: propietario + correo verificado; esquema exacto y campos acotados; clave ligada a actividad/id; timestamp de recepción del servidor; create-only. Lecturas de otro UID, consultas sin límite, sobreescrituras, borrado y elevación de confianza denegados.
- El transporte del canal demo rechaza proyectos reales. El factory productivo revalida proyecto, origen, base, flags, Auth real y logout fence antes de abrir el SDK. No usa caché persistente global del SDK.
- Se añaden las dos protecciones de #26: receipt ligado a operationId del head y operationId distinto al actualizar CAS. Se ejecutan las regresiones originales de Rules.
- `reportedAttempts` no indexa métricas ni PII; la consulta privada usa el índice interno de document ID, sin compuesto nuevo. La exención de índices se prepara en firestore.indexes.json. No se ejecutó `firebase deploy`.

## Decisiones que necesita aprobar el propietario antes de piloto productivo

| Decisión | Propuesta y límite actual |
|---|---|
| Finalidad y participantes | Recuperar aventura y observaciones educativas privadas; primer piloto con hasta 5 adultos de prueba durante 14 días, sin datos de alumnos. No constituye allowlist ni rate limit de Rules: hoy es un control operativo del operador. Aprobar protección adicional de admisión antes de abrirlo a más usuarios. |
| Datos y consentimiento | UID, preferencias de aventura, evidencias mínimas e informes con confianza; nada de contraseñas/tokens en exports. El nickname existente puede contener texto personal: usar alias de prueba. No adjuntar correo, curso/grupo ni nombre académico a intentos. Consentimiento separado, con copia previa a importar. |
| Retención | Aprobar 14 días para el piloto y 12 meses para un uso educativo futuro antes de adoptarlo. Sin purga automática ni TTL. No borrar epochs, receipts o respaldos mientras puedan existir journals offline: se perdería la protección anti-resurrección/replay. Definir operador, calendario y recibos de borrado. |
| Exportación y recuperación | Aventura exporta snapshot+journal y respaldos; intentos exporta ledger recibido y respaldos privados. Los dos canales se restauran por separado, no como una operación atómica entre ambos. El export del navegador no es un volcado completo del proyecto ni garantiza incluir historia fuera de las ventanas del motor. El límite de lectura de intentos es 2000; al alcanzarlo se detiene con error, sin afirmar que el export sea completo. Aprobar procedimiento de exportación administrativa para volúmenes mayores. |
| Borrado | Reset de aventura crea epoch, no borra datos. Restaurar intentos no borra observaciones remotas. Las Rules no permiten borrado cliente de intentos. Aprobar operador y herramienta de borrado recursivo por UID, verificación de identidad, export previo opcional, invalidación de sesiones/journals y SLA (propuesta: 30 días). No existe aún una purga administrativa automatizada en esta PR; no prometerla a alumnos. |
| Cuotas y abuso | Propuesta: inspección diaria y pausa al alcanzar 10k lecturas/5k escrituras diarias del proyecto; hasta 100 intentos iniciales por cuenta en piloto. No son límites de seguridad: Rules no aplica rate limiting ni impide un cliente malicioso que cree muchos IDs. No habilitar Blaze. Cada intento nuevo hace lectura transaccional y una escritura; replays iguales hacen lectura sin reescritura. Cada dispositivo abre una consulta inicial y escucha cambios; además hay costes de aventura, reintentos y Rules. Las cuotas son compartidas con el proyecto. |
| Publicación | Revisar reglas efectivas, export/borrado, admisión y monitorización. Autorizar por separado reglas/índices y el cambio del workflow que habilite flags correctos; nunca activar por variables de repositorio sin cambio de workflow. Acordar responsable de piloto y rollback. Este entregable no autoriza ninguna de esas operaciones. |

Las cuotas gratuitas documentadas son 50k lecturas y 20k escrituras diarias, con reset alrededor de medianoche del Pacífico, y una base gratuita por proyecto. TTL, backups/PITR administrados y restore administrado requieren billing. Las [cuotas oficiales](https://firebase.google.com/docs/firestore/quotas) se consultaron el 3 de noviembre de 2026. El [servicio administrado de export/import](https://firebase.google.com/docs/firestore/manage-data/export-import) requiere Blaze; no se utiliza ni habilita aquí. Los respaldos JSON de esta app son distintos de ese servicio.

## Piloto Mac ↔ iPhone, pendiente de aprobación/activación

Tras las autorizaciones anteriores, el operador registrará SHA/build, ruleset y configuración. En ambos dispositivos, el propietario usará una misma cuenta de prueba verificada. En Mac: exportar primero, importar voluntariamente aventura e intentos y esperar confirmaciones independientes. En iPhone: elegir remoto para aventura y sincronizar intentos sin importar invitado; comprobar conteos y campos, añadir una práctica y recuperarla en Mac. Probar offline en un dispositivo, cambios concurrentes del mismo campo y resolución explícita. Exportar ambos canales y restaurar uno, comprobando que no se duplican intentos ni desaparecen eventos nuevos. Cambiar A→B→invitado y repetir recuperación A sin mezclar perfiles.

Ante permiso denegado, conflicto no comprendido, pérdida de respaldo, discrepancia de UID o presupuesto alcanzado: pausar el canal afectado, exportar y pedir revisión. No borrar almacenamiento ni aplicar rollback de configuración automáticamente. El piloto físico y la activación productiva permanecen **BLOCKED por autorización**, no se declaran probados por emulación.
