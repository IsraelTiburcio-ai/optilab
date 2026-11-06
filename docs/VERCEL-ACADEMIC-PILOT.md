# Backend académico en Vercel · preparación del piloto

Rama `codex/vercel-academic`, base `main` `8c780fe1a095087afa672329f0a16ee141442195`. Fecha: 4 de noviembre de 2026.

**Estado actual:** API académica de Production activa: `OPTIONS /api/v1/roster` devuelve `204` y `POST` sin token `401 UNAUTHENTICATED`. El smoke temporal sigue desactivado (`404 OIDC_SMOKE_DISABLED`). La PR de este cambio activa el frontend de GitHub Pages con `VITE_ACADEMIC_API_MODE=production`; hasta el merge/redeploy, el bundle público sigue sin el módulo académico. Preview de Vercel permanece cerrada. El secreto temporal anterior debe retirarse/rotarse.

## Arquitectura

- `api/v1/[operation].ts` es la función Vercel. No llama `listen()`; delega en `server/academic/vercel.ts`.
- Reutiliza `AcademicService`, `AcademicRepository`, contratos, validadores, autorización, CAS, idempotencia, auditoría y métricas existentes.
- El handler HTTP compartido (`server/academic/handler.ts`) también sirve al proceso local de 5200.
- `vercelRuntimeConfig` es **cerrado por defecto**. Preview devuelve 503 antes de cargar Firebase Admin. Producción ya está abierta con activación explícita y credencial protegida; el frontend productivo se activa en el build de Pages, no en Preview.
- El frontend usa `VITE_ACADEMIC_API_MODE`; una URL por sí sola no habilita nada.

## Matriz de entornos

| Entorno | Frontend/API | Activación | Firestore | Resultado |
|---|---|---|---|---|
| Local | `localhost:5195` → `127.0.0.1:5200` | `VITE_ACADEMIC_API_MODE=emulator` (lo fija `teacher-env`) | Emulador `demo-optilab-sync` | Flujo docente actual |
| Vercel Preview | URL preview estable | `ACADEMIC_ADMIN_MODE=vercel-preview` | Ninguno | **503 ACADEMIC_DISABLED** |
| Vercel Preview sin variables | — | `off`/vacío | Ninguno | **503 ACADEMIC_DISABLED** |
| Producción | `optilab.club` → API autorizado | `vercel-production` + build Pages con modo `production` | `optilab-cd829` | API activa; frontend se activa con esta PR tras merge/redeploy |
| Emergencia | cualquiera | `off`/`ACADEMIC_PRODUCTION_ENABLED=false` | Ninguno | 503 |

## Variables

### Frontend (públicas; quedan en el bundle)

```text
VITE_ACADEMIC_API_MODE=off|emulator|preview|production
VITE_ACADEMIC_API_URL=https://<api-autorizado>/api
VITE_ACADEMIC_APP_ORIGIN=https://optilab.club
```

- `off`/ausente es el default en local. El workflow de Pages fija `production`, URL y origen para el build público; `VITE_ACADEMIC_API_URL` sola no activa el panel.
- En local, `scripts/teacher-env.mjs` fija `emulator` y `http://127.0.0.1:5200`.
- En preview/producción se exige HTTPS, URL sin credenciales/query/hash, path `/api` (o raíz) y `VITE_ACADEMIC_APP_ORIGIN` exactamente igual al origen actual.
- Producción exige que el proyecto Firebase del build sea `optilab-cd829`; preview rechaza `demo-*`.
- No usar secretos en variables `VITE_*`.

### Dependencias runtime

`firebase-admin` y `google-auth-library` están en `dependencies` (no en `devDependencies`) para el bundle de Vercel. El lockfile se actualizó con npm; no se migró a otro gestor. `npm audit --omit=dev` queda en 0 vulnerabilidades; los overrides `glob@14.0.3` y `minimatch@11.0.4` corrigen transitivas runtime sin añadir servicios. `@types/node`, `tsx`, Playwright y Vite permanecen de desarrollo.

### Backend Vercel

