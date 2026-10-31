# OptiLab Cloud · Fase 1 de preparación productiva (#3 / #4)

**Estado: preparado para revisión, producción desactivada.** Base `main`
`8aa4d2265ee28e85370530d9288a81b590ebc489`. No se desplegaron reglas, índices,
servicios ni aplicación; no se consultaron documentos reales, Console, IAM,
billing o Vercel. Los 28 emisores y sus contratos no se modifican.

## Auditoría y faltantes exactos

| Área | Base revisada | Preparación de esta fase / pendiente para activar |
| --- | --- | --- |
| `src/auth` | Auth productiva existente, cuenta sin migración implícita, persistencia Auth local con fallback en memoria, fence de logout opt-in | Se reutiliza sin alterar proveedores/identidades. La fábrica exige UID actual no anónimo y rechaza Auth Emulator; confirmar con el propietario política de correo verificado y dispositivos compartidos antes del rollout. |
| `src/progress/config.ts` | Sync permitido únicamente con DEV + loopback + proyecto/puertos demo exactos | Conserva intacta esa función. Se añade un modo productivo separado, acumulativo y apagado por defecto. |
| `src/progress/transport.ts` | Fábrica demo y core transaccional ya implementados | Fábrica productiva separada, validación de identidad/configuración antes de acceder al SDK y caché Firestore solo en memoria. Se reutiliza el mismo core, sin cambiar resolución de conflictos ni importación. |
| Engine / storage / modelo | Consentimiento por UID, journal duradero, respaldo previo, CAS, epochs, offline, restore por bloques, dedupe `runId` | Se conservan; se agrega validación previa de operaciones corruptas/sobredimensionadas antes de lecturas/escrituras SDK. No se elimina la cola ante rechazo. |
| `firestore.rules` | Privados por UID, no anónimos, esquemas estrictos, CAS, históricos append-only, rutas futuras cerradas | Se exige recibo ligado a la operación del head y un `operationId` distinto al avanzar revisión. Falta aprobación y publicación independiente del ruleset exacto. |
| `firestore.indexes.json` | Exenciones de mapas/textos; `date DESC` collection-scope para runs/diagnósticos | Ya cubre las consultas de Sync v2. Se prueba el contrato de índices y no se añade un compuesto innecesario. Falta comprobar configuración real/READY cuando el propietario autorice acceso. |
| ADR-001 | Ownership/ámbitos definidos; bootstrap privilegiado todavía propuesto | Aprobar ADR, reglas y mecanismo privilegiado por separado. Los clientes no reciben capacidad de crear roles, grants ni estadísticas verificadas. |
| ADR-002 | Integración emulada revisada; política productiva abierta | Aprobar consentimiento/conflictos/reset/restore, retención/borrado, origen, abuso, rollout y QA físico. Las variables públicas no sustituyen esas decisiones. |

Los issues #3/#4 permanecen abiertos: preparación local no equivale a activación
ni a permisos desplegados. #6/#7 mantienen sus alcances Cloud independientes.

## Configuración separada y fail-closed

- Desarrollo: `firebase.sync-emulator.json`, `demo-optilab-sync`, Auth
  `http://127.0.0.1:9099`, Firestore `127.0.0.1:8085`, DEV y origen loopback.
  Los guards existentes no se eliminan ni se amplían a hosts remotos.
- Producción: `firebase.production.json` solo referencia reglas/índices; no
  contiene emuladores, Hosting, Functions ni credenciales. La plantilla
  `.env.sync-production.example` tiene todos los gates apagados/vacíos.
- `.github/workflows/deploy.yml` fuerza Sync a `disabled`, con los otros gates
  vacíos y sin endpoints de emulador. Ni una variable de repositorio inesperada
  ni fusionar esta PR activa sincronización. Activar requiere otra modificación
  autorizada y revisada del workflow.

Requisitos **acumulativos** de `productionSyncAllowed` para una futura activación:

