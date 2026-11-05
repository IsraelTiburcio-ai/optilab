# Smoke OIDC de Vercel Production → Google STS → IAM Credentials

## Estado operativo actual

- La **PR #44 sí se desplegó en Production** y el smoke se habilitó para el primer intento real.
- El primer smoke devolvió **`502 OIDC_TOKEN_UNAVAILABLE`**.
- El fallo ocurrió **antes del intercambio con Google STS**; no llegó a IAM Credentials.
- El smoke se **desactivó** y Production volvió a responder **`404 OIDC_SMOKE_DISABLED`**.
- La API académica permaneció cerrada con **`503 ACADEMIC_DISABLED`**.
- El secreto temporal anterior debe **retirarse o rotarse**; no reutilizarlo.
- La **PR #45** corrige la recuperación del token; **no está desplegada** y el smoke sigue desactivado.
- Las 10 variables OIDC/GCP ya están configuradas en Vercel Production; no se modifican en esta PR.

La corrección #45 no se ha ejecutado en Production. Una Preview automática de Vercel, si existe, no tiene la identidad ni la configuración de Production y no puede ejecutar el smoke.

## 1. Decisión

- **Preparar y revisar este mecanismo:** GO.
- **Ejecutar el smoke ahora:** **NO-GO**. La corrección #45 requiere revisión, despliegue autorizado y un secreto nuevo; el endpoint de Production está actualmente en `404`.
- **Activar el backend académico:** **NO-GO** y fuera del alcance de este smoke.
- **Después de revisar y desplegar #45 con autorización separada:** GO condicionado a todas las compuertas de la sección 5.

La autorización para preparar o revisar este código **no autoriza** desplegarlo en Production ni ejecutar el smoke.

### Historial del primer intento

La PR #44 se desplegó con `OIDC_SMOKE_ENABLED=true`. La invocación real devolvió `502 OIDC_TOKEN_UNAVAILABLE` antes de contactar Google. El endpoint se desactivó y Production respondió `404`; la API académica se mantuvo en `503`. No se obtuvo token OIDC, no se hizo STS y no se obtuvo access token.

## 2. Diseño recomendado

El smoke necesita ejecutarse donde Vercel entrega la identidad OIDC de Production. Se descartaron:

- Un smoke desde local: el token de desarrollo no tiene el subject de Production.
- Ejecutarlo dentro del build de Production: no prueba el path runtime, altera el build y no tiene una autorización de solicitud independiente.
- Reutilizar `/api/v1/*` o las variables de activación académica: mezcla diagnóstico con el piloto cerrado.

Se implementa una función temporal aislada:

`POST /api/internal/oidc-smoke`

La función no usa Firestore, Auth, la API académica ni `ACADEMIC_PRODUCTION_ENABLED`. Obtiene y verifica el token OIDC, crea un `ExternalAccountClient` con la audiencia WIF exacta, pide un access token temporal mediante IAM Credentials y devuelve únicamente estados sanitizados. No devuelve tokens, JWT, cabeceras, usuarios ni mensajes de Google.

### Compuertas

La función devuelve `404 OIDC_SMOKE_DISABLED` salvo que se cumplan todas:

- `OIDC_SMOKE_ENABLED=true` en Production.
- `VERCEL_ENV=production` y `NODE_ENV=production`.
- `ACADEMIC_ADMIN_MODE=off`.
- `ACADEMIC_PRODUCTION_ENABLED` no sea `true`.
- No haya emuladores de Auth/Firestore.
- `OIDC_SMOKE_TOKEN` exista, tenga entre 32 y 256 bytes y se envíe como `Authorization: Bearer ...`.

La autorización se compara con SHA-256 y `timingSafeEqual`. El secreto es independiente de Firebase, del piloto académico y del token OIDC.

### Validaciones

1. Lectura del token desde `x-vercel-oidc-token` del `IncomingMessage`.
2. `verifyVercelOidcToken` contra el JWKS de Vercel **antes** de usar el token.
3. Claims exactos: `iss=https://oidc.vercel.com/optilab`, `aud=https://vercel.com/optilab`, `project_id=VERCEL_PROJECT_ID`, `environment=production` y `sub=owner:optilab:project:optilab-api:environment:production`.
4. `ExternalAccountClient` con:
   `//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc`.
5. Suplantación de `optilab-api@optilab-cd829.iam.gserviceaccount.com`.
6. Access token no vacío y expiración futura; solo se devuelve `accessTokenExpiresInSeconds`.
7. Sin escrituras, sin persistencia y sin logs de credenciales.