| Variable | Pública/Secreta | Uso |
|---|---|---|
| `ACADEMIC_ADMIN_MODE` | configuración | `vercel-preview`, `vercel-production` u `off` |
| `ACADEMIC_PRODUCTION_ENABLED` | configuración | debe ser `true` solo tras aprobación; default off |
| `ACADEMIC_ADMIN_PROJECT` | configuración | `optilab-cd829` en producción |
| `ACADEMIC_ALLOWED_ORIGINS` | configuración | uno o varios orígenes HTTPS exactos, separados por coma |
| `ACADEMIC_RATE_LIMIT` | configuración | límite best-effort por instancia, 1–10000 |
| `ACADEMIC_MAX_TTL_SECONDS` | configuración | TTL de invitaciones, 1–604800 |
| `ACADEMIC_PROGRESS_ATTEMPT_LIMIT` | configuración | intentos leídos por alumno, 1–2000; default 200 |
| `ACADEMIC_CREDENTIAL_MODE` | configuración | `oidc`, `service-account` o `none`; default cerrado |
| `VERCEL_OIDC_ISSUER` / `VERCEL_OIDC_AUDIENCE` | configuración | `https://oidc.vercel.com/optilab` / `https://vercel.com/optilab` |
| `GCP_*` / `ACADEMIC_VERCEL_SUBJECT` | configuración | identidad federada OIDC/WIF, solo producción |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **secreta** | fallback Admin; no se creó ni se incluyó aquí |
| `VERCEL_ENV` | automática de Vercel | `preview`/`production`; no se falsifica |

El adaptador OIDC/WIF está implementado. La infraestructura GCP fue configurada manualmente y las 10 variables OIDC/GCP ya están en Vercel Production. La corrección #45 incorpora lectura directa de `x-vercel-oidc-token`, verificación estricta y Firestore directo por petición; la API de Production ya responde `OPTIONS` 204 y `POST` sin token 401. El smoke temporal sigue desactivado y el secreto anterior debe retirarse/rotarse. No se modificaron IAM ni credenciales en esta PR. El fallback `FIREBASE_SERVICE_ACCOUNT_JSON` solo puede usarse como variable Sensitive con aprobación; nunca commitear JSON, PEM, tokens o `.env` con secretos.

Compatibilidad verificada con `@vercel/oidc@4.0.6`: `getVercelOidcToken({audience})` y `verifyVercelOidcToken(token,{issuer,audience,projectId,environment})` existen con esas firmas; `VERCEL_PROJECT_ID` está disponible en build/runtime cuando el acceso a System Environment Variables está habilitado. En el handler Node, el runtime debe leer `x-vercel-oidc-token` directamente de `IncomingMessage`; `getVercelOidcToken` depende del contexto global de Vercel y no de `req.headers`. La prueba local ejecuta el verificador real de `@vercel/oidc` con un JWT/JWKS de prueba, interceptando solo `https.get`, para validar firma y claims sin red; el smoke real posterior a #45 sigue pendiente.

## Despliegue del API (histórico)

1. En Vercel: **Add New → Project → Import Git Repository**. No reutilizar el proyecto de GitHub Pages.
2. Configurar Node.js 22, `npm ci` y mantener el directorio raíz del repositorio. El proyecto es de API, no del frontend; no asignar `optilab.club` ni un dominio de producción al deployment de la API.
3. No hace falta configurar un build estático para las funciones; Vercel detecta `api/v1/[operation].ts`. `vercel.json` limita la función a `maxDuration: 15`; no se declara `memory` porque Vercel Hobby administra la memoria. El handler limita body a 16 KiB y el rate limiter es por instancia (no distribuido).
4. En Preview, usar `ACADEMIC_ADMIN_MODE=vercel-preview` o dejarlo vacío. No agregar credenciales Firebase.
5. La Preview de Vercel permanece cerrada: `POST https://<preview>/api/v1/roster` → 503 `ACADEMIC_DISABLED`. No debe aparecer ninguna llamada a Firestore. La URL de Pages/Production no es una Preview.
6. Comprobar HTTPS y CORS: una petición `OPTIONS /api/v1/roster` desde el origen autorizado devuelve 204 y `Access-Control-Allow-Origin`; el mismo origen no autorizado devuelve 403. Sin token, `POST` devuelve 401 antes de tocar Firestore.
7. No activar una Preview con Firestore productivo. Si se necesita una API de prueba, usar un proyecto/emulador aprobado fuera de Vercel o un mock; una Preview de Vercel no alcanza `127.0.0.1`.

## Smoke local con runtime oficial

Se ejecutó `vercel dev --local` (CLI 65.11.0, sin link ni deploy) con `ACADEMIC_ADMIN_MODE=vercel-preview`. `POST /api/v1/roster` llegó a la función dinámica y respondió `503 ACADEMIC_DISABLED` con `server: Vercel`, antes de inicializar Firebase Admin/Firestore. Evidencia: `docs/evidence/vercel-preview-smoke.txt`.

