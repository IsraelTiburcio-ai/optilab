# Panel de la profesora v1 · solo emuladores (#5)

**UX docente vigente:** [Mis grupos, creación guiada y traslados](TEACHER-DASHBOARD-UX.md). Sustituye los selectores/transferencia global del panel v1 descritos como historial abajo; reutiliza exactamente los mismos comandos y controles backend.

Base: `f5b30f0773f7efd91508ff4e4274944dd8476829`, PR #16 fusionada. Esta fase agrega interfaz docente, sin merge ni despliegue autorizados. Reutiliza [ADR-003](architecture/ADR-003-academic-administration.md) y [API académica](ACADEMIC-ADMIN.md).

La siguiente fase [STUDENT-ENROLLMENT.md](STUDENT-ENROLLMENT.md) incorpora inscripción visual, enlace local y perfil consentido; sustituye la limitación inicial de código sin pantalla de alumno y amplía la proyección/presupuesto del roster. Los resultados/capturas de este documento corresponden a la fase v1 original.

La revisión actual de PR #18 incorpora «Invita a tus alumnos» y alta automática con correo verificado. Las solicitudes manuales descritas abajo son históricas, no pasos normales del nuevo producto. Accesos docentes solo se muestran tras myScopes autorizado; el alcance de simplificación general siguiente está registrado en #5, sin otra PR implementada.

## Arranque en Mac (Node 22, Java 21, zsh)

En la rama `feat/teacher-panel-emulator`, instalar dependencias una vez:

```sh
npm ci
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
```

**Terminal 1 — emuladores**, únicamente si todavía no están activos para `demo-optilab-sync`:

```sh
npm run emulators:sync
```

**Terminal 2 — API de esta rama**:

```sh
npm run academic:dev
```

**Terminal 3 — preparación explícita de la demostración, una vez por conjunto de fixtures**:

```sh
read -s "ACADEMIC_FIXTURE_PASSWORD?Contraseña sintética (12–100 caracteres): "
export ACADEMIC_FIXTURE_PASSWORD
ACADEMIC_BOOTSTRAP=synthetic-v1 npm run academic:seed:panel
unset ACADEMIC_FIXTURE_PASSWORD
```

Guardar privadamente los correos impresos para `teacherA`, `teacherB` y `teacherBoth`, y recordar la contraseña elegida. No se imprimen tokens ni identificadores de solicitudes/invitaciones. El seed prepara un curso nuevo, dos grupos, seis cuentas sintéticas, un integrante activo y dos solicitudes pendientes en A mediante los handlers existentes. No vacía Firestore ni borra fixtures anteriores. `academic:seed` sigue disponible para un escenario vacío.

**Terminal 4 — frontend**:

```sh
npm run dev:academic-ui
```

Abrir **http://127.0.0.1:5195/optilab/#/cuenta**, iniciar sesión con el correo sintético y la contraseña del seed. Luego usar **Docente** o **http://127.0.0.1:5195/optilab/#/docente**. Ya no hacen falta comandos administrativos para gestionar la demostración.

Puertos: Auth9099, Firestore8085, API5200 y Vite5195, todos loopback. Si un puerto está ocupado, el launcher falla: no detiene ni limpia procesos. Si ya hay un API de la PR #16, **el propietario debe detener únicamente ese API y volver a iniciarlo desde esta rama** para recibir el contrato ampliado; no reiniciar/vaciar emuladores. No reutilizar un Vite viejo sin el gate explícito. No mezclar variables productivas ni editar `.env.local` para habilitar el panel.

## Pantallas y operaciones

