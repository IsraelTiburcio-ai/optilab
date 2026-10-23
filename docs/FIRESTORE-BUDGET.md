# Presupuesto Firestore Spark · estimación de diseño

**Estimaciones, no mediciones reales ni garantía de cuota/coste.** 70 estudiantes, dos grupos de ~35, un semestre de 16 semanas/80 días lectivos; 100–500 intentos por estudiante = **7.000–35.000 intentos/semestre**, media 88–438/día lectivo. No se escribieron ni midieron datos reales. Cambios de actividad, reintentos, picos, varios dispositivos y más periodos aumentan consumo.

Referencia oficial consultada 2026-10-23: [cuotas](https://firebase.google.com/docs/firestore/quotas), [facturación](https://firebase.google.com/docs/firestore/pricing), [cálculo de tamaño](https://firebase.google.com/docs/firestore/storage-size). Revalidar en la ventana de despliegue. Firestore Standard: cuota gratuita para una base por proyecto, 1 GiB almacenado, 50.000 lecturas/día, 20.000 escrituras/día, 20.000 borrados/día y 10 GiB de transferencia saliente/mes; cuotas diarias se renuevan según horario del Pacífico. El plan sigue Spark; superar cuota puede interrumpir servicio, no autoriza pasar a Blaze. Todas las aplicaciones del proyecto comparten presupuesto.

## Almacenamiento: documentos ≠ índices ≠ transferencia

Supuestos conservadores, incluyendo nombres/campos/path y overhead aproximado, no tamaño JSON exacto:

| Concepto | Supuesto | Estimación por semestre |
|---|---|---|
| Intentos personales | 2 KiB/documento | 13,7–68,4 MiB |
| Índice date DESC de intentos | 0,5 KiB/entrada presupuestada | 3,4–17,1 MiB |
| Perfil/progreso | 70 × 8 KiB | 0,55 MiB |
| Evidencias de hitos | 140 × 4 KiB | 0,55 MiB |
| Diagnósticos importables locales | Hasta 70 × 30 × 1 KiB + índices | ~3 MiB adicionales si no incluidos entre intentos |
| Copia académica futura por intento | 2 KiB + índice mínimo por contexto | 17–85 MiB adicionales; no creada ahora |
| Resúmenes diarios/metadatos/asignaciones/revisiones futuros | 5.600 alumno-día de ~1 KiB + grupos y overhead | Reservar ~10 MiB |

Orden de magnitud completo futuro: **~35–185 MiB/semestre**, frente a 1 GiB gratis. No sumar dos veces un mismo intento al contar métricas; sí sumar su copia privada/académica si ambas existen. UID/path largos, textos/revisiones ilimitadas o índices extra pueden superar estas reservas. Persisten curso/progreso de semestres anteriores: cinco o seis semestres de escenario alto ya acercan/superan 1 GiB; 70 estudiantes/semestre no significa almacenamiento constante.

Mapas de práctica e hitos, respuestas, payloads, textos y listas de orden sin índices automáticos. Excepciones date DESC y un compuesto futuro de asignaciones. Un índice compuesto con tres campos no son tres lecturas/escrituras facturadas por documento; sí agrega almacenamiento y trabajo de mantenimiento. Tamaño máximo Firestore de documento: 1 MiB, pero objetivos del contrato son <8 KiB de progreso, <4 KiB de hito y ~2 KiB por intento, no usar el límite como tamaño habitual. Los textos/capacidades de actividades futuras necesitarán límites antes de habilitarse.

## Escrituras

- Base futura #4: un run + una actualización de progreso por intento, **14.000–70.000 escrituras/semestre**, ~175–875/día. Debounce de progreso podría reducirlo; no sincronizar cada toque, segundo ni render.
- Escenario ampliado conservador: sumar una copia académica y dos resúmenes (alumno/grupo) = **5 escrituras/intento**, 35.000–175.000/semestre, **438–2.188/día**. No implementado; requiere productor confiable. Un ranking adicional por intento verificado añade hasta 88–438/día, no convertir cada autorreporte en puntos.
- Bootstrap de users/progreso/hitos: hasta ~280 writes; importar solo los máximos locales actuales (50 runs + 30 diagnósticos por alumno) puede añadir 5.600 writes. Debe planificarse junto al tráfico diario, no importar automáticamente.
- Migrar 500 históricos ×70 en un día serían 35.000 writes **solo de intentos**, sobre 20.000/día. Distribuir carga y reintentos con checkpoints/idempotencia y presupuesto explícito. Un batch no vuelve gratis sus documentos.
- Mover una actividad: ~1 placement + assignments afectados y publicación; reordenar n elementos puede costar O(n) proyecciones. Tope propuesto 100/gimnasio; no escribir un documento por movimiento del puntero durante drag. Una definición se guarda una vez y puede asignarse a dos grupos sin duplicar su texto salvo vista sanitizada mínima.

## Lecturas y consultas económicas

Objetivo futuro normal, **sin listeners masivos**:

| Escenario supuesto | Presupuesto aproximado |
|---|---|
| 70 alumnos ×2 sesiones/día | Hasta ~2.240 lecturas/día: reservar 16 por sesión para perfil, punteros y dos ámbitos, incluyendo dependencias Rules |
| Dos revisiones docentes de 70 resúmenes | ≤840/día usando cota conservadora seis lecturas por get (doc + cinco dependencias) |
| Cinco historiales individuales, una página de 20 | ≤600/día con la misma cota conservadora |
| Futuro top-10: 70 alumnos ×2 consultas/día | 1.400 filas + hasta 980 dependencias = ~2.380/día |
| Total orientativo anterior | ~6.060/día; reservar margen hasta ~10.000/día para catálogo, filtros y reintentos |

No son rutas todas habilitadas hoy: ranking completo, roster paginado, actividades y gráficas quedan cerrados hasta sus fases. Get de progreso privado no usa lecturas de grants; un ámbito académico normalmente necesita cinco documentos dependientes, con máximo siete si se prueban ambas ramas docente/alumno. Los resúmenes individuales del ejemplo eligen propietario o docente sin consultar la rama ajena. Cache interno de una solicitud puede reducir llamadas repetidas; no asumir cache gratis entre solicitudes. Lecturas de autorización se facturan incluso para peticiones denegadas; consultas vacías tienen cargo mínimo. Revisar también lecturas de entradas de índice en filtros complejos; no presupuestarlas como gratis de forma universal.

Usar cursores, no offsets. Historial personal: orderBy(date DESC), limit≤50, startAfter fecha+ID; historial académico y filtros de #9 requerirán índices/rules de su propia fase. Resúmenes por alumno/grupo/día/semestre y nivel de confianza permiten dibujar gráficas sin descargar 35.000 eventos. No consultar users completos ni escanear collectionGroup privado. Establecer máximo de periodos/páginas por vista y un botón explícito para pedir más.

### Riesgo de rankings en tiempo real

No implementados. Si los 70 alumnos escucharan cada uno todo su grupo, 438 cambios/día ×35 receptores ≈15.330 lecturas de filas, **más** snapshots iniciales (70×35=2.450), reconexiones y reevaluaciones de permisos. Presupuestando hasta cinco dependencias por notificación puede superar **90.000 lecturas/día**, por encima de Spark. No prometer realtime barato con este patrón.

Propuesta para #8: alumnos con top-10 bajo demanda/dos refrescos por día y, si se justifica, solo docente con uno o dos listeners activos de grupos autorizados. Desmontar al salir, ocultar pestaña, cerrar sesión o cambiar grupo; no un listener por tarjeta, juego, gráfico o intento. Separar presentación de sesión y batching confiable de agregados. Medir posteriormente contadores de uso con carga controlada y recalcular antes de habilitar realtime a alumnos.

## Transferencia

Supuesto de 2.240 lecturas de sesión con 4 KiB medios + 1.440 de resúmenes/historial con 2 KiB + 2.380 de ranking/dependencias con 0,5 KiB ≈13 MiB/día lectivo. Con margen de serialización/protocolo/reintentos, reservar **~0,5–1 GiB/mes** para este uso. No incluye imágenes Cloudinary ni tráfico de proveedores, que no son almacenamiento Firestore. Índices almacenados no equivalen a bytes descargados; snapshots repetidos, cache/offline y reconexiones cambian la transferencia. Si se descargara todo el historial o muchos listeners, esta cifra dejaría de ser válida.

## Retención propuesta y operación Spark

Proponer a la profesora raw de hasta **dos semestres/~12 meses**, manteniendo progreso personal y resúmenes académicos pseudonimizados según finalidad y consentimiento aprobados. No es una política ejecutada ni justifica borrar historial ahora. Revisiones de actividades con referencias deben conservarse o archivarse junto al historial; archivar no cambia IDs.

Retención/borrado futuros mediante operador autorizado, con exportación privada y eliminación paginada después de aprobación. 35.000 borrados de un semestre requieren al menos dos días y margen de 20.000/día; borrar un padre no borra subcolecciones automáticamente. No activar TTL, PITR, backups administrados, exportaciones gestionadas de pago o Functions bajo la suposición de que entran en Spark. Baja de grupo no elimina cuenta Firebase ni progreso personal.

Conclusión: la carga académica normal **parece compatible** con Spark con estas hipótesis, pero no hay límite de frecuencia por usuario garantizado por Rules. Usuarios abusivos, scripts o mala integración pueden consumir la cuota. Producción sigue sin cliente Firestore en esta fase; las operaciones medidas por tests son del emulador y no representan facturación.
