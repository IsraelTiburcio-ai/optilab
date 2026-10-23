# Authentication · revisión final y despliegue controlado · PR #11

## Actualización posterior a publicación · 23 octubre 2026

- Verificado por GitHub: PR #11 fusionada en `5df2258f62b38f3201798c34543c5dd6fa1c80f0`; [Pages 39921270706](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39921270706) terminó correctamente.
- El propietario informa Google Sign-In real desde **Safari en iPhone**, en la aplicación publicada: PASS. No proporcionó modelo, versión de iOS ni versión de Safari.
- El propietario informa logout persistente entre pestañas del mismo navegador, incluida recarga y navegación: PASS; `optilab-v1` continúa intacto.
- El reporte anterior de correo/verificación/recuperación sigue siendo QA real local atribuido al propietario. No se extrapola a correo público, otros dispositivos, arranque frío, VoiceOver/TalkBack ni toda la matriz de smoke.
- Se considera satisfecho el alcance de Authentication del issue #2 y se registra su cierre. Continúan pendientes entregabilidad/Spam, matriz física restante y smoke ampliado de correo/juegos; el progreso sigue local, común al navegador, sin sincronización por UID.
- Se autoriza trabajar en #3 mediante la nueva instrucción del propietario. No se autoriza otro merge, despliegue o cambio de producción.

Las secciones siguientes conservan el registro **previo** a la publicación y su plan; sus referencias a PR sin fusionar o dominio pendiente describen ese momento, no el estado actual.

## Alcance y decisión