La validación de cuerpo JSON y el handler abierto se cubren con la prueba compartida `tests/academic/vercel.test.ts` (cuerpo válido llega al servicio; JSON inválido devuelve 400) y las pruebas HTTP locales. `vercel build --standalone` no se pudo ejecutar porque el CLI exige login/proyecto; no se creó un proyecto ni se desplegó. El catálogo JSON es un import ESM estático y `@vercel/nft print` lo incluyó en la traza de archivos de la función; el smoke no mostró error de módulo.

## Activación productiva futura (requiere aprobación separada)

1. Confirmar proyecto `optilab-cd829`, presupuesto $0 y plan Spark.
2. Obtener autorización explícita para crear una credencial Vercel Sensitive; no reutilizar credenciales locales.
3. Configurar `ACADEMIC_ADMIN_MODE=vercel-production`, `ACADEMIC_PRODUCTION_ENABLED=true`, `ACADEMIC_ADMIN_PROJECT=optilab-cd829`, `ACADEMIC_ALLOWED_ORIGINS=https://optilab.club`.
4. Agregar el origen exacto a CORS del API y el dominio a Firebase Auth Authorized domains.
5. Desplegar primero Preview cerrada; probar `OPTIONS`, token válido, token de otro proyecto, usuario revocado, matrícula revocada y CORS denegado.
6. El frontend de Pages se activa en `.github/workflows/deploy.yml` para el build de `main`: `VITE_ACADEMIC_API_MODE=production`, URL y origen exactos. No activar esas variables en Preview.
7. Verificar que la Preview no tenga las variables productivas y que CI no haya realizado escrituras reales.

## Rollback del frontend

El workflow de Pages fija el modo producción de forma persistente. Para revertir:

1. Cambiar `VITE_ACADEMIC_API_MODE` a `off` y vaciar URL/origen en `.github/workflows/deploy.yml`.
2. Hacer merge del cambio y esperar el redeploy de Pages.
3. Verificar que `#/docente` ya no aparece y que el API no recibe peticiones del frontend.
4. Mantener la API cerrada si además se revierte el backend.

## Apagado de emergencia

- Backend: `ACADEMIC_ADMIN_MODE=vercel-production` + `ACADEMIC_PRODUCTION_ENABLED=false` (o `ACADEMIC_ADMIN_MODE=off`) y redeploy.
- CORS: retirar `https://optilab.club` de `ACADEMIC_ALLOWED_ORIGINS`.
- Frontend: `VITE_ACADEMIC_API_MODE=off`, vaciar URL/origen y reconstruir Pages.
- Revocar la credencial Vercel si se sospecha fuga; revisar Auth y logs de Vercel.
- Los deployments antiguos ya abiertos en navegadores pueden seguir ejecutando JS; el servidor debe seguir cerrado y la credencial revocada.

## Coste y consultas

El default `ACADEMIC_PROGRESS_ATTEMPT_LIMIT=200` limita los intentos leídos por alumno; el dashboard muestra `activityDataTruncated` cuando el historial supera ese cap y los conteos pueden ser parciales. Sin cap, `reportedAttempts` se leía hasta 2,000.

Supuestos por una llamada a `groupProgress`, con páginas llenas y `r` intentos leídos:

```text
por alumno ≈ 1 sync + r intentos + 40 fields + 50 gameRuns + 50 diagnostics + 5 perfil/membresía
```

| Alumnos | r=200 | r=2000 (antes) |
|---|---:|---:|
| 5 | ≈ 1,735 | ≈ 10,735 |
| 20 | ≈ 6,940 | ≈ 42,940 |
| 40 | ≈ 13,880 | ≈ 85,880 |

No es una factura medida. Cada montaje/refresco del dashboard, cambio de periodo o reintento puede repetir la consulta. El periodo 7/30/90 ahora filtra `reportedAttempts` en Firestore por `observedAt`; «Todo» usa el cap de 200 y puede marcar historial parcial. Para 40 alumnos y uso intensivo, la siguiente mejora debe ser un agregado/summary autorizado, no aumentar el cap. Mantener Spark; no habilitar Blaze por esta PR. Ver el runbook del piloto para 3/5/20/40.

## Validación local

```sh
npm ci
npm run typecheck:academic
npm run build
npm run test:academic:api
npm run test:activities:security
TEACHER_BROWSER=chromium npm run test:teacher
TEACHER_BROWSER=webkit npm run test:teacher
```

Pruebas específicas del adaptador: `node --import tsx --test tests/academic/vercel.test.ts`, `tests/academic/panel-gate.test.ts` y `tests/academic/environment.test.ts`.

## Limitaciones explícitas