### Causa raíz del 502

`getVercelOidcToken()` no lee `IncomingMessage.headers`. Lee el contexto global de Vercel:

`globalThis[Symbol.for('@vercel/request-context')].headers['x-vercel-oidc-token']`

El handler Node de `api/internal/oidc-smoke.ts` no rellena ese contexto, aunque Vercel sí entrega la cabecera en `req.headers`. Por eso la versión anterior terminaba en `OIDC_TOKEN_UNAVAILABLE` antes de verificar nada.

La opción `{audience}` existe en los tipos instalados de `@vercel/oidc@4.0.6`, pero el problema era la recuperación del token. Además, el token de función ya usa por defecto `aud=https://vercel.com/optilab`, según la referencia oficial de Vercel. La corrección no intercambia el token: lee la cabecera, lo verifica criptográficamente y valida claims exactos. Si la audiencia no coincide, falla cerrado.

### Ciclo de vida del backend

La primera revisión detectó además que Firebase Admin `getFirestore()` rechaza credenciales personalizadas (`firestore/invalid-credential`). Por eso el backend OIDC usa Firestore directo con `GoogleAuth` + `ExternalAccountClient` por petición, no `getFirestore(app)`.

- Admin/Firestore OIDC se crean por petición y se cierran en `finally`; no se reutilizan entre solicitudes.
- El contexto de `AsyncLocalStorage` contiene `{token, active}` y se invalida en `finally` al terminar la petición.
- `currentRequestOidcToken()` y `verifiedRequestOidcToken()` rechazan contextos inactivos.
- `verifiedRequestOidcToken()` revalida `active` después del `await` de verificación; una validación pendiente que termina después del cierre no entrega token.
- Cada access token se renueva bajo demanda; nunca se guarda un JWT vencido.
- Si un recurso intenta renovar después de terminar la petición, el contexto está inactivo y falla cerrado; no hay mezcla de identidades.
- Las solicitudes concurrentes usan objetos de contexto distintos: cerrar una no invalida la otra.
- Si `productionAdmin()` falla después de crear la Firebase App, termina el Firestore creado y elimina la App antes de relanzar.
- El access token temporal no se devuelve ni se registra.

El mismo patrón se aplica al backend académico: `vercelHandler` guarda el token de la cabecera en `AsyncLocalStorage` durante la petición y `productionAdmin()` lo consume desde ahí, sin depender del contexto global de Vercel.

### Pruebas de regresión

- Simulan la entrega de `x-vercel-oidc-token` en un `IncomingMessage`.
- Demuestran que `getVercelOidcToken()` no ve esa cabecera sin el contexto global.
- Verifican que el token de cabecera se valida antes de usarse.
- Rechazan claims/audiencia/subject incorrectos, ausencia de contexto y concurrencia entre peticiones.
- Confirman que no se devuelven tokens ni cabeceras.

## 3. Archivos de la preparación

- `server/oidc-smoke.ts`: configuración, autorización y ejecución sanitizada.
- `api/internal/oidc-smoke.ts`: función HTTP temporal.
- `tests/academic/oidc-smoke.test.ts`: pruebas de compuertas, auth, errores, STS/IAM y no exposición.
- `vercel.json`: límite de ejecución de 15 s para la función temporal.
- `tsconfig.academic.json`: inclusión del módulo de smoke.

Ninguno de estos archivos se despliega en Production ni se ejecuta con esta preparación.

## 4. Variables temporales

Solo si el operador autoriza la ejecución:

| Variable | Entorno | Tipo | Uso |
|---|---|---|---|
| `OIDC_SMOKE_ENABLED` | Production | configuración | Actualmente `false`; `true` solo durante una ventana autorizada |
| `OIDC_SMOKE_TOKEN` | Production | **Sensitive** | Retirar el anterior y generar uno nuevo de al menos 32 bytes |

No agregarlas a Preview ni Development. No reutilizar `ACADEMIC_PRODUCTION_ENABLED` como interruptor del smoke. Las 10 variables OIDC/GCP existentes ya están configuradas y no se modifican. El secreto anterior debe rotarse/retirarse antes de una nueva ventana.

El backend debe seguir exactamente así:

```text
ACADEMIC_ADMIN_MODE=off
ACADEMIC_PRODUCTION_ENABLED no debe ser true
```

## 5. Autorización de ejecución requerida

El operador debe autorizar por escrito, como una decisión separada:

1. Revisar y aprobar el commit de la PR Draft de smoke.
2. Autorizar su despliegue temporal en Production.
3. Autorizar agregar `OIDC_SMOKE_ENABLED=true` y `OIDC_SMOKE_TOKEN` en Production únicamente.
4. Autorizar **una** invocación autorizada y las pruebas negativas de la sección 7.
5. Autorizar la eliminación inmediata del secreto, el desmontaje del endpoint y el rollback de Production si corresponde.
6. Confirmar que **no** se autoriza activar la API académica ni ejecutar bootstrap.

## 6. Procedimiento manual de ejecución

No ejecutar estos pasos sin la autorización de la sección 5.

### 6.1 Antes de desplegar

1. Confirmar que el backend cerrado responde `503 ACADEMIC_DISABLED`:

```sh
curl -sS -o /tmp/optilab-academic-before.json -w '%{http_code}\n' \
  -X POST 'https://optilab-api.vercel.app/api/v1/roster' \
  -H 'content-type: application/json' \
  --data '{}'
```

2. Confirmar en Vercel Production:
   - System Environment Variables habilitado.
   - Las 10 variables OIDC/GCP ya configuradas.
   - `ACADEMIC_ADMIN_MODE=off`.
   - `ACADEMIC_PRODUCTION_ENABLED` ausente o distinto de `true`.
3. Retirar/rotar el `OIDC_SMOKE_TOKEN` anterior y generar uno nuevo en un gestor de secretos, nunca en el repositorio. No guardar el valor en la shell history, tickets, capturas ni evidencia.

### 6.2 Desplegar el mecanismo temporal

Solo con autorización de deploy Production. Debe desplegarse la corrección #45 (no la versión #44 que produjo el 502). El deploy debe ser reversible y quedar registrado con commit SHA y deployment ID. No cambiar el dominio de Pages.

### 6.3 Ejecutar el smoke

Con `OIDC_SMOKE_TOKEN` cargado desde el gestor de secretos como variable de entorno:

```sh
curl -sS --fail-with-body --max-time 30 \
  -X POST 'https://optilab-api.vercel.app/api/internal/oidc-smoke' \
  -H "Authorization: Bearer ${OIDC_SMOKE_TOKEN}" \
  -H 'content-type: application/json' \
  --data ''
```

No agregar query string, cuerpo JSON, parámetros de proyecto, service account, audiencia ni issuer. La función no acepta parámetros.

### 6.4 Resultado esperado

```json
{
  "ok": true,
  "checks": {
    "oidcToken": "PASS",
    "signature": "PASS",
    "claims": "PASS",
    "sts": "PASS",
    "impersonation": "PASS",
    "accessToken": "PASS",
    "academicBackend": "CLOSED"
  },
  "claims": {
    "issuer": "https://oidc.vercel.com/optilab",
    "audience": "https://vercel.com/optilab",
    "projectId": "prj_...",
    "environment": "production",
    "subject": "owner:optilab:project:optilab-api:environment:production"
  },
  "accessTokenExpiresInSeconds": 3599,
  "checkedAt": "2026-..."
}
```

El valor de `projectId` debe coincidir con `VERCEL_PROJECT_ID`; no es un token. `accessTokenExpiresInSeconds` debe ser mayor que 0 y no superar 3600.

## 7. Pruebas negativas obligatorias

Ejecutarlas durante la misma ventana, sin parámetros ni cuerpos:

| Prueba | Resultado esperado |
|---|---|
| Sin `Authorization` | `401 OIDC_SMOKE_UNAUTHORIZED` |
| Secreto incorrecto | `401 OIDC_SMOKE_UNAUTHORIZED` |
| `GET` en vez de `POST` | `405 OIDC_SMOKE_METHOD` |
| Query string | `400 OIDC_SMOKE_BAD_REQUEST` |
| Cuerpo no vacío | `400 OIDC_SMOKE_BAD_REQUEST` |
| Endpoint en Preview | `404 OIDC_SMOKE_DISABLED` o `401` de Deployment Protection; nunca `200` |
| Backend académico antes/después | `503 ACADEMIC_DISABLED` |

No se deben usar tokens reales manipulados contra Vercel: manipular un JWT no demuestra la validación de firma y podría confundirse con un fallo de infraestructura. La cobertura criptográfica local ya existe en `tests/academic/vercel.test.ts` con un JWT/JWKS de prueba.

## 8. Criterios PASS/FAIL

Las pruebas locales son **130/130 PASS**; no sustituyen el smoke real.

### PASS