| Configuración | Valor que solo se habilitará después de autorización |
| --- | --- |
| Build Vite | `PROD=true`, `DEV=false`, `BASE_URL=/optilab/` |
| `VITE_PROGRESS_SYNC` | `production` |
| `VITE_PROGRESS_SYNC_RELEASE` | `private-progress-v2` |
| `VITE_PROGRESS_SYNC_PROJECT_ID` | `optilab-cd829` |
| `VITE_PROGRESS_SYNC_ORIGIN` y origen efectivo | `https://israeltiburcio-ai.github.io` exacto |
| Auth | Las seis variables públicas Auth existentes; proyecto `optilab-cd829`, dominio `optilab-cd829.firebaseapp.com`, sin Auth Emulator |
| Firestore | `(default)`, caché SDK solo en memoria, sin `VITE_FIRESTORE_EMULATOR_HOST` |

`VITE_PROGRESS_SYNC_RELEASE` es un marcador público de configuración, **no un
secreto, permiso servidor ni prueba de aprobación**. Las Rules y el token Auth
siguen autorizando cada operación. Un build preview loopback no abre producción,
incluso con todas las variables productivas; no usar cuentas ni datos reales
para ejecutar estas pruebas. Si cambia el origen aprobado, hace falta revisar
la allowlist y repetir pruebas, no introducir un comodín.

## Contratos y garantías conservadas

1. Invitado permanece en `optilab-v1`. Login no importa ni borra su progreso.
   Cada UID mantiene réplica, journal, consentimiento y respaldos propios.
2. Importar requiere decisión explícita y respaldo antes de parsear/enviar;
   conservar remoto/cancelar no migra invitado silenciosamente. Logout desmonta
   la cuenta y bloquea callbacks/envíos tardíos, sin mezclar A y B.
3. CAS y causalidad por campo conservan cambios independientes; conflictos
   del mismo campo/historia o epoch requieren revisión. Reset/restore no borran
   generaciones ni resucitan colas antiguas. Fallos/offline conservan journal.
4. **Memorama legacy:** `gameResults` conserva su payload y `runId`, con dedupe.
   Su importación y sincronización de progreso ya soportadas continúan solo
   dentro de una cuenta cuyo uso/importación se aceptó. No se convierte en
   puntuación competitiva verificada.
5. **Otros 27:** sus informes de sesión no pasan al store/journal ni a
   `gameResults`. El validador y las Rules aceptan `gameRuns` únicamente para
   Memorama. No se habilita telemetría Cloud nueva; eso pertenece a #7.
6. No se alteran prácticas, diagnósticos, insignias, evolución o recompensas.

## Reglas, límites y presupuesto Spark

El cliente acepta por operación hasta 40 campos, 30 diagnósticos y 50 runs,
con un payload serializado máximo de 200.000 bytes; importación máxima:
**122 escrituras** (120 documentos + head + recibo). Bloques de restore grande
conservan sus límites e idempotencia. UID/IDs/payloads/fechas/CAS se validan antes
de llamar al SDK; recibir una operación inválida deja el journal recuperable.
Las Rules verifican de nuevo propiedad/esquema/tamaños, revisiones, epoch,
inmutabilidad y recibo; rechazan inyección de roles y métricas de otros juegos.
Dos escritores de una misma revisión no pueden confirmar ambos batches.

Cuatro listeners acotados por UID/epoch: head, campos ≤40, diagnósticos últimos
30 y runs últimos 50. Las Rules permiten páginas como máximo 40/50, deniegan
escaneos `collectionGroup`, listas de recibos y rutas administrativas no
implementadas. Los índices no conceden permisos. El emulador no acredita
índices READY ni facturación.

