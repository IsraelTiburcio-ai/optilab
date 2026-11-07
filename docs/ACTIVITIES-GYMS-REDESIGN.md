# Administración de gimnasios

La PR #50 parte del merge de #49 (`64ad83cd`) y conserva su publicación por enlace, allowlist y apertura externa de Wordwall sin embed validado. No cambia el catálogo de 28 juegos, las mecánicas, el progreso ni los criterios de evolución.

## Flujo docente

Panel → grupo autorizado → **Gimnasios** → selector de un gimnasio → **+ Agregar actividad**. El formulario preselecciona grupo y gimnasio, deriva proveedor/título a partir del enlace público y permite publicar o guardar un borrador. Descripción e instrucciones son opcionales.

Una lista mezcla originales y recursos externos. Arrastre y botones Subir/Bajar (también utilizables con teclado) preparan cambios locales. Visibilidad original y externa se confirman con el mismo guardado. Cada fila identifica cambios pendientes. Restaurar orden no publica borradores ni vuelve a mostrar actividades ocultas.

Cambiar de gimnasio, sección, grupo o seguir un enlace con cambios pendientes ofrece guardar, descartar o seguir editando. Un error deja los cambios disponibles. Atrás/Adelante usa el bloqueo nativo de React Router (`createHashRouter`/`useBlocker`), conservando las URLs hash y el mismo diálogo. La recarga/cierre usa la advertencia del navegador. La Biblioteca es secundaria: edición, vista previa, recuperación de borradores y archivo de recursos; no reproduce las cinco columnas.

## Persistencia y concurrencia

Se conserva `courses/{courseId}/terms/{termId}/groups/{groupId}/gymLayouts/{gymId}` con `orderedActivityIds`, `hiddenOriginalGameIds`, `revision`, `updatedBy` y `updatedAt` (schemaVersion 1).

`saveGymLayout` admite además `externalVisibility: [{activityId, expectedVersion, visible}]` como entrada opcional compatible con clientes anteriores. Orden, visibilidad original y cambios de estado externo se escriben **en una sola transacción**, después de comprobar permisos, revisión de layout y revisión de cada asignación externa. Los recursos ocultos recuperan su revisión ya publicada; un borrador requiere publicación explícita desde el editor. Una edición concurrente devuelve 409 sin sobrescribirla. Los reintentos del mismo payload conservan la clave idempotente, incluso ante una respuesta perdida.

El orden predeterminado conserva las publicaciones de #49 (`activityPlacements`) antes de añadir recursos sin posición. Si otra docente actualiza entre el guardado y la lectura posterior, se muestra la configuración leída y se avisa; no se convierte el estado visual anterior en un nuevo borrador sobre una revisión más reciente.

El historial y las revisiones publicadas nunca se borran. Tras guardar un borrador y fallar su publicación, editar el enlace conserva el activityId y la revisión guardada; cambia la clave de la nueva revisión. Reintentar sin cambios conserva las claves originales.

Las asignaciones se consultan una sola vez por grupo (con páginas de 50), y se reutilizan en las cinco proyecciones. Los recursos y definiciones también se paginan; se rechaza la carga al alcanzar 20 páginas completas, en vez de mostrar datos truncados silenciosamente. No se agregan índices ni Rules.

## Alumno y política de publicación

- Carga, error, selección de contexto y configuración correcta son estados explícitos. Un error de API no expone todo el catálogo como sustituto.
- Con varias matrículas activas, el alumno elige **Contexto académico** antes de ver actividades. La elección se guarda por cuenta en sessionStorage; si no está disponible, funciona en memoria. Cada respuesta queda ligada a la sesión y se aborta al cambiar de cuenta. Nunca se combinan layouts de diferentes grupos.
- Una actividad externa oculta devuelve 404 también en su ruta directa mediante la API autorizada.
- Los enlaces de juegos originales desde el grupo llevan curso/periodo/grupo. Se comprueba acceso/publicación antes de montar el jugador. Eliminar ese contexto lleva al catálogo público independiente: ocultar una tarjeta académica no convierte un juego público en contenido privado.
- Los dos complementos públicos preexistentes aparecen solo en el catálogo personal, sin grupo seleccionado. No se agregan fuera del layout docente ni se muestran como sustituto ante errores. La docente puede asignar esos mismos enlaces mediante el editor.
- OptiDex y el historial personal conservan los 28 originales. Progreso, insignias y evoluciones mantienen sus criterios históricos; ocultar todos los originales no concede una insignia. Las rutas nuevas filtran tarjetas ocultas del contexto elegido; una ruta personal guardada no se borra.

## Verificación reproducible

```sh
npm run test:academic       # Auth + Firestore Emulator, demo-optilab-sync
npm run typecheck:academic
npm run build
npm run pilot:preflight
TEACHER_BROWSER=chromium npm run test:teacher
TEACHER_BROWSER=webkit npm run test:teacher
```

La suite docente requiere `MEMORAMA_DIR` apuntando al fixture local fijado en `7a58545df7d3a657e85c2a87091f3277cdae97c0`, como en CI. Nunca usa cuentas ni proyectos de producción. El preflight normal comprueba CORS y rechazo anónimo públicos; puede ejecutarse solo localmente con `runPreflight({remote:false})`.

Cobertura: publicación por enlace, recuperación tras fallo/editado, guardado atómico, respuesta perdida, CAS concurrente, permisos, grupo ajeno intacto, carga fallida, multigrupo, progreso, rutas académicas ocultas, persistencia tras recarga y responsive 390/820/1180/1440 con Axe. El arrastre nativo se prueba en Chromium; WebKit valida la alternativa de botones y marca explícitamente ese caso de arrastre como omitido.

## QA manual previo a publicación

1. En entorno autorizado de QA, publicar una LearningApps pegando solo su enlace en Gimnasio 3; revisar título, grupo y vista previa.
2. Mezclarla con originales, ocultar una original, guardar y comprobar el resultado como alumno tras recargar. Repetir en móvil táctil con Subir/Bajar.
3. Editar desde dos sesiones docentes: confirmar que la segunda conserva su borrador al recibir 409 y permite descartar/recargar.
4. Confirmar la apertura real del proveedor externo (las pruebas automáticas usan fixtures, no certifican su disponibilidad pública).

La API debe incorporar el contrato de #50 antes del frontend correspondiente. No ejecutar migraciones, despliegues, Sync productivo, Rules, IAM ni servicios pagados como parte de esta revisión.
