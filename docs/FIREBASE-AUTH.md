# Firebase Authentication · fase 01 · PR de revisión

Relacionado con [issue #2](https://github.com/IsraelTiburcio-ai/optilab/issues/2), dentro del [EPIC #1](https://github.com/IsraelTiburcio-ai/optilab/issues/1). Estado: implementación, QA automatizado y QA manual real reportado PASS por el propietario; revisión final y autorización de publicación pendientes. **No fusionar ni desplegar sin autorización.**

Entrega: **[PR #11](https://github.com/IsraelTiburcio-ai/optilab/pull/11)**, base `main`, rama `feat/firebase-auth`. Las capturas de revisión son del emulador. El reporte real del propietario, revisión de seguridad y plan de rollout/rollback están en [AUTH-RELEASE-REVIEW.md](AUTH-RELEASE-REVIEW.md).

## Implementado

- Firebase JavaScript SDK modular, inicialización única de App/Auth y carga del cliente en chunk separado.
- `AuthProvider` independiente de `ProgressProvider`; no reinicia, importa ni remonta el progreso por UID.
- `#/cuenta`, acceso Cuenta en navegación superior/inferior y enlace desde Mi aventura.
- Google por popup iniciado directamente por gesto del usuario.
- Registro/login con correo y contraseña, envío/reenvío de verificación, comprobación actualizada de correo, recuperación y logout.
- Persistencia de sesión mediante Firebase SDK; fallback temporal a memoria si el navegador bloquea almacenamiento.
- Mensajes de error en español, recuperación con respuesta genérica y modo invitado.
- Interfaz con entrenador/OptiCriatura actuales y declaración explícita de que el progreso todavía no se sincroniza.

No hay importación de `firebase/firestore`, escrituras de documentos, cambios de reglas, roles o estadísticas competitivas. Los tickets de esas capacidades siguen abiertos y separados.

## Configuración pública y validación pendiente

Proyecto indicado por el propietario: `optilab-cd829`, app `OptiLab Web`.

| Variable | Valor recibido / estado |
|---|---|
| `VITE_FIREBASE_API_KEY` | Configurada en Repository Variables y aceptada por Authentication; no se publica su valor en esta documentación |
| `VITE_FIREBASE_AUTH_DOMAIN` | `optilab-cd829.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `optilab-cd829` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `optilab-cd829.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `401863964479` |
| `VITE_FIREBASE_APP_ID` | `1:401863964479:web:55365cb9445f026075058a` |

Inicialmente solo estaban los cinco valores proporcionados y el endpoint público de Hosting no suministró la key (404). Después el propietario configuró la API key en GitHub. Se comprobaron las seis variables y la consulta pública de Authentication respondió HTTP 200, con proyecto numérico `401863964479` y dominios autorizados `localhost` e `israeltiburcio-ai.github.io`, entre otros. `127.0.0.1` no está autorizado. No se inventó ni se expone una key en esta documentación.

Se probó también la inicialización y recarga de una sesión invitada local con configuración real, sin emulador: `optilab-v1` intacto, cero solicitudes Firestore y ninguna creación de cuenta ni envío de correo por el agente. Después, **el propietario reportó PASS en Google y los flujos reales de correo**: [checklist y resultados](QA-AUTH-REAL.md). La verificación llegó a Spam y se completó correctamente; no se oculta esa observación.

### Configuración local y futuras actualizaciones de la key

1. Firebase Console → Configuración del proyecto → Tus apps → **OptiLab Web** → configuración SDK → copiar **`apiKey` web pública**.
2. La Repository Variable `VITE_FIREBASE_API_KEY` ya existe. Si se actualiza, usar GitHub → `IsraelTiburcio-ai/optilab` → Settings → Secrets and variables → Actions → **Variables**, o:

```sh
gh variable set VITE_FIREBASE_API_KEY --repo IsraelTiburcio-ai/optilab
```

El comando solicita el valor de manera interactiva. No proporcionar contraseñas, tokens personales ni JSON de service account. La configuración web está incluida por diseño en el bundle; no es una credencial administrativa y no sustituye reglas de autorización.

3. Verificar en Firebase Authentication que Google/correo están habilitados y el dominio `israeltiburcio-ai.github.io` está autorizado, según los datos recibidos.
4. Para QA local real, autorizar `localhost`/`127.0.0.1` si no están incluidos. No se cambió esa configuración desde esta ejecución.

### Local

```sh
cp .env.example .env.local
# Completar VITE_FIREBASE_API_KEY en .env.local
npm ci
npm run dev
```

`.env.local` queda ignorado. Reiniciar Vite tras cambiar configuración. Si faltan campos o hay una URL de emulador inválida, la UI conserva el modo invitado y explica que las acciones de cuenta no están habilitadas.

### GitHub Actions

El workflow de Pages lee las seis `vars.VITE_FIREBASE_*` durante `npm run build`. Mantiene su condición original: push a `main` o dispatch explícito. **Empujar esta rama o abrir la PR no despliega Pages.** No se invocó un dispatch.

`auth-ci.yml` comprueba PRs con token de solo lectura, proyecto `demo-` y emulador local; no usa datos de producción ni despliega. Tras configurar una variable se necesita construir de nuevo para incorporarla, pero la PR continúa bloqueada hasta revisión manual y autorización de merge/despliegue.

## Popup, móviles y Safari

Se usa `signInWithPopup` desde un botón explícito y con Firebase ya inicializado. No se antepone una espera de red a la apertura. No se fuerza redirección automática al bloquearse el popup.

- Si se bloquea: permitir ventanas emergentes para el sitio y pulsar otra vez; usar un navegador completo si se está en un navegador embebido, o correo/contraseña si se configuró ese método.
- Si se cierra: se informa sin borrar la aventura ni repetir intentos automáticamente.
- No se enlazan cuentas de proveedores diferentes de manera silenciosa.
- No se añadió `signInWithRedirect` como fallback automático: en GitHub Pages con un authDomain de otro origen sus helpers pueden depender de almacenamiento de terceros bloqueado por Safari. Una alternativa por redirección requeriría revisar dominio/proxy y validar retorno bajo HashRouter antes de prometerla.

WebKit automatizado cubre restricciones básicas. Google real tiene reporte manual PASS; Safari iOS físico y el dominio público continúan pendientes.

## Persistencia, privacidad y límites de esta fase

Firebase administra la sesión y su renovación. La aplicación solo expone a su UI UID, correo, nombre de proveedor, verificación y proveedores. No guarda contraseñas, JWT, refresh tokens ni códigos de correo en un almacenamiento propio ni los imprime en logs.

Se verifica disponibilidad de `localStorage` de forma **solo lectura**, porque el SDK puede resolver `setPersistence` sin comprobar acceso al no haber una sesión. Si falla, se selecciona `inMemoryPersistence` y se comunica que la sesión es temporal. No se limpian claves ni se escribe una clave de sondeo.

`optilab-v1` no cambia de esquema ni de comportamiento. Entrar, recargar o salir conserva su contenido. **El perfil local todavía es común a ese navegador, también al cambiar de cuenta; no hay aislamiento/importación remota ni sincronización implementados.** Esa migración corresponde a #4 y requiere reglas de #3. Esta limitación se explica en la pantalla.

El invitado no crea automáticamente una cuenta Firebase anónima. Verificar el correo actualiza el usuario y solicita al SDK renovar su token; el token no se manipula manualmente. La cuenta sin verificar no pierde acceso al material que ya es accesible como invitado.

Firebase Auth almacena los datos de cuenta necesarios para los proveedores; no se crea un documento `users/{uid}` en Firestore. Política completa de retención, eliminación y visibilidad de ranking se resolverá antes del lanzamiento Cloud en #10. No se anuncian grupos, nube sincronizada o liga funcional en esta PR.

## QA ejecutado

- Build TypeScript/Vite: PASS, incluida carga separada de Cuenta y cliente Auth.
- `npm audit --omit=dev`: sin vulnerabilidades reportadas en la ejecución.
- Regresión: **66 PASS en suite general**, cuatro pruebas públicas opt-in omitidas; la comprobación HTTP externa falló inicialmente por timeouts/ECONNRESET y pasó al repetirse sola: **28/28 HTTP 200**. No se modificó la prueba para ocultarlo.
- Auth Emulator + SDK real: nueve casos cubiertos en Chromium, con repetición exitosa del caso de almacenamiento restringido tras corregir su detección; nueve casos WebKit PASS en ejecución completa.
- Modo sin configuración y validadores: seis casos Chromium y seis WebKit PASS.
- Registro, verificación mediante código OOB del emulador, sesión persistente, logout, recuperación y acceso con nueva contraseña; OAuth Google **simulado por el emulador**, popup bloqueado, errores de credenciales/red y almacenamiento bloqueado.
- Comparación literal de `optilab-v1` antes/después y comprobación de cero solicitudes a Firestore en el flujo probado.
- Formularios login/registro/recuperación y Axe A/AA a 390×844, 820×1180, 1180×820 y 1440×900; menú móvil en una sola fila.
- Capturas en `docs/screenshots/auth/`: **emulador con datos sintéticos, no acceso de producción**.
- En CI WebKit se detectó una auditoría de contraste durante la opacidad transitoria de la entrada RPG. La prueba de invitado ahora solicita movimiento reducido antes de cargar, igual que las demás auditorías de cuenta, para medir la vista estable sin excluir reglas Axe.

### Reproducir Auth sin usar el proyecto real

```sh
npx playwright install chromium webkit
npx --yes firebase-tools@15.0.0 emulators:exec --only auth --project demo-optilab-auth --config firebase.auth-emulator.json "npm run test:auth -- --browser chromium"
npx --yes firebase-tools@15.0.0 emulators:exec --only auth --project demo-optilab-auth --config firebase.auth-emulator.json "npm run test:auth -- --browser webkit"
npx playwright test tests/account-guest.spec.ts tests/auth-config.spec.ts
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npm test
npm run build
```

Solo se inicia Auth Emulator, sin Java/Firestore ni cambios al proyecto real. La configuración `demo-optilab-auth` y su key de prueba son fixtures explícitos; **no se usan como sustituto de la API key de producción**. El SDK rechaza el emulador en builds de producción, con proyectos no `demo-` o URLs no loopback HTTP.

Firebase 12.19.0 y sus componentes App 0.16.2/App Compat 0.5.18 se fijaron por compatibilidad con Node 22; Firebase 13.1.0 resolvía componentes que requieren Node 24.12. Se fijó además `@grpc/grpc-js` 1.14.6 para resolver el aviso transitivo del paquete SDK completo. Esta fase solo importa App/Auth, no Firestore/compat en el bundle. Firebase CLI se ejecuta como herramienta de pruebas versionada, no dependencia de producción.

## Checklist de revisión y despliegue

- [x] API key web real y cinco valores restantes comprobados; inicialización local de lectura validada.
- [ ] Build/entorno de revisión autorizado para comprobar el dominio publicado, sin desplegar por inferencia.
- [x] Google real y persistencia/recarga/logout: PASS informado por el propietario en QA local.
- [x] Correo real: registro y envío/verificación PASS informado por el propietario; llegó a Spam.
- [x] Recuperación real: PASS informado por el propietario.
- [x] `optilab-v1` intacto: comparación exacta `true` informada por el propietario.
- [x] Network Keep log: 0 solicitudes Firestore durante recarga/navegación según el propietario.
- [ ] Revisar restricciones del API key, dominio y plantillas de correo sin añadir privilegios administrativos.
- [ ] Safari/iPhone/iPad físicos cuando estén disponibles.
- [ ] Aprobar explícitamente la PR y el despliegue; no fusionar solo por CI verde.

El agente comprobó configuración/arranque de lectura y automatización; el propietario ejecutó y reportó las pruebas interactivas reales. No se desplegó ni fusionó nada. La prueba en el dominio público y los dispositivos físicos no se declaran realizadas; requieren la ventana de publicación y el seguimiento descritos en el plan de despliegue.

Las suites automatizadas no usan la key del `.env.local` del propietario: la general fuerza modo sin configurar y la Auth usa solo el proyecto demo del emulador. No se modifica ni borra el archivo local.