- La corrección #45 está desplegada y el smoke se habilitó con un secreto nuevo.
- Un único `200` con los siete estados esperados.
- `academicBackend: CLOSED`.
- Expiración del access token entre 1 y 3600 segundos.
- Las pruebas negativas devuelven los códigos esperados.
- El backend académico responde `503` antes y después.
- La respuesta no contiene `access_token`, `Authorization`, JWT, cabeceras ni secretos.
- No se observan escrituras en Firestore/Auth.

### FAIL

- Cualquier `200` sin todos los estados.
- `404` durante la ventana autorizada significa que el smoke no está habilitado o que Production aún ejecuta la versión #44 sin corrección.
- `502 OIDC_TOKEN_UNAVAILABLE` significa que no se obtuvo la cabecera OIDC; revisar que Production ejecute #45 y que la cabecera llegue al handler.
- `OIDC_TOKEN_UNAVAILABLE`: no se obtuvo el token OIDC de Production.
- `OIDC_TOKEN_INVALID`: JWKS/firma/issuer/audiencia.
- `OIDC_CLAIMS_MISMATCH`: subject, project, environment o audiencia.
- `STS_REJECTED`: intercambio STS rechazado; revisar proveedor/condiciones.
- `IAM_IMPERSONATION_REJECTED`: falta `roles/iam.workloadIdentityUser` o restricción de la service account.
- `GOOGLE_NETWORK_ERROR`: error de red o servicio; no reintentar a ciegas.
- `ACCESS_TOKEN_INVALID`: token vacío, expirado o sin expiración válida.
- Cualquier respuesta con material sensible.
- Cualquier cambio en el backend académico distinto de `503`.

## 9. Evidencia permitida

Guardar en un archivo privado, nunca en GitHub:

- Fecha/hora UTC, commit SHA y deployment ID.
- Código HTTP y cuerpo JSON sanitizado del smoke.
- Códigos HTTP de las pruebas negativas.
- `503 ACADEMIC_DISABLED` antes/después.
- Confirmación de ausencia de patrones `access_token`, `Authorization`, `Bearer`, `eyJ` y del secreto.
- Resultado de `git diff`/revisión sin secretos.

No guardar: `OIDC_SMOKE_TOKEN`, `Authorization`, JWT, respuestas de Google, cabeceras crudas, correos, UIDs ni datos de alumnos.

## 10. Rollback

1. Eliminar `OIDC_SMOKE_TOKEN` de Production y poner `OIDC_SMOKE_ENABLED=false` o eliminar ambas variables.
2. Desplegar de nuevo solo si Vercel exige el redeploy por el cambio de variables.
3. Revertir el commit temporal y volver al deployment Production anterior.
4. Verificar `POST /api/internal/oidc-smoke` → `404`, y backend académico → `503`.
5. Rotar/eliminar el secreto.
6. No se requiere limpiar Firestore/Auth porque el smoke no escribe.
7. Mantener `ACADEMIC_ADMIN_MODE=off` y no tocar `ACADEMIC_PRODUCTION_ENABLED`.

Si algo falla antes de la invocación, no ejecutar el smoke y volver al deployment anterior.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Nuevo endpoint público | Deshabilitado por defecto; secreto Sensitive independiente de 32+ bytes; sin CORS; sin parámetros; se elimina después |
| Exposición de tokens | No se devuelven; no se registran; `Cache-Control: no-store`; errores sanitizados |
| Escrituras accidentales | No importa Firestore/Auth; sin bootstrap; sin datos |
| Reutilización del gate académico | Gate `OIDC_SMOKE_*` separado; exige `ACADEMIC_ADMIN_MODE=off` |
| Deploy Production accidental | Preparación no despliega; ejecución requiere autorización explícita y rollback |
| Error de red/STS/IAM | Fallo cerrado con código de etapa; no se reintenta automáticamente |
| Secreto en logs/capturas | Generación en gestor; no guardar evidencia con secretos; rotar al terminar |

## 12. Qué debe autorizar exactamente el operador

Para ejecutar el smoke:

1. **Despliegue temporal del commit de smoke en Production.**
2. **Alta de `OIDC_SMOKE_ENABLED=true` y `OIDC_SMOKE_TOKEN` Sensitive en Production**, solo durante la ventana.
3. **Una invocación autorizada** y las pruebas negativas indicadas.
4. **Retiro inmediato** de variables, endpoint y deployment temporal.
5. **Confirmación de que el piloto académico sigue cerrado**; esto no autoriza activarlo.

Hasta esa autorización, la decisión es **NO-GO para ejecutar** y **GO para revisar la PR Draft**.
