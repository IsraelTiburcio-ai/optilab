# PR #14 · Consolidación de sincronización emulada y publicación estática

## Merge y checks verificados

- HEAD revisado/autorizado: `26a9e9328c8b4cfacf925bf8609dd320c302afbc`.
- PR [#14](https://github.com/IsraelTiburcio-ai/optilab/pull/14) MERGED por squash: `7ab4e83a89510df6a8fc592904abc80a26714264`, padre `adc8b174d5a7a4c32eeb2256570d99717806f90e`; árbol igual al HEAD revisado.
- Cinco checks verdes del HEAD: [Sync](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39995732925) (30 core y cinco UI por navegador, preview seguro), [Auth](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39995732819) (9+6 por navegador) y [Rules](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39995732924) (95/95).
- [Pages 40015438801](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/40015438801): build/TypeScript y deploy **success**, commit `7ab4e83a89510df6a8fc592904abc80a26714264`. Deployment `7287523079`, `github-pages`, success.
- En main el workflow configurado por push es Pages/build. Las suites de PR no tienen trigger push-main: no se inventan cinco ejecuciones nuevas de main; sus pruebas corresponden al árbol revisado idéntico.

## QA físico informado por el propietario

**5/5 PASS en Chrome y Safari de la misma Mac, usando Auth + Firestore Emulator. No fueron dos dispositivos físicos distintos.** No se proporcionaron versiones/modelo.

1. Login no importó invitado automáticamente; al aprobar importación, remoto conservó dos prácticas, gimnasio visitado, avatar-04 y Piv.
2. Safari recuperó con la misma cuenta sintética el progreso de Chrome sin reimportar.
3. Una práctica de Safari apareció en Chrome sin recarga (2/28 → 3/28).
4. B empezó con 0/28, sin prácticas/personalizaciones privadas de A; sus prácticas no modificaron A.
5. A→B→A recuperó prácticas/personalizaciones originales sin contaminación.

Se observó “Sincronizado · 0 operaciones pendientes”. Fuente: reporte del propietario, no ejecución física del agente. [Comentario #4](https://github.com/IsraelTiburcio-ai/optilab/issues/4#issuecomment-6373537277) · [comentario PR #14](https://github.com/IsraelTiburcio-ai/optilab/pull/14#issuecomment-6373536876). Sin UID, contraseñas, archivos privados ni identificadores de cuentas.

## Smoke publicado posterior al merge

Agente, Chromium 156.0.8078.4 (1440×900) y WebKit 27.2 (390×844), contextos nuevos aislados con progreso **sintético**:

- HTTP 200; modo invitado, mapa con cinco gimnasios, catálogo 28, seis entrenadores y cinco familias disponibles.
- Equipo/hito etapa 2, diagnóstico y ruta sintéticos preservados; igualdad literal de optilab-v1 tras navegación/recarga.
- Formularios Google/correo/registro/recuperación habilitados; no se enviaron credenciales, altas o correos reales.
- **0 intentos Firestore, 0 intentos de cargar CloudProgress/SyncPanel y 0 errores JavaScript**, en ambos navegadores. No se inició operación Auth real en ese smoke.

No se afirma nuevo login Google/correo real después del merge ni QA físico Mac/iPhone por estos contextos. El acceso real requiere acción del propietario; las pruebas previas del propietario aquí son solo emuladores.

## Producción y seguimiento

Cloud sigue deshabilitado: DEV + loopback + demo-optilab-sync + ambos emuladores, con revalidación en factory y comprobación de instancia/Auth UID. Pages no ejecuta firebase deploy. Los archivos Rules/índices en main no significan recursos publicados.

**No se publicaron reglas/índices, no se creó dato real ni se cambiaron configuración/usuarios/proveedores de Auth, IAM, plan Spark, Functions o recursos de Firebase.** No se auditó el ruleset real mediante Console; no se tocó la base de producción.

#4 permanece OPEN para retención/borrado, cuotas/abuso, aceptación final de conflicto/reset, QA Mac/iPhone y puerta productiva autorizada. La planificación #5 está en [ADR-003](architecture/ADR-003-academic-administration.md) y [plan técnico](GROUPS-IMPLEMENTATION-PLAN.md), pendiente de aprobar mecanismo privilegiado; no implementa administración ni autoriza otra fusión/despliegue.
