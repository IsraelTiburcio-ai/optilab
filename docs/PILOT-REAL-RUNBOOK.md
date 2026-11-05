# Piloto real limitado · OptiLab

Base: `main` `9b5b97ea88579f9b71788b5b0061d9bf44853fab` (PR #40 fusionada). Esta PR prepara la **Etapa A** del piloto; **no activa producción, no despliega, no crea credenciales y no escribe en Firestore real**.

## Alcance

Profesora + dos alumnos + un curso + un periodo + un grupo. Datos de prueba; no expedientes reales. El objetivo es validar el recorrido completo con Firebase Emulator y dejar un runbook para una activación posterior autorizada.

El acceso no se concede por rol o correo enviado desde el navegador:

1. La profesora se aprovisiona con un plan de propietario.
2. La autorización docente se lee de `courses/.../staff` + `administration`.
3. Los alumnos solo entran por invitación, solicitud y aprobación; el roster/membership es su allowlist efectiva.
4. No hay claim global `teacher` ni autoasignación de permisos.

## Etapa A — Preparación (esta PR)

### A.1 Bootstrap docente dry-run

El owner usa un manifiesto **privado, fuera de Git**, con IDs y UIDs de prueba/verificados:

```json
{
  "projectId": "optilab-cd829",
  "teacherUid": "<uid-autorizado>",
  "course": {"id": "curso-piloto", "title": "Optimización I"},
  "term": {"id": "periodo-piloto", "title": "Periodo piloto"},
  "group": {"id": "grupo-piloto", "title": "Grupo piloto"},
  "students": [{"uid": "<uid-alumno-1>"}, {"uid": "<uid-alumno-2>"}]
}
```

```sh
node scripts/pilot-provision.mjs --manifest /ruta/privada/pilot.manifest.json
```

Resultado: `mode: DRY-RUN`, `network: false`, `productionWrites: false`, diez documentos exactos para curso, settings, staff/administration de curso y grupo, periodo, grupo, settings y `teachingScopes` de la profesora. Los UIDs de alumnos se validan como participantes esperados, pero **no se escriben**: la inscripción sigue siendo invitación + aprobación. La ejecución real ya tiene una ruta exclusiva de propietario: exige `PILOT_PROVISION_APPROVAL=apply:optilab-cd829`, `--confirm provision:optilab-cd829`, credenciales ADC/Admin, UID docente existente con correo verificado y una transacción que rechaza cualquier documento existente. **No se ejecutó en esta PR**.

El manifiesto y los UIDs nunca se guardan en el repositorio. El dry-run no importa Firebase Admin, no abre red y no verifica todavía que el UID exista en Auth (esa comprobación pertenece a la aplicación autorizada).

### A.2 Credenciales Vercel/Firebase

**Estado real:** infraestructura confirmada manualmente por el operador: proyecto `optilab-cd829` (`401863964479`), pool `optilab-vercel`, provider `optilab-vercel-oidc`, service account `optilab-api@optilab-cd829.iam.gserviceaccount.com`, issuer `https://oidc.vercel.com/optilab`, audiencia `https://vercel.com/optilab` y subject Production. La identidad federada está vinculada a la service account; la cuenta tiene `roles/datastore.user` y `roles/firebaseauth.viewer`. El adaptador está implementado en código y cerrado por defecto. **No se ha probado un token/credencial temporal real de extremo a extremo desde Vercel Production**, y la producción académica sigue deshabilitada. El fallback `FIREBASE_SERVICE_ACCOUNT_JSON` sigue disponible solo como secreto Sensitive y también está cerrado por defecto.

Estrategia recomendada e implementada en código: **Vercel OIDC + Google Cloud Workload Identity Federation**, disponible en todos los planes de Vercel. El token OIDC es de corta vida; `productionAdmin()` lo obtiene por solicitud, verifica firma/JWKS, `iss=https://oidc.vercel.com/optilab`, `aud=https://vercel.com/optilab` y el subject exacto `owner:optilab:project:optilab-api:environment:production`, y lo intercambia por una identidad federada con una service account mínima. La audiencia del recurso WIF se deriva por separado como `//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc`. La configuración de infraestructura ya existe según confirmación del operador, pero no se ha validado el intercambio real; el modo sigue cerrado hasta completar el smoke y la aprobación. No se aplicaron cambios IAM adicionales. La app Firebase/Firestore y el rate limiter se reutilizan por instancia; la credencial crea un cliente OIDC nuevo en cada solicitud de access token y no conserva el JWT OIDC. El limiter es best-effort y no distribuido. Si Google exigiera facturación, se mantiene el fallback JSON Sensitive; no se activó Blaze.

Configuración de Vercel Production (la infraestructura GCP ya está configurada; las variables de Vercel aún deben configurarse solo en Production):

- Verificar que Secure backend access con OIDC esté activo en el proyecto `optilab-api`.
- Configurar `ACADEMIC_CREDENTIAL_MODE=oidc`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `VERCEL_OIDC_ISSUER=https://oidc.vercel.com/optilab`, `VERCEL_OIDC_AUDIENCE=https://vercel.com/optilab` y `ACADEMIC_VERCEL_SUBJECT=owner:optilab:project:optilab-api:environment:production`. `VERCEL_PROJECT_ID` lo proporciona Vercel en build/runtime cuando el acceso a System Environment Variables está habilitado; el código falla cerrado si falta.
- Verificar el Workload Identity Pool/Provider existente con issuer de Vercel.
- Verificar que el provider esté condicionado a `assertion.environment == "production"`, `assertion.aud == "https://vercel.com/optilab"`, `assertion.sub == "owner:optilab:project:optilab-api:environment:production"` y al proyecto/equipo exactos; Preview no recibe el token productivo.
- Verificar la service account dedicada con `roles/datastore.user` y `roles/firebaseauth.viewer`; no ampliar permisos sin justificación.
- Verificar `roles/iam.workloadIdentityUser` sobre la service account para el provider; sin llaves persistentes.
- No usar la misma identidad en Preview/Development ni compartir credenciales.

Pendiente de verificación real (no declarar producción operativa):

- Obtener un token OIDC de Vercel Production con audiencia `https://vercel.com/optilab` y verificar firma/JWKS, `iss`, `aud`, `project_id`, `environment` y `sub`.
- Confirmar que el intercambio STS/WIF produce una credencial temporal de la service account y que Firestore/Auth funcionan con ella.
- Confirmar que Preview/Development no reciben ni aceptan el token productivo.
- Verificar el índice `reportedAttempts.observedAt` en el proyecto real.
- Mantener `ACADEMIC_PRODUCTION_ENABLED=false` hasta completar el smoke y la aprobación.

Compatibilidad revisada contra `@vercel/oidc@4.0.6`: `getVercelOidcToken(options?)` acepta `audience` y devuelve un token; `verifyVercelOidcToken(token, {issuer,audience,projectId,environment})` verifica firma contra JWKS remoto y los claims. En el handler Node, el runtime debe leer `x-vercel-oidc-token` directamente de `IncomingMessage`; `getVercelOidcToken` depende del contexto global de Vercel y no de `req.headers`. La prueba local ejecuta el verificador real de `@vercel/oidc` con un JWT/JWKS de prueba, interceptando solo `https.get`, para validar criptográficamente el flujo sin red ni credenciales; no sustituye el smoke real.

Fallback actualmente implementado, pero desactivado: `FIREBASE_SERVICE_ACCOUNT_JSON` como variable **Sensitive** de Vercel producción, service account mínima y aprobación explícita. No se creó, copió ni solicitó ninguna credencial. El código de producción sigue cerrado y el fallback existente solo se activa con `ACADEMIC_PRODUCTION_ENABLED=true` y `VERCEL_ENV=production`; Preview no puede abrirlo.

Para el smoke real de solo lectura, ver [OIDC-SMOKE-RUNBOOK.md](OIDC-SMOKE-RUNBOOK.md). No ejecutar sin autorización separada.

### A.3 Preflight

```sh
npm run pilot:preflight
```

Comprueba índice, ESM, Pages, API 503 y el plan dry-run. Para Auth, dominios autorizados, Rules y usuarios, revisar la consola/Admin y el manifiesto privado; no se ejecutan escrituras.

### A.4 Pruebas

```sh
npm run test:academic:api
npm run typecheck:academic
npm run build
TEACHER_BROWSER=chromium npm run test:teacher
TEACHER_BROWSER=webkit npm run test:teacher
```

Cobertura sintética: docente autorizado, dos alumnos, alumno/docente ajeno, usuario anónimo, token inválido/proyecto distinto, revocación, publicación/ocultación, persistencia tras recarga, sync consentido, conflictos CAS, reintentos idempotentes, rate limit, Preview cerrada, 28 juegos y actividades externas.

El flujo real de referencia es `tests/teacher/ui/dashboard-real-flow.spec.ts` (B completa Memorama, C practica, A ve el dashboard) y `tests/teacher/ui/activities.spec.ts` (A publica, B ve). Las pruebas de los 28 juegos están en `tests/activities/ui/player.spec.ts`.

### A.5 Índice de Firestore

La consulta `reportedAttempts` usa `orderBy('observedAt','desc')`, filtros `>=`/`<=` y `limit(200)`. `firestore.indexes.json` conserva la exención global de la colección y añade una excepción específica `reportedAttempts.observedAt` con alcance `COLLECTION` y orden `DESCENDING`.

**No se despliega el índice en esta PR.** Antes de activar el dashboard productivo, el propietario deberá aprobar `firebase deploy --only firestore:indexes` y verificar en Firebase Console que el índice esté `READY`; si falta o está fallando, el dashboard productivo debe permanecer desactivado. Prueba de regresión: `tests/firestore/production-readiness.test.mjs`.

### A.6 Coste

`groupProgress` limita a 200 intentos por alumno y ahora consulta `reportedAttempts` por periodo (`observedAt >= from` y `<= to`) en lugar de traer todo el historial para filtrar en memoria. El periodo 7/30/90 reduce lecturas; «Todo» usa el cap de 200 y marca `activityDataTruncated` con advertencia visible.

Estimación por una llamada, con páginas llenas y `r` intentos leídos por alumno:

```text
por alumno ≈ 1 sync + r intentos + 40 fields + 50 gameRuns + 50 diagnostics + 5 perfil/membresía
```

| Alumnos | r=20 | r=200 |
|---|---:|---:|
| 3 | ≈ 500 | ≈ 1,040 |
| 5 | ≈ 830 | ≈ 1,730 |
| 20 | ≈ 3,320 | ≈ 6,940 |
| 40 | ≈ 6,640 | ≈ 13,880 |

No es facturación medida. Cada montaje/cambio de periodo/refresco puede repetir la consulta y no hay caché ni agregado persistente. Con 40 alumnos y muchas consultas diarias podría superar la cuota gratuita; el siguiente paso debe ser un summary/agregado autorizado, no subir el límite. Objetivo operativo: **$0 MXN**; Spark/Vercel Hobby; no Blaze, billing, Redis ni servicios pagados.

## Etapa B — Aprobación del propietario

Lista exacta que requiere autorización escrita:

1. Aprobar la verificación E2E de OIDC/WIF **o**, alternativamente, usar la variable Sensitive de service account; desplegar el índice `reportedAttempts.observedAt` con aprobación.

Comando de ejecución real del plan, solo después de la aprobación (no ejecutado):

```sh
unset CI
PILOT_PROVISION_APPROVAL=apply:optilab-cd829 \
GOOGLE_APPLICATION_CREDENTIALS=/ruta/privada/adc.json \
node scripts/pilot-provision.mjs --manifest /ruta/privada/pilot.manifest.json \
  --execute --confirm provision:optilab-cd829
```

El script verifica el UID docente en Auth, exige correo verificado, escribe exactamente diez documentos y rechaza cualquier documento existente. No ejecutar en CI.
2. Aprobar el proyecto Firebase `optilab-cd829` y la service account mínima.
3. Aprobar el UID real de la profesora y los dos UIDs de alumnos de prueba.
4. Aprobar el manifiesto privado y el plan dry-run.
5. Aprobar la escritura de los diez documentos de aprovisionamiento.
6. Aprobar la activación de la API Vercel producción (`ACADEMIC_PRODUCTION_ENABLED=true`).
7. Aprobar los valores de frontend y el rebuild de Pages.
8. Aprobar el piloto limitado y la ventana de reversión.

## Etapa C — Activación (no ejecutada)

1. Completar la verificación E2E de WIF/OIDC o usar el fallback aprobado; desplegar/verificar el índice de Firestore y que Preview sigue cerrada.
2. Desplegar la API con producción explícita; no cambiar `optilab.club` de Pages a Vercel.
3. Crear/verificar la cuenta de la profesora en Firebase Auth; aplicar el plan aprobado con un procedimiento de escritura separado (no habilitado aquí).
4. La profesora crea invitaciones y aprueba a los dos alumnos.
5. Configurar Pages: `VITE_ACADEMIC_API_MODE=production`, `VITE_ACADEMIC_API_URL=https://optilab-api.vercel.app/api`, `VITE_ACADEMIC_APP_ORIGIN=https://optilab.club`, con el proyecto Firebase real; reconstruir.

## Etapa D — Validación

- Profesora entra, ve grupo, invita/admite a dos alumnos.
- Cada alumno entra con su cuenta, completa consentimiento de sync y juega un juego original.
- El dashboard muestra progreso y separa abierto/declarado/informado/completado/validado.
- La profesora crea una actividad Wordwall/LearningApps, la previsualiza y publica en un gimnasio.
- El alumno la ve; recarga; persiste.
- Alumno/docente ajeno y revocado no acceden.
- Repetir en Chromium/WebKit y comprobar coste real de Firestore.

## Etapa E — Reversión

1. `ACADEMIC_ADMIN_MODE=off` o `ACADEMIC_PRODUCTION_ENABLED=false` y redeploy.
2. Retirar `https://optilab.club` de `ACADEMIC_ALLOWED_ORIGINS`.
3. Desactivar `VITE_ACADEMIC_API_MODE` y reconstruir Pages.
4. Revocar credenciales/WIF o permisos si hubo incidente; revisar Auth y logs.
5. Conservar SHA, configuración, dominio y plan; los clientes antiguos pueden seguir abiertos, por lo que el servidor debe quedar cerrado.

## Estado de esta PR

Etapa A únicamente. No se desplegó, no se modificó IAM/Auth/Rules/billing, no se crearon credenciales, no se usaron UIDs reales y no se escribió en Firestore productivo.
