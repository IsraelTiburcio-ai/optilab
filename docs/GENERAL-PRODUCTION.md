# Producción general

La publicación ordinaria activa `general-progress-v1` en `optilab.club`, proyecto `optilab-cd829`, API existente de Vercel y Rules `firestore.production.rules`. No utiliza listas piloto, fechas de cierre ni leases. Las herramientas históricas del piloto quedan separadas del camino ordinario.

Cualquier cuenta Firebase no anónima con correo verificado puede consentir por separado aventura e intentos. Solo accede a su UID. El API comprueba el token vigente y los permisos de curso/grupo; el ranking requiere opt-in y comparte únicamente alias y participación cliente, nunca calificaciones verificadas. El ranking está disponible por defecto por grupo, salvo pausa explícita previa del docente. No se importa el invitado sin consentimiento.

Se mantienen documentos, versiones, journals, conflictos, respaldos, exportación y la protección para UID previamente borrados. No hay migración destructiva ni cambios de índices, IAM, WIF, APIs o facturación. Los datos de alumnos nunca se usan como fixtures.

Orden técnico de esta entrega: CI y tests → backend de ese commit → publicar Rules completas y comparar byte por byte con el release vivo → fusionar/publicar Pages. `production-release.json` identifica SHA, configuración general y hash de Rules; el API identifica su release y commit en cabeceras. No declarar éxito hasta comprobarlos públicamente.

Pausa de emergencia: un administrador autorizado puede establecer `syncProductionControl/current` exactamente como `{version:1,readsEnabled:false,writesEnabled:false}`. El documento no admite escrituras de clientes. No tiene expiración. Para reabrir, ambas banderas deben ser `true`. Eliminarlo vuelve al modo general por defecto. Estas operaciones requieren autorización operativa y no borran colas locales. No usar los controles históricos del piloto para pausar producción general.

La copia anterior de Rules se guarda fuera de Git antes de publicar. Un rollback requiere revisar que el cliente y los nuevos contextos de intentos sigan siendo compatibles; no restaurar una fuente base/piloto antigua automáticamente ni sobrescribir progreso. La validación física y autenticada se reporta separada de los emuladores y del smoke anónimo.
