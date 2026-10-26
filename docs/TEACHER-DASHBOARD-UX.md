# UX docente · Mis grupos y traslados guiados (#5)

Base obligatoria verificada: main `4faa60018335764207e9b96bb43741135a30d8bd`. Rama `feat/teacher-dashboard-ux`, PR nueva, sin merge/despliegue autorizados. Solo UX, pruebas y documentación: **backend académico, autorización, Rules/índices, inscripción automática, onboarding, progreso y juegos no se modifican**.

## Experiencia

### Mis grupos

`#/docente` abre **Mis grupos**, no tres selectores de IDs. Tarjetas agrupadas por asignatura y semestre/ciclo, orden natural por sus títulos reales del API. Cada una ofrece **Administrar grupo**. No nombres/calendario UNAM inventados ni totales de alumnos sin consultar. Los IDs solo son claves/valores internos, no texto principal.

Descubrimiento `myScopes(kind:teacher,limit:20,cursor)` con **Cargar más grupos**, sin asumir que la primera página es todo. Abrir un grupo carga su roster; hay Alumnos e Invitaciones y el historial secundario heredado. **← Mis grupos** vuelve al directorio, desmontando las listas privadas del grupo. El roster compacto y Ver más se conservan.

### Crear un semestre y grupo

**Crear grupo** abre un flujo guiado:
1. Curso autorizado (asignatura). Puede consultar más cursos/grupos si faltan páginas.
2. Periodo existente (semestre/ciclo escolar), paginado, o **Crear un periodo nuevo** si la capacidad lo permite. Nombre escrito por la profesora, sin fechas/nombres prefijados. Confirmación de `createTerm`.
3. Nombre del grupo y resumen de curso/periodo → **Revisar nuevo grupo** → confirmar `createGroup`.

El periodo creado se recupera por API, aunque esté después de las primeras20 filas. El grupo confirmado se busca mediante descubrimiento paginado y aparece en Mis grupos sin recargar manualmente; recarga posterior conserva ambos. No se pinta un grupo optimista ni se infiere una autorización a partir del formulario. Si el write se confirmó y una lectura falla, se informa actualizar sin volver a crear. No se crean cursos ni se asignan otros docentes. Capacidades denegadas se explican y siguen siendo verificadas por backend.

### Mover de grupo

Cada alumno activo tiene **Mover de grupo**. Modal nativo accesible **¿A qué grupo deseas mover a este alumno?** muestra nombre, grupo actual, destinos como tarjetas/radios, Cancelar y Confirmar traslado.

Solo destinos cargados autorizados con manageMembers del mismo curso/periodo, excluyendo origen. **Cargar más grupos destino** consulta las páginas restantes dentro del modal; no se interpreta falta de opciones en primera página como falta global de permisos.

El botón confirma directamente `transferMembership` con UID/revisión reales del roster, destino validado y clave UUID idempotente. No hay un segundo modal ni éxito optimista. Un lock síncrono bloquea doble envío; error de red/429/5xx conserva payload/clave y bloquea selección de otro destino durante el reintento.409 bloquea confirmar con la versión obsoleta: **Actualizar alumnos y cerrar**, luego nueva intención con revisión fresca.403/401 pide revisar acceso. Origen se refresca tras ACK; destino se consulta de nuevo al abrirlo, sin lista cacheada que invente el resultado. Auditoría, baja de origen y conservación de progreso/historia las realiza el backend existente.

Foco inicial en Cancelar, trap nativo, Escape cancela cuando no hay envío en curso, retorno al botón del alumno; si ya desapareció por cambio confirmado, retorno al área/notificación. Se enfoca explícitamente el botón iniciador porque Safari/WebKit no lo hace siempre al pulsar con ratón. Cerrar sesión/cambiar UID desmonta el panel, aborta callbacks y borra selección, errores, datos e intenciones.

## Mac: reutilizar sin perder datos

Node22/Java21. En la carpeta del repositorio:

```sh
git fetch origin
git switch feat/teacher-dashboard-ux
git pull --ff-only
npm ci
```