- Vercel Preview está cerrada; no es un entorno de datos de prueba por sí misma.
- El rate limiter actual es por instancia, no distribuido. En Vercel usa el primer IP de `x-forwarded-for`/`x-real-ip` para no agrupar a todos los clientes detrás del proxy; esa cabecera es best-effort y puede ser spoofeada, por lo que no es una frontera de seguridad. Después de autenticar también se limita por UID.
- Producción requiere credencial protegida y aprobación. La service account dedicada no se creó como JSON; el secreto temporal del primer smoke debe retirarse/rotarse.
- No se modificaron Rules, IAM, facturación, workflows ni lockfiles.
- El frontend sigue en Pages y los 28 juegos no cambian.


## ESM hotfix (post-deploy)

Vercel transpila TypeScript a `.js` pero conserva los especificadores relativos; con `"type":"module"`, Node ESM exige extensión. Todos los imports relativos de `server/academic/**/*.ts` y `api/v1/[operation].ts` usan `.js`. El catálogo se importa como JSON estático con atributo de tipo, por lo que `@vercel/nft` lo incluye. Evidencia: `docs/evidence/vercel-esm-hotfix.txt`. No se cambió lógica académica, Firebase, permisos ni infraestructura.


## Piloto real

El procedimiento de aprovisionamiento dry-run, activación y reversión está en [PILOT-REAL-RUNBOOK.md](PILOT-REAL-RUNBOOK.md).

## Diagnóstico sanitizado de `503 ACADEMIC_DISABLED`

Actualmente Production está abierta; el 503 corresponde a Preview o a un runtime cerrado. Los cierres de `server/academic/vercel.ts` emiten únicamente logs estructurados con banderas booleanas y códigos seguros:

- `runtime_config_closed`: `vercelRuntimeConfig()` no abrió. Incluye banderas como `modeOff`, `modeProduction`, `vercelEnvProduction`, `nodeEnvProduction`, `productionEnabled`, `projectConfigured`, `noAuthEmulator`, `noFirestoreEmulator` y `allowedOriginsValid`. No incluye valores de variables, orígenes, proyecto, correos ni secretos.
- `missing_oidc_header`: el runtime está abierto en modo OIDC, pero la petición no trae `x-vercel-oidc-token`. No registra el header ni sus valores.
- `production_admin_init_failed`: falló la inicialización de `productionAdmin`. Registra `stage: "production_admin"` y un código de la lista segura (`ACADEMIC_ENV_REJECTED`, `firestore/invalid-credential`, etc.); los errores desconocidos se reportan como `UNCLASSIFIED`. No registra el mensaje original.

Las respuestas HTTP no cambian: mientras el runtime esté cerrado, ambos POST y OPTIONS siguen devolviendo `503 ACADEMIC_DISABLED`; en Production abierta, OPTIONS devuelve 204 y POST sin token 401.

## Subetapas de inicialización de `productionAdmin`

Si `production_admin_init_failed` persiste, el campo `stage` identifica la subetapa estática:

- `OIDC_CONFIG`: validación de variables OIDC/GCP.
- `GOOGLE_AUTH_IMPORT`: import de `google-auth-library`.
- `CREDENTIAL_BUILD`: construcción de la credencial OIDC.
- `FIREBASE_IMPORT`: import de Firebase Admin App/Auth.
- `FIREBASE_APP_INIT`: `initializeApp`.
- `FIRESTORE_IMPORT`: import de `@google-cloud/firestore`/Auth.
- `EXTERNAL_CLIENT`: creación del cliente externo WIF.
- `GOOGLE_AUTH`: creación de `GoogleAuth`.
- `FIRESTORE_CONSTRUCT`: construcción de Firestore directo.
- `AUTH_INIT`: creación de Firebase Auth.
- `SERVICE_CONSTRUCT`: construcción de repositorio/servicio académico.

El código asociado solo puede ser un valor de la lista segura o `UNCLASSIFIED`; no se registra el mensaje original.

### Node.js 22 vs 26

La construcción local de `productionAdmin` con configuración OIDC válida terminó correctamente tanto en Node.js 22 como en Node.js 26. La suite académica completa en Node 26 solo mostró una diferencia de entorno: `tsx` emite `DEP0205` en stderr y una prueba que exige stderr vacío falla por ese warning; no es un fallo de `productionAdmin`. Vercel no usa `tsx` para ejecutar la función.

No se encontró evidencia local de incompatibilidad de Node 26. La subetapa real debe confirmarse con el nuevo log de Production.

`@google-cloud/firestore` es una dependencia opcional transitiva de `firebase-admin`. Si el nuevo log indica `stage: "FIRESTORE_IMPORT"`, la recomendación es declararla como dependencia directa fijada a la versión instalada, sin cambiar aún package.json hasta confirmar el log.