Solo fase 01 / [issue #2](https://github.com/IsraelTiburcio-ai/optilab/issues/2). El issue #3 y las fases siguientes no se iniciaron. No hay fusión ni despliegue autorizado en esta ejecución.

**Revisión de código: no se identificaron bloqueantes de seguridad en el alcance de esta PR.** Esto no es una auditoría de penetración ni valida funciones Cloud futuras. La recomendación de fusión está condicionada a checks verdes del último commit, revisión final y autorización explícita del propietario para la ventana de merge/despliegue.

## QA manual real informado por el propietario

Fuente: reporte explícito en la conversación de revisión. El agente no inició sesión con la cuenta del propietario ni recibió contraseñas, tokens o códigos de correo. Entorno: revisión local según la checklist anterior; no se informaron versiones de navegador ni modelos físicos, por lo que no se infieren.

| Comprobación | Resultado reportado | Alcance / observación |
|---|---|---|
| Google Sign-In real | PASS | Cuenta real del propietario |
| Registro con correo/contraseña | PASS | Firebase real |
| Envío y verificación de correo | PASS | Llegó a Spam; el enlace verificó correctamente |
| Recuperación de contraseña | PASS | Flujo de correo real |
| Persistencia tras recargar | PASS | No equivale a un reinicio completo del navegador/dispositivo |
| Logout y permanencia desconectado | PASS | Según el reporte del propietario |
| Conservación de `optilab-v1` | PASS | Comparación exacta devolvió `true` |
| Firestore en Network con Keep log | 0 solicitudes | Observado durante recarga y navegación; no es una auditoría de logs de backend |

No se inventan resultados de otros entornos. Las capturas previas de la PR siguen identificadas como Auth Emulator y no se presentan como capturas de esta prueba real.

## Revisión de seguridad realizada

| Control | Revisión |
|---|---|
| Identidad / datos locales | `AuthProvider` no importa ni modifica `store.tsx`, no remonta ProgressProvider por UID y no sincroniza datos. |
| Credenciales | Contraseñas solo como estado temporal del formulario; no escritura propia de tokens, contraseñas o códigos OOB. Renovación y persistencia administradas por Firebase SDK. |
| Errores y texto | Mensajes locales en español, sin mostrar excepciones crudas; recuperación genérica; contenido del proveedor renderizado como texto React. |
| Sesión | Observer con limpieza/guardia de desmontaje; actualización de verificación protegida contra cambio de UID; logout es `signOut` del SDK. |
| Popup / retorno | Gesto explícito, sin redirección automática; URL de continuación construida desde origen/base del sitio, no desde parámetros del usuario. |
| Emulador | Solo DEV + proyecto `demo-` + loopback HTTP; se rechaza en configuración de producción. |
| Servicios Firebase | Solo App/Auth importados. Sin Firestore, roles, grupos, escrituras de progreso ni activación de facturación. |
| CI / configuración | Checks de PR con `contents: read`, proyecto demo y sin despliegue. En Pages solo configuración web pública; no service accounts ni secretos administrativos. |
| Dependencias | `npm audit --omit=dev`: 0 vulnerabilidades reportadas; build PASS en esta revisión. Ninguna conclusión de auditoría es permanente frente a futuras dependencias. |

El diff de `store.tsx`, evolución, catálogo, protocolo y GameArena contra `main` se revisa para comprobar su conservación. La cancelación previa de WebKit fue durante instalación de dependencias: no se cuenta como PASS; se fija el runner de checks en Ubuntu 24.04, imagen usada en pruebas anteriores, para evitar cambios implícitos de plataforma, y se ejecutan los checks de nuevo.

El run [39917628150](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39917628150) confirmó Chromium PASS, pero WebKit seguía descargando paquetes lentamente desde `azure.archive.ubuntu.com`; se canceló durante instalación, sin atribuirle un PASS. El workflow cambia ese mirror por `https://archive.ubuntu.com/ubuntu`, conservando la verificación de firmas y las pruebas completas. El nuevo resultado de ambos jobs se registra en la PR.

Se detectó que el propietario ya tiene `.env.local` para QA real. No se leyó su key en el reporte ni se editó ese archivo. La suite general ahora fuerza explícitamente configuración Firebase vacía en su servidor aislado (5187), para no heredar el proyecto real ni reutilizar un servidor ajeno; las pruebas de invitado comprueban cero solicitudes Auth. La suite Auth mantiene sus fixtures `demo-` explícitos (5188). Este ajuste aísla QA, no cambia la app o el progreso.

### Automatización repetida en esta revisión

- `npm audit --omit=dev`: **0 vulnerabilidades reportadas**.
- `npm run build`: **PASS**, TypeScript + Vite, con App/Auth en su chunk separado.
- Suite general: **66 PASS**, cuatro casos públicos opt-in omitidos y un timeout al cargar una ilustración Cloudinary en la prueba móvil del equipo. Se repitió únicamente ese caso sin modificar la prueba: **PASS**. Total de casos locales distintos cubiertos: 67. No se presenta la primera ejecución como completamente verde.
- HTTP externo: los **28 destinos devolvieron 200** en la ejecución de esta revisión. Eso no acredita completar sus mecánicas.
- Auth Emulator: **9/9 Chromium PASS y 9/9 WebKit PASS**, en ejecuciones completas nuevas; registro, OOB, recuperación, persistencia, logout, OAuth emulado, red/storage y responsive/Axe.
- Configuración/invitado: seis casos cubiertos en la suite general Chromium y **6/6 WebKit PASS** en ejecución específica, incluidos cuatro viewports/Axe y cero solicitudes Auth sin configuración.
- `.env.local` está ignorado y no versionado; no se modificó. El diff de los módulos de progreso/evolución, catálogo, GameArena y protocolo contra `main` no contiene cambios.
- Los resultados de GitHub Actions del último commit se registran en la PR; no se consideran aprobados los jobs cancelados o todavía en curso.

## Riesgos y pendientes no ocultados

1. **Dominio público aún sin probar con esta versión.** Autorización del dominio no demuestra por sí sola popup/retorno/persistencia en Pages. Es la primera puerta del despliegue controlado.
2. **Dispositivos físicos y Safari.** WebKit emulado no sustituye Safari iOS/iPadOS, bloqueo de ventanas, apertura desde correo, almacenamiento restringido o teclado táctil reales.
3. **Spam observado.** La acción de verificación funciona; la ubicación del correo es un riesgo de entregabilidad/usabilidad. La UI ya indica revisar Spam. Revisar remitente/plantilla y configuración de correo con el propietario antes de invitar grupos; no se modificó Console ni se promete resolverlo desde el frontend.
4. **Origen compartido de GitHub Pages.** Los repositorios del mismo host comparten origen y almacenamiento del navegador. El protocolo de Memorama no transmite tokens y valida ventana/origen/sesión, pero no crea aislamiento de seguridad. Se mantienen juegos propios de confianza; revisar aislamiento/dominio dedicado antes de datos Cloud privados. No se afirma haber auditado los otros 27 juegos.
5. **Perfil local común al navegador.** El usuario B puede ver la misma aventura local que A, como anuncia la UI; no son perfiles Cloud ni datos privados consultados de otra cuenta. No anunciar sincronización ni aislamiento por UID hasta completar #3/#4.
6. **Sesión temporal cuando se bloquea almacenamiento.** Está comunicada; no marcar persistencia como aprobada en ese modo ni evadir deliberadamente la preferencia del navegador.

## Pendientes en dispositivos físicos

- [ ] iPhone/Safari: Google por toque, popup bloqueado/permitido/cancelado, retorno, recarga y logout.
- [ ] iPad/Safari vertical y horizontal: mismos flujos, rotación, teclado y controles sin solapamientos.
- [ ] Android/Chrome: popup, retorno desde Gmail u otro cliente y recuperación de contraseña.
- [ ] Cierre/reapertura completa de navegador y arranque frío; no solo recarga.
- [ ] Navegación privada / almacenamiento restringido: aviso temporal e invitado operativo, sin pérdida local provocada por la app.
- [ ] Apertura de verificación y recuperación desde el correo, vuelta a la pestaña original y actualización de estado.
- [ ] VoiceOver/TalkBack: orden de foco, errores anunciados, campos y botones.
- [ ] Memorama y GameArena con sesión real: no reinicio al ampliar/restaurar, salida accesible y resultado único.

Registrar modelo, SO, navegador/versión, origen, PASS/FAIL y error visible. No adjuntar tokens, contraseñas, códigos OOB o correos personales en capturas públicas.

## Plan de despliegue controlado — NO ejecutado

### 0. Autorización y acoplamiento del workflow

**El workflow actual de Pages despliega automáticamente con un push a `main`. Por tanto, fusionar esta PR desencadenaría despliegue.** Marcarla lista para revisión no lo hace. No pulsar Merge, hacer push a `main` ni ejecutar `workflow_dispatch` hasta autorización explícita de la ventana de merge + despliegue.

Si el propietario exige fusionar sin desplegar, primero debe aprobar un mecanismo separado de autorización del entorno/workflow. No se añadieron protecciones de producción ni se alteró el disparador por inferencia.

### 1. Preflight antes de la ventana autorizada

- [ ] Identificar y registrar el SHA exacto revisado de la PR, checks y aprobación.
- [ ] Verificar las seis variables públicas sin imprimir la key; emulador no configurado para producción.
- [ ] Confirmar dominio `israeltiburcio-ai.github.io` autorizado y proyecto `optilab-cd829`.
- [ ] Confirmar build del commit exacto; no mezclar otros cambios.
- [ ] Registrar SHA de versión actual: `df90101eb0862088d84d9e35ec59019674d074fe` y [Pages exitoso 39897758763](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39897758763). Revalidar justo antes de desplegar por si `main` cambió.
- [ ] Preparar exportación privada de `optilab-v1` desde el origen público para la cuenta/navegador de QA. No exportar claves Firebase del SDK.
- [ ] Acordar responsable de smoke test y autorización de rollback. No depende de conservar artefactos que pueden expirar.

### 2. Publicación en ventana autorizada

Solo después del permiso: fusionar el SHA revisado, observar el workflow Pages, registrar run/deployment/SHA. Si falla el build, detenerse: no afirmar que el sitio cambió. No cambiar a la vez Firebase, reglas, proveedores o variables de otro proyecto.

### 3. Smoke test inmediato en el dominio público

URL prevista: `https://israeltiburcio-ai.github.io/optilab/#/cuenta` (no se declara publicada esta ruta en esta revisión).

- [ ] Desde navegador con progreso público previo: invitado, mapa, entrenador/compañero, evoluciones, insignias y OptiDex intactos.
- [ ] Google real: popup, retorno a `/optilab/`, recarga, logout y permanencia desconectado.
- [ ] Cuenta de QA propia: registro, correo de verificación (incluido Spam), actualización de estado, correo/contraseña y recuperación. No crear alumnos ficticios ni usar datos ajenos.
- [ ] Comparar literalmente `optilab-v1` antes/después sin practicar o editar el perfil durante la prueba.
- [ ] Network Keep log: cero conexiones Firestore en los flujos observados; tráfico Auth esperado.
- [ ] Sin emulador, sin mensaje de configuración faltante, sin errores JS ni loops de popup.
- [ ] Memorama dentro de OptiLab, ampliar/restaurar sin reinicio, resultado único y regreso al gimnasio.
- [ ] Chromium y Safari; un dispositivo físico prioritario si está disponible. Si falta, registrar pendiente en vez de PASS.

Detener la ampliación a más usuarios ante pérdida de progreso, cuenta incorrecta, secretos en UI/logs, conexiones Firestore inesperadas, fallo de login persistente, bucles o navegación rota. Fallos de delivered-Spam se registran y no se confunden con un token inválido. Sin esta comprobación no anunciar lanzamiento general Cloud.

### 4. Reversión si el propietario la autoriza

**No ejecutar estos comandos ahora.** Revertir solo los commits de la entrega de Auth, sin `reset --hard`, force-push, limpieza de almacenamiento ni borrado de usuarios.

Crear una rama de rollback desde `main` y una PR:

```sh
git switch main
git pull --ff-only
git switch -c revert/firebase-auth
# Si el merge aprobado fue squash: git revert <SHA_SQUASH_AUTH>
# Si fue un merge commit: git revert -m 1 <SHA_MERGE_AUTH>
# Si fue rebase: revertir los commits Auth de más reciente a más antiguo.
npm ci
npm run build
# Revisar diff y pruebas; luego push de la rama y PR de rollback.
```

La PR de rollback necesita aprobación de emergencia del propietario; al fusionarla, el workflow automático vuelve a desplegar la versión sin Auth. Registrar el nuevo SHA/run y repetir invitado/progreso/mapa/OptiDex/juegos. No revertir indiscriminadamente cambios legítimos posteriores; revisar el diff contra el baseline registrado.

El rollback de frontend **no elimina cuentas Firebase ni revoca sus sesiones**. No borrar `optilab-v1`, cuentas, reglas o datos como parte de esa reversión. Ante una sospecha de compromiso, la revocación/gestión de credenciales es una acción separada y autorizada por el propietario, no consecuencia automática de revertir la UI.

### 5. Cierre posterior

Solo con autorización, despliegue y smoke público satisfactorios: documentar evidencia final y decidir cierre del issue #2. Los issues siguientes no se inician por el mero merge. Los pendientes físicos siguen explícitos y el progreso continúa local hasta una entrega futura autorizada.