Conservar Auth9099, Firestore8085, API5200 y Vite5195 ya activos en el modo académico demo. **No hace falta reiniciar el backend**: el contrato permanece intacto. Vite recarga el frontend de esta rama; recargar el navegador para iniciar el directorio limpio. No detener/limpiar emuladores ni fixtures. Si falta un proceso local, usar las instrucciones existentes `npm run emulators:sync`, `npm run academic:dev` y `npm run dev:academic-ui` en terminales separadas. Los launchers detectan puertos ocupados, no los liberan por la fuerza. No mezclar entorno Firebase real.

Entrar en **http://127.0.0.1:5195/optilab/#/cuenta** con los correos/contraseña sintéticos que ya tiene el propietario y abrir **http://127.0.0.1:5195/optilab/#/docente**.

### QA manual pendiente del propietario

- teacherA: solo A; teacherB: solo B, sin creación si no tiene capacidad; teacherBoth: ambos; alumno: sin acceso docente.
- teacherBoth → Administrar A → elegir alumno → Mover de grupo → cancelar/Escape: sin cambios y foco restaurado. Repetir confirmando B: origen inactivo/destino activo al abrirlo.
- Mis grupos → Crear grupo → curso → periodo nuevo con nombre ficticio propio → confirmar → grupo → revisar/confirmar → tarjeta nueva; recargar y comprobar.
- Probar destinos/páginas, revisión obsoleta, baja e invitación automática existente. No volver a solicitudes como mecanismo normal de inscripción.
- 390/820/1180/1440, teclado, lector/labels y roster compacto; logout/A→B sin datos anteriores.

No publicar credenciales, enlaces de invitación, UID, IDs de fixtures o capturas con secretos. No se declara este QA aprobado hasta confirmación explícita del propietario.

## Evidencia repetible

Se mantiene CI académico (70 pruebas) y las suites Auth/Rules/sync. UI pasa de54 a **65 casos por navegador**: los54 existentes adaptados a la navegación y11 nuevos de directorio/traslado/creación/paginación/foco. HTTP/Auth/Firestore Emulator reales; solo fallas de transporte se inyectan para ACK perdido. Se verifica un traslado entre27 grupos con destino fuera de la primera página, sin aprobación ni grants cliente.35 regresiones de aventura/entrenadores/evoluciones y gate productivo existentes se reutilizan.

Comandos estándar: `npm run build`, `npm run typecheck:academic`, `npm run test:academic`, `npm run test:teacher`, `TEACHER_BROWSER=webkit npm run test:teacher`, gates `test:sync:production`. Wrappers de emuladores solo con sus puertos libres. Con procesos del propietario activos: entorno explícito de ACADEMIC-ADMIN.md + `TEACHER_REUSE_VITE=1 npm run test:teacher:ui` (opt-in local, no CI), backend de tests en loopback efímero, nunca toma5200 ni borra fixtures.

La primera ejecución nueva WebKit detectó foco no restaurado tras clic de ratón; se corrigió el iniciador y la suite completa local pasó65/65. No se oculta esa ejecución inicial ni se reporta como verde. Resultados de Chromium/CI del HEAD final se registran en la PR, sin rehacer suites por cambios puramente documentales.

Capturas sintéticas: [Mis grupos](qa/teacher-dashboard-ux/mis-grupos.png), [crear periodo](qa/teacher-dashboard-ux/crear-periodo.png), [crear grupo](qa/teacher-dashboard-ux/crear-grupo.png), [traslado](qa/teacher-dashboard-ux/mover-grupo.png). No incluyen IDs/tokens visibles ni datos reales; no equivalen a QA físico.

#5 continúa abierto; políticas reales, alojamiento, privacidad/retención y puertas productivas #3/#4 pendientes. No backend/Pages/Rules/índices, Auth/datos reales, IAM, billing/Blaze/Vercel, adjuntos, editor, estadísticas, rankings ni repositorios externos modificados/desplegados.