- **Selector curso/periodo/grupo:** solamente scopes autorizados; carga adicional por páginas de 20. Títulos e IDs provienen del API. No se deduce acceso por correo/role.
- **Resumen:** integrantes activos, solicitudes pendientes e invitaciones vigentes **en las páginas consultadas**, nunca totales globales ni métricas de rendimiento académico.
- **Alumnos:** activos/inactivos, filtro de página, etiqueta elegida distinguida de identidad verificada, UID necesario, baja y transferencia con confirmación. Solo destinos autorizados cargados del mismo curso/periodo. Cargar más scopes si falta un destino.
- **Solicitudes:** pendientes/aprobadas/rechazadas, aprobación o rechazo confirmado; actualización del roster y estado tras éxito.
- **Invitaciones:** generar/reemitir/revocar, TTL en segundos (1–604800), admisiones y pendientes (1–100); el servidor puede imponer un TTL máximo menor. Usos, pendientes, expiración y versión desde API. Token únicamente en respuesta inicial de creación/reemisión, en memoria mientras permanece esa sección; ocultarlo/cambiar sección/grupo/sesión lo descarta. Copia manual al portapapeles. **No hay enlace de inscripción ni pantalla de alumno que consuma el código**; las solicitudes de la demostración las prepara el seed.
- **Periodos y grupos:** capacidades verificadas, periodos paginados incluso vacíos, creación de grupo dentro del periodo. El creador recibe la asignación predeterminada del backend; no hay creación de cursos ni asignación de otros profesores.

Las listas se actualizan bajo demanda y después de mutaciones. No hay listeners académicos, correos en roster, escrituras administrativas directas a Firestore, Admin SDK en React ni paths arbitrarios. El panel no agrega historia/analíticas/editor; prepara la integración futura #6/#12.

## Ajustes mínimos del contrato

1. `roster` conserva sus campos y agrega **`revision`**, leída de `membershipDetails/{uid}` validado, junto al grant y proyección, **dentro de la misma transacción de solo lectura**. Falta/malformado de detalle falla cerrado. El cliente usa esa revisión como `expectedVersion` para bajas/transferencias, nunca la inventa ni infiere. Consumidores anteriores siguen funcionando.
2. `myScopes` docente agrega `courseTitle`, `termTitle` y capacidades booleanas sanitizadas (`manageMembers/manageInvitations/readHistory/createTerms/createGroups`), comprobadas por la política existente en ese snapshot. Son ayudas de presentación, no nuevos permisos ni autoridad del navegador.
3. `myScopes({kind:'teacher',courseId,limit,cursor})` descubre periodos del curso para creación: `{items:[],periods:[{courseId,termId,title}],nextCursor}`. Requiere staff curso y capacidad `createTerms` o `createGroups`. No expone grupos ajenos. Permite recuperar un periodo vacío tras recargar sin inventar otro endpoint. Máximo 20 por página.

Presupuesto actualizado: roster `6 + 3n` intentos read por página (incluye detalles), sin writes. Con 70 alumnos repartidos en dos grupos de 35 y páginas UI de20, dos recorridos completos/día ≈468 intentos read, no facturación medida. Descubrimiento docente añade comprobaciones de capacidades/metadata; el de periodos usa6 comprobaciones + documentos de la página (mínimo1). Las mutaciones mantienen el presupuesto del backend. Cuotas compartidas con progreso #4; no prometer costo cero de hosting.

## Seguridad de sesión y reintentos

Gate conjunto: DEV + hostname localhost/127.0.0.1 + proyecto exacto demo-optilab-sync + Auth Emulator http://127.0.0.1:9099 + Firestore127.0.0.1:8085 + `VITE_ACADEMIC_ADMIN=emulator`. Fuera del gate no existe la ruta/nav docente, no se solicita su chunk ni se llama al API. Build de producción se prueba incluso con todos los flags emulados presentes. Authentication productivo mantiene su comportamiento.

Una sola sesión: el panel solicita ID token al SDK ya inicializado mediante AuthProvider, verificando UID antes y después. No pide otra contraseña ni almacena/loguea tokens por su cuenta (persistencia interna del SDK Auth existente sin cambios). El cliente vuelve a comprobar sesión antes/después de cada respuesta y combina AbortControllers de sesión/página con timeout. El subtree privado está keyed por UID; logout, fence entre pestañas y A→B descartan listas, secretos, errores, confirmaciones y callbacks anteriores.

Sin éxito optimista. La confirmación crea una intención con UUID idempotente y payload fijo, y un lock síncrono evita doble envío. Ante respuesta perdida/timeout/5xx/429, el botón de reintento conserva exactamente esos datos y clave. Si se cerró expresamente la intención, no asumir éxito: actualizar antes de empezar otra. Un replay de invitación no recupera el token perdido; reemitir. HTTP409 obliga a cerrar/actualizar y usar la revisión nueva; 403/401 actualiza scopes/sesión; 429 informa espera de un minuto. API apagada deja error y botón de recuperación.

## QA manual recomendado (propietario)

