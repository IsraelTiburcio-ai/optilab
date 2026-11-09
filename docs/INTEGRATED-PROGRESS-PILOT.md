# Progreso integrado: aceptación controlada

Esta entrega conserva el despliegue ordinario con Sync OFF. No ejecuta despliegues ni cambia autorizaciones existentes. La función integrada requiere `VITE_INTEGRATED_PROGRESS=pilot-v1` y una configuración Sync válida. Las publicaciones manuales existentes incorporan la marca, conservando sus aprobaciones, SHA exacto, Rules vivas, expiración y pausa. El piloto de dos revisores y la sesión individual mantienen sus contratos separados.

> Aviso de versión: este documento describe el piloto original. En la versión de producción general actual, la participación en el ranking es automática para integrantes activos y las preferencias antiguas ya no controlan la inclusión. Consulta [Producción general](GENERAL-PRODUCTION.md) para el comportamiento vigente, los nombres académicos visibles dentro del grupo y el gamertag.

## Datos y compatibilidad

- `reportedAttempts` v1 conserva documentos inmutables por UID; agrega contexto académico opcional exacto y IDs de actividades externas permitidos. Las Rules no convierten ese contexto en autorización: el API verifica matrícula/grupo, documento persistido y recurso asignado. Ningún resultado adquiere validación académica.
- Nuevos documentos de grupo: `participation/{uid}` (hechos monótonos y fechas independientes por señal), `rankingPreferences/{uid}` (consentimiento CAS), `rankingControl/current` (activación docente CAS). Solo el servicio académico escribe estas rutas; los clientes Firebase siguen bloqueados. No se necesitan índices nuevos ni migraciones.
- Las prácticas antiguas conservan su origen sin clasificar; las declaraciones explícitas, finalizaciones comunicadas y validaciones se muestran por separado. Las prácticas y finalizaciones únicas forman el avance, sin doble conteo.
- Solo el LearningApps pznycxd7t21, con URL, origen, ventana y mensaje observados, aporta finalización externa. Wordwall aporta apertura; nunca puntuación inventada. Los recursos externos no otorgan insignias originales.
- El ranking muestra alias autorizado, aperturas distintas y posición; no UID, correo ni puntos. Opt-in independiente, retirada inmediata en la siguiente consulta, empates y lista parcial sin posiciones. Repetir eventos no mejora el conteo. Es participación informada por cliente, susceptible de declaraciones falsas; no rendimiento académico.
- Aventura, intentos y ranking conservan consentimientos independientes. Importación invitada sigue siendo voluntaria. Journals, conflictos, respaldos, restauración y exportación por UID existentes permanecen activos. La proyección académica funciona aunque el ranking esté deshabilitado.
- Las herramientas administrativas existentes inventarían las nuevas proyecciones/preferencias por su UID y las incluyen en el plan de exportación/borrado sujeto a revisión; este desarrollo no ejecuta borrados ni fija una retención nueva. El respaldo local del alumno no equivale a una exportación de todo el expediente académico.

## Orden de publicación, después de revisar la PR

1. Autorizar y fusionar el SHA revisado (no automático). Publicar primero backend compatible; comprobar las nuevas operaciones con las cuentas autorizadas. El frontend ordinario permanece OFF y no las utiliza aún.
2. Usar exclusivamente el expediente privado existente para curso/periodo/grupo y las dos cuentas autorizadas; nunca fixtures. Conservar exportaciones y hash/versiones previas en la carpeta privada cifrada habitual, fuera de Git. Confirmar autorizaciones actuales antes de escribir; detenerse si la lectura falla.
3. Aprobar la fuente candidata completa de Rules generadas con admisión, su hash y la fuente activa obtenida en vivo. Los hashes versionados y el release activo son artefactos distintos. No desplegar `firestore.rules` base como sustituto del piloto. El diff amplía únicamente el esquema de intentos; conserva los controles y denegaciones de las demás rutas. Aplicar la actualización compatible mediante el ejecutor existente y sus confirmaciones exactas.
4. Preparar control PAUSED y recibos mediante `single:session` (o el piloto original con sus dos revisores); publicar ON mediante su workflow existente, exclusivamente sobre el main autorizado. Nunca omitir gates ni renovar una ventana vencida. Mantener máximo un UID alumno, dos horas y leases de diez minutos en modalidad individual. El docente conserva autorización académica, no obtiene una concesión Sync adicional.
5. Abrir la ventana aprobada. El frontend consulta admisión propia antes de cargar CloudProgress; el transporte no abre Firestore para cuentas sin admisión. Una pausa detiene canales y conserva la cola privada por cuenta. La autorización definitiva siempre la imponen Rules/API, no el flag.

No hay activación productiva en una rama de PR: el workflow existente exige main, propietario y SHA exacto. No se modifica esa protección.

## Recorrido del propietario en Mac y Safari de iPhone

1. Con la cuenta alumna autorizada, consentir aventura e intentos por separado; conservar remoto antes de cualquier importación. Verificar personaje/mascota/apodo y ruta previos.
2. Abrir Memorama desde el gimnasio del grupo autorizado, completar ocho parejas, confirmar práctica automática y siguiente actividad visible según orden docente. No tocar mecánicas del juego.
3. En el segundo dispositivo con la misma cuenta, consentir los canales y recuperar práctica, resultado, personaje y mascota. Recargar ambos: exactamente un resultado para esa partida. Ensayar una práctica offline y reconectar sin pérdida ni duplicación.
4. Con la cuenta docente autorizada, actualizar Resumen: finalización cliente visible, validaciones en cero. Habilitar participación del grupo; el alumno decide opt-in. Ranking con alias y una apertura distinta, no puntos. Retirar consentimiento y comprobar desaparición. No usar otro grupo real para pruebas negativas: estas se ejecutan automáticamente con datos sintéticos.
5. Pausar servidor con el ejecutor existente, comprobar rechazo/conservación local y exportar. Publicar OFF del **mismo SHA compatible**, sin importar datos de invitado, borrar archivos ni restaurar Rules antiguas automáticamente. Comparar datos previos y evidencia sanitaria; conservar solo lo autorizado en el expediente privado.

Si hay error, no reintentar con credenciales alternativas ni ampliar IAM. Detener escrituras, pausar y conservar respaldos. Recuperación: usar conflictos/respaldos existentes tras autorización; no sobrescribir progreso ni ejecutar rollback de configuración sin autorización.

## Verificación automatizada

`npm run test:academic` incluye API y núcleo integrado. `npm run test:teacher` ejecuta la suite ordinaria y luego la integrada en el navegador indicado por `TEACHER_BROWSER=chromium|webkit`, con emuladores demo y fixture Memorama fijada por SHA en CI. También: `test:firestore`, `test:sync`, `test:sync:production`, `test:activities:security`, `test:original-results:security`, `typecheck:academic` y `build`.

El ensayo integrado usa Auth/Firestore reales de emulador y el código Memorama fijado, no simula una finalización escribiendo un resultado en el backend. No constituye una prueba productiva ni una prueba física de iPhone. Registrar PASS/FAIL/BLOCKED por entorno; nunca trasladar un PASS local a producción.