Referencia pública de [cuotas Standard](https://firebase.google.com/docs/firestore/quotas),
revisada el 2026-10-31: 1 GiB de almacenamiento, 50.000 lecturas/día,
20.000 escrituras/día, 20.000 borrados/día y 10 GiB salientes/mes gratuitos.
El presupuesto se comparte con todas las apps del proyecto; revalidar antes
del lanzamiento, sin cambiar Spark/billing.

- Estimación v2 de 70 alumnos × dos inicios maduros/día: hasta 16.940 lecturas
  iniciales, más dependencias Rules, reintentos, cambios y reconexiones.
  Reservar hasta ~30.000 lecturas y ~2.000 escrituras en un día normal bajo
  las hipótesis de [PROGRESS-SYNC.md](PROGRESS-SYNC.md).
- Importar el máximo para 70 cuentas añade hasta 8.540 escrituras, además del
  uso normal. 500 intentos atrasados ×70 ×3 escrituras son **105.000**:
  recuperación por tandas y presupuesto diario requieren decisión operativa.
- Guardas cliente y tamaño/paginación en Rules **no son rate limiting servidor**.
  Un cliente modificado puede consumir su propia cuota con operaciones válidas.
  Abuso, alta de cuentas, límites de rollout, monitoreo y eventual App Check
  requieren revisión/autorización; esta fase no afirma resolverlos ni instala
  servicios. No activar producción hasta aceptar ese riesgo/control.
- No habilitar TTL, PITR, backups administrados, Functions o Blaze por suponer
  que son gratuitos. Los recibos/epochs y respaldos crecen y necesitan retención.

## Privacidad y retención: decisiones pendientes del propietario

- Finalidad, aviso y consentimiento; duración de conservación local y remota;
  tratamiento de alumnos, dispositivos compartidos y cuentas sin correo verificado.
- Plazos de epochs antiguos, eventos, recibos, cuarentenas, respaldos y markers;
  quién exporta/borra y cómo se audita. Borrar recibos puede romper idempotencia;
  borrar una cuenta Auth o documento padre no elimina sus subcolecciones.
- GitHub Pages comparte origen con los repositorios de juegos. UID en una clave
  no es aislamiento criptográfico frente a JavaScript del mismo origen. Aprobar
  separación de origen o su mitigación antes del rollout, especialmente para
  el reproductor legacy; no modificar ahora los juegos ni su sandbox.
- Los respaldos JSON privados no están cifrados: no subirlos a issues/logs ni
  conservar tokens. La sesión Auth existente no cambia; no se añaden correos,
  roles o credenciales a documentos de progreso.

## Runbook futuro — todos los pasos reales requieren autorización independiente

**Estos comandos no se ejecutaron en esta fase.** No ejecutar `firebase deploy`
genérico, no usar aliases implícitos ni desplegar otros servicios.

1. Aprobar esta PR/ADR, políticas anteriores, mecanismo de permisos de #3,
   presupuesto/abuso, tratamiento de remoto v1 y plan de prueba/rollback.
   Elegir cuentas propias y dispositivos del propietario para un piloto real;
   el gate cliente no restringe el alta ni el abuso desde clientes modificados.
2. Con autorización de lectura administrativa, comprobar proyecto
   `optilab-cd829`, base `(default)`, ubicación informada `northamerica-south1`,
   Auth/domino autorizado y guardar referencia/copia privada de las reglas e
   índices realmente instalados. No asumir que el estado informado en ADR sigue
   vigente. No crear, borrar ni migrar documentos para descubrirlo.
3. Autorizar/publicar por separado el ruleset exacto revisado y, si corresponde,
   los índices. Revisar cualquier propuesta de eliminación de índices antes
   de aceptarla; el compuesto futuro de `groupActivities` no habilita sus rutas.

   ```sh
   firebase deploy --only firestore:rules --project optilab-cd829 --config firebase.production.json
   firebase deploy --only firestore:indexes --project optilab-cd829 --config firebase.production.json
   ```

4. Confirmar Rules publicadas y `date DESC` listo para las consultas necesarias;
   ejecutar matriz de permisos con cuentas propias autorizadas. No afirmar
   seguridad productiva solo por tests emulados. Un `progress/current` remoto
   v1 detectado bloquea su conversión: necesita migración aprobada aparte.
5. En **otra PR de activación**, reemplazar los cuatro valores forzados OFF del
   workflow por las variables aprobadas de la tabla y publicar el build exacto.
   Mantener endpoints de emulador vacíos. Sin esa PR el workflow de esta fase
   continúa apagado aunque se configuren variables en GitHub.
6. QA manual del piloto: login sin importación; importar/cancelar/conservar;
   respaldo exacto; A→logout→B→A y dos pestañas; mismo UID en Mac/iPhone reales;
   cambios concurrentes independientes y conflictivos; offline/cierre/reapertura;
   reset frente a una cola vieja; restore por bloques; cuota/denial sin pérdida;
   Memorama deduplicado y los otros 27 sin persistencia de sus informes.
7. Comprobar límites/uso real, permisos y retención con el propietario antes de
   abrir a alumnos. No prometer autonomía docente, métricas verificadas o Cloud
   de los otros juegos por activar progreso privado.

## Rollback sin pérdida ni mezcla de cuentas

Antes de cualquier activación real debe aceptarse este procedimiento:

1. Solicitar exportación de copias por UID y conservar journal/ACK/respaldos.
   Detener nuevos envíos/uso del piloto y restaurar los gates OFF mediante
   publicación estática autorizada. Pestañas antiguas abiertas siguen teniendo
   su JS: el rollback estático por sí solo no las desactiva ni revoca tokens.
2. No trasladar cache privado a `optilab-v1`, eliminar recibos/epochs ni vaciar
   almacenamiento para ocultar errores. Al volver al modo invitado, la copia
   original sigue siendo la del navegador, no el último perfil privado.
3. Para revocar acceso de clientes ya abiertos, el propietario debe autorizar
   restaurar un ruleset previo/deny-all. Eso bloquea operaciones pendientes;
   conservarlas para recuperación explícita. No rebajar permisos ni descartar
   journal para que una operación parezca confirmada.
4. Rehabilitar solo tras revisión de respaldo, generación, conflictos y reglas.
   Borrado definitivo/retención y recuperación remota v1 son procedimientos
   separados aún pendientes, no efectos de este rollback.

## Evidencia de esta fase

| Verificación local | Resultado |
| --- | --- |
| Firestore, matriz previa + preparación + importación máxima con nuevas Rules | 104/104 PASS |
| Sync core/modelo/guardas/integración + gate productivo + presupuesto de operaciones | 38/38 PASS |
| Auth real del SDK contra Auth Emulator | 9/9 Chromium y 9/9 WebKit |
| Sync UI: consentimiento, cuentas, conflictos, offline, reset/restore, Memorama y fixture de informes temporales | 6 escenarios PASS por motor |
| Preview de producción con flags emulados: sin conexión Firebase ni chunks Sync | 1/1 por motor |
| Ahorcado/Ordena + reproductor/fixtures | 44/44 por motor |
| Memorama legacy + arena/piloto/aventura, emisores públicos contra host local | 31/31 por motor |
| Seguridad de contrato de resultados / actividades | 13/13 y 4/4 PASS |
| Build, typecheck académico y diff whitespace | PASS |

Los cinco escenarios UI existentes de Sync pasaron juntos; se agregó y ejecutó
por separado el sexto en ambos motores. Ese fixture de contrato muestra informes
válidos de Ahorcado/System Lab dentro de una cuenta aceptada, sin cambios en el
snapshot/journal/runs ni RPC Commit; salir y volver no recupera el informe.
No se presenta un fixture como una partida nativa. Las Rules y validación previa
rechazan además `gameRuns` de cada uno de los otros 27 IDs. La regresión Memorama
completa la partida real y comprueba recepción única en otro cliente emulado.

Los casos nuevos de Rules usan `demo-optilab-production-qa`; la matriz previa
usa `demo-optilab-firestore` y Sync `demo-optilab-sync`, siempre con UIDs
sintéticos y endpoints loopback. No se detuvieron ni vaciaron los emuladores
del propietario. Auth se ejecutó con su propio proceso `demo-optilab-auth` en
9299 para no mezclar códigos OOB del proyecto demo existente. Sync UI usó un
servidor candidato 5197; los contextos secundarios ahora respetan `baseURL`
en lugar de abrir por accidente el servidor académico existente de 5195.
Los primeros fallos de QA por esos endpoints fijos se corrigieron sin alterar
Auth ni el mecanismo de sincronización.

La configuración productiva se prueba como política pura y los factories
apagados rechazan antes de obtener instancias SDK. El core se verifica contra
emuladores. **No se probó una sesión productiva habilitada contra Firebase real**,
índices READY, cuotas facturadas o dispositivos físicos; siguen siendo gates
del propietario. Los detalles de CI de la PR no equivalen a ese QA productivo.