1. Sembrar la demostración, entrar como teacherA y abrir Docente: solo A, un activo y dos pendientes en sus páginas.
2. En Solicitudes, cancelar una confirmación y comprobar que nada cambió. Aprobar una y rechazar otra; verificar roster y estados.
3. Crear invitación, copiar privadamente el código y ocultarlo. Cambiar sección/recargar: el token no reaparece. Reemitir y revocar. No pegar secretos/correos/UID/IDs de fixtures en GitHub ni capturas.
4. Dar baja a un activo: queda inactivo sin borrar Auth/progreso. Usar teacherBoth y transferir un activo de A a B; teacherA no debe ofrecer B como destino.
5. Crear periodo y grupo; recargar entre ambas operaciones para comprobar descubrimiento del periodo vacío. teacherB explica que no tiene capacidad de creación.
6. Cerrar sesión con una operación pendiente y entrar como teacherB: ninguna lista/código de A. Probar también logout desde otra pestaña.
7. Detener **solo el API local**, actualizar y comprobar error recuperable; reiniciar API y actualizar. No detener emuladores ni vaciar datos.
8. Probar 390/820/1180/1440, teclado y confirmaciones. Este QA queda pendiente del propietario; las capturas automatizadas no lo sustituyen.

## Verificación automatizada

```sh
npm run build
npm run typecheck:academic
npm run test:academic
npm run test:teacher
TEACHER_BROWSER=webkit npm run test:teacher
npm run test:sync:production
TEACHER_BROWSER=webkit npm run test:sync:production
```

Los wrappers arrancan emuladores propios: usarlos solo con9099/8085 libres. Con emuladores existentes, usar el entorno explícito de `ACADEMIC-ADMIN.md` y ejecutar `npm run test:academic:api` o `npm run test:teacher:ui` (añadir `TEACHER_BROWSER=webkit` para WebKit). El frontend5195 debe estar libre. En UI, la API real se inicia por worker en puerto loopback efímero y las peticiones del navegador a5200 se reenvían allí **solo en el arnés de tests**, conservando Auth, política, transacciones y CORS reales; evita tocar el API5200 del propietario. No se usan fixtures productivos ni clearFirestore.

Cobertura: 53 pruebas académicas (gate/launcher, revisión CAS, periodos/capacidades, seed explícito y suite previa) y 26 casos UI por navegador: actores/ámbitos, operaciones reales, confirmaciones, doble clic, revisión obsoleta, revocación real de staff, respuesta perdida, 429, API apagada/contrato anterior, logout/A→B tardío, limpieza entre pestañas, paginación, responsive/teclado/Axe. El cliente rechaza el contrato anterior sin capacidades/revisiones con un error recuperable que pide reiniciar el API, evitando romper la aplicación. Las fallas de red/429 se inyectan en el transporte; permisos y conflictos se prueban también contra el servicio real. CI docente PR-only agrega Chromium/WebKit y gate de producción; reutiliza CI académico/Auth/Rules/sync existente.

La regresión general local tuvo66 PASS, cuatro opt-in omitidos y un fallo de red externo ECONNRESET en la comprobación HTTP de juegos publicados. Se repitió **solo ese test**, con28/28 HTTP200 y PASS; no se presenta la ejecución inicial como verde. Un caso añadido de pestañas asumía propagación automática del login en WebKit: se corrigió para comprobar logout remoto y login explícito de B, sin modificar Auth ni ocultar la diferencia. Los resultados finales del HEAD y CI se registran en la PR.

Capturas sanitizadas: [alumnos](qa/teacher-panel/alumnos.png), [solicitudes](qa/teacher-panel/solicitudes.png), [invitaciones](qa/teacher-panel/invitaciones.png), [periodos](qa/teacher-panel/periodos.png), [móvil](qa/teacher-panel/movil.png). Sin códigos ni identificadores de fixtures.

## Puertas pendientes

#5 sigue abierto por aceptación manual de UI, políticas reales, alojamiento, IAM/TLS/seguridad y operaciones posteriores. #3/#4 conservan sus autorizaciones productivas pendientes. Siguiente fase funcional: editor de actividades #6/#12, sin implementarlo aquí. Esta PR no autoriza merge, backend/Pages/Rules/índices, servicios pagos ni sincronización productiva.
