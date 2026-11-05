# Backend académico en Vercel · preparación del piloto

Rama `codex/vercel-academic`, base `main` `8c780fe1a095087afa672329f0a16ee141442195`. Fecha: 4 de noviembre de 2026.

**Estado de esta PR:** código preparado y probado; **sin despliegue, sin variables productivas, sin credenciales reales, sin Firestore productivo y sin cambios de IAM/billing/Rules**. El frontend sigue en GitHub Pages/`optilab.club`; Vercel solo se prepara para el API.

## Arquitectura

- `api/v1/[operation].ts` es la función Vercel. No llama `listen()`; delega en `server/academic/vercel.ts`.
- Reutiliza `AcademicService`, `AcademicRepository`, contratos, validadores, autorización, CAS, idempotencia, auditoría y métricas existentes.
- El handler HTTP compartido (`server/academic/handler.ts`) también sirve al proceso local de 5200.
- `vercelRuntimeConfig` es **cerrado por defecto**. Preview devuelve 503 antes de cargar Firebase Admin. Producción solo abre con activación explícita y credencial protegida.
- El frontend usa `VITE_ACADEMIC_API_MODE`; una URL por sí sola no habilita nada.

## Matriz de entornos

| Entorno | Frontend/API | Activación | Firestore | Resultado |
|---|---|---|---|---|
| Local | `localhost:5195` → `127.0.0.1:5200` | `VITE_ACADEMIC_API_MODE=emulator` (lo fija `teacher-env`) | Emulador `demo-optilab-sync` | Flujo docente actual |
| Vercel Preview | URL preview estable | `ACADEMIC_ADMIN_MODE=vercel-preview` | Ninguno | **503 ACADEMIC_DISABLED** |
| Vercel Preview sin variables | — | `off`/vacío | Ninguno | **503 ACADEMIC_DISABLED** |
| Producción futura | `optilab.club` → API autorizado | `vercel-production` + habilidad explícita | `optilab-cd829` | Solo tras aprobación |
| Emergencia | cualquiera | `off`/`ACADEMIC_PRODUCTION_ENABLED=false` | Ninguno | 503 |

## Variables

### Frontend (públicas; quedan en el bundle)

```text
VITE_ACADEMIC_API_MODE=off|emulator|preview|production
VITE_ACADEMIC_API_URL=https://<api-autorizado>/api
VITE_ACADEMIC_APP_ORIGIN=https://optilab.club
```

- `off`/ausente es el default. `VITE_ACADEMIC_API_URL` sola no activa el panel.
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

El adaptador OIDC/WIF está implementado en código. La infraestructura GCP fue configurada manualmente y confirmada por el operador (pool `optilab-vercel`, provider `optilab-vercel-oidc`, service account `optilab-api@optilab-cd829.iam.gserviceaccount.com`, issuer `https://oidc.vercel.com/optilab`, audiencia `https://vercel.com/optilab`, subject Production). **La credencial temporal todavía no se ha probado de extremo a extremo desde Vercel y producción académica sigue deshabilitada.** Las variables de Vercel Production aún deben configurarse; no se modificaron IAM ni credenciales en esta PR. El fallback `FIREBASE_SERVICE_ACCOUNT_JSON` solo puede usarse como variable Sensitive con aprobación; nunca commitear JSON, PEM, tokens o `.env` con secretos.

Compatibilidad verificada con `@vercel/oidc@4.0.6`: `getVercelOidcToken({audience})` y `verifyVercelOidcToken(token,{issuer,audience,projectId,environment})` existen con esas firmas; `VERCEL_PROJECT_ID` está disponible en build/runtime cuando el acceso a System Environment Variables está habilitado. En el handler Node, el runtime debe leer `x-vercel-oidc-token` directamente de `IncomingMessage`; `getVercelOidcToken` depende del contexto global de Vercel y no de `req.headers`. La prueba local ejecuta el verificador real de `@vercel/oidc` con un JWT/JWKS de prueba, interceptando solo `https.get`, para validar firma y claims sin red; el intercambio STS/WIF real sigue pendiente.

## Despliegue del API (no ejecutado)

1. En Vercel: **Add New → Project → Import Git Repository**. No reutilizar el proyecto de GitHub Pages.
2. Configurar Node.js 22, `npm ci` y mantener el directorio raíz del repositorio. El proyecto es de API, no del frontend; no asignar `optilab.club` ni un dominio de producción al deployment de la API.
3. No hace falta configurar un build estático para las funciones; Vercel detecta `api/v1/[operation].ts`. `vercel.json` limita la función a `maxDuration: 15`; no se declara `memory` porque Vercel Hobby administra la memoria. El handler limita body a 16 KiB y el rate limiter es por instancia (no distribuido).
4. En Preview, usar `ACADEMIC_ADMIN_MODE=vercel-preview` o dejarlo vacío. No agregar credenciales Firebase.
5. Verificar cierre: `POST https://<preview>/api/v1/roster` → 503 `ACADEMIC_DISABLED`. No debe aparecer ninguna llamada a Firestore.
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
6. Solo después de la aprobación del propietario, desplegar la API de producción y luego cambiar el frontend de Pages a `VITE_ACADEMIC_API_MODE=production`, URL y origen; reconstruir Pages.
7. Verificar que la Preview no tenga las variables productivas y que CI no haya realizado escrituras reales.

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
- Producción requiere credencial protegida y aprobación; no se creó ninguna.
- No se modificaron Rules, IAM, facturación, workflows ni lockfiles.
- El frontend sigue en Pages y los 28 juegos no cambian.


## ESM hotfix (post-deploy)

Vercel transpila TypeScript a `.js` pero conserva los especificadores relativos; con `"type":"module"`, Node ESM exige extensión. Todos los imports relativos de `server/academic/**/*.ts` y `api/v1/[operation].ts` usan `.js`. El catálogo se importa como JSON estático con atributo de tipo, por lo que `@vercel/nft` lo incluye. Evidencia: `docs/evidence/vercel-esm-hotfix.txt`. No se cambió lógica académica, Firebase, permisos ni infraestructura.


## Piloto real

El procedimiento de aprovisionamiento dry-run, activación y reversión está en [PILOT-REAL-RUNBOOK.md](PILOT-REAL-RUNBOOK.md).
