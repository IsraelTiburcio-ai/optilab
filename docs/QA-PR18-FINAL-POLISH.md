# PR #18 · Mis clases, historial y roster compacto

Referencia previa: `2ba8a01860624d91d64f36b057773a1d171decc3`. Ajustes sobre la misma PR/rama, sin merge ni despliegue. No cambia la política de alta directa de la enmienda A del ADR-003.

## QA manual informado por el propietario (versión previa)

Confirmados en Mac/emuladores/API local: generar enlace docente; acceso del alumno por enlace; login/bienvenida; nombre/gamertag/entrenador/OptiCriatura; correo verificado; ocultación de accesos docentes. Roster PASS informado por el propietario. Un enlace caducó durante una prueba y después se confirmó el flujo exitoso. No se publican credenciales, UID, enlaces ni identificadores de invitación.

Ese reporte no aprueba manualmente **estos nuevos ajustes**. Las pruebas automatizadas siguientes y el QA manual pendiente se distinguen explícitamente.

## Cambios

- **Mi aventura → Mis clases**, solo autenticados y con el gate emulado existente. Usa únicamente `myScopes(kind:student)`, sin enlace/token ni otra fuente de autoridad. El API agrega curso/periodo reales dentro del mismo snapshot autorizado; campos faltantes se muestran no disponibles, nunca como IDs o nombres inventados. «Inscrito» solo para estado activo devuelto; bajas se muestran inactivas y transferencias dejan el origen inactivo/destino inscrito.
- Páginas de20 y controles propios. Un vacío total muestra «Todavía no perteneces a un grupo de clase»; una página vacía con más cursores se describe como tal, sin fingir ausencia global. Botón «Actualizar mis clases» y reconsulta al volver al foco, sin listeners Firestore ni mezcla con progreso. Subtree por UID y AbortController cancelan respuestas antiguas en logout/A→B.
- **Solicitudes fuera de la navegación/contadores cotidianos.** Historial secundario cerrado por defecto, cargado solo al abrirlo. Explica el mecanismo antiguo y que las nuevas matrículas son automáticas. `groupRequests` agrega estado efectivo de pertenencia; un pendiente histórico cuyo alumno ya tiene matrícula activa se etiqueta «Ya inscrito», sin aprobar/rechazar como tarea. No se actualiza, borra ni migra ningún documento histórico automáticamente. La resolución manual heredada sigue en el historial para compatibilidad.
- **Roster compacto:** nombre + estado, una línea corta de gamertag/entrenador/criatura y correo cuando el API lo proporciona. Campos de juego no compartidos: «—». Verificación, fecha de Auth, notas/ausencias, revisión y UID quedan en «Ver más». Acciones alineadas a la derecha en escritorio y al pie en móvil. Se conservan filtros de página, paginación, permisos, transferencia y baja con CAS; no se agrega el modal ni la remodelación completa de Mis grupos.
- Enlace no disponible: **«Este enlace de invitación ya no está disponible. Pide uno nuevo a tu profesora»**. Sigue el404 anti-enumeración, sin distinguir públicamente vencido/revocado/inexistente. Tokens/rotación/validación no cambian.

## Verificación automatizada

70 pruebas académicas:68 previas + nombres/estados propios en myScopes y proyección histórica sin mutación.54 UI por navegador:44 previas actualizadas +10 de clases/historial/roster, con HTTP/Auth/Firestore Emulator reales. Se prueban grupos propios y ajenos, vacío, dos grupos, paginación22 matrículas, baja/transferencia, logout/A→B con respuesta retenida y listas de2/5/10 alumnos. Filas cerradas de escritorio verificadas por debajo de180px, datos secundarios ocultos y acciones visibles; móvil/Axe sin overflow.

La regresión inicial WebKit expuso una carrera de reapertura: un usuario ya completado podía salir de `unirse` antes de consumir el nuevo enlace. Se corrigió el redirect: `unirse` sin memoria informa reabrir original, y la salida automática de bienvenida comprueba contexto vigente. El caso se repitió de forma dirigida tres veces y pasó; no se presenta como verde la primera ejecución. Se corrigió también un selector relativo del test de historial, sin cambiar los registros.

CI mantiene Auth, Rules, sync,35 regresiones de aventura/entrenadores/evolución y gate productivo en ambos navegadores (incluido el chunk MyClasses). Resultados exactos del HEAD final se registran en la PR; no repetir todas las suites por cambios exclusivamente documentales.

Capturas sintéticas sin identificadores técnicos: [Mis clases](qa/final-polish/mis-clases.png), [10 alumnos](qa/final-polish/roster-10-desktop.png), [fila móvil](qa/final-polish/roster-movil.png). Son evidencia automatizada, no QA físico del propietario.

## Cómo probar en la Mac existente

En el repositorio/rama `feat/student-enrollment-emulator`: `git pull --ff-only`, `npm ci`. Mantener emuladores/fixtures existentes. Reiniciar únicamente el API previo desde esta rama (`npm run academic:dev`) para recibir títulos/estados ampliados; Vite docente existente puede recargar (`npm run dev:academic-ui` solo si no está activo). No se detienen procesos automáticamente.

1. Abrir `http://127.0.0.1:5195/optilab/#/aventura` con un alumno inscrito: Mis clases muestra nombres reales y «Inscrito», incluso entrando sin el enlace original.
2. Probar otra cuenta sin matrícula: vacío; con dos inscripciones, ambas y paginación si corresponde.
3. Como profesora, dar baja o transferir. Volver a la ventana del alumno o pulsar Actualizar mis clases: no debe conservar un «Inscrito» antiguo. Logout/A→B elimina completamente clases de la cuenta anterior.
4. Docente → Alumnos: revisar2/5/10 filas, campos de juego con «—», correo autorizado y «Ver más». Confirmar filtros/páginas/baja/transferencia igual que antes. Se conservan los nombres literalmente del API: fixtures antiguos con nombres repetidos no se renombran ni se adivinan.
5. Navegación cotidiana sin Solicitudes; abrir Historial de solicitudes anteriores solo para revisión. Un alumno ya inscrito aparece «Ya inscrito» en su registro anterior. No debe haberse aprobado/rechazado/borrado nada automáticamente.
6. Abrir enlace caducado/inválido con un alumno no inscrito: mensaje amigable genérico; no matrícula nueva. Verificar onboarding/gamertag/equipo siguen funcionando.

Bloqueos para merge: confirmación manual de estos ajustes por el propietario y autorización explícita de merge. #5 sigue abierto; puertas productivas #3/#4 y políticas/hosting pendientes. Cero cambios productivos Firebase, Rules, índices, Auth/IAM/billing, backend, juegos o evolución.
