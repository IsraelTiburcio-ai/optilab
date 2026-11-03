# Migración de OptiLab a `https://optilab.club/`

**Preparación del host; no se fusionó ni desplegó.** Este cambio no altera los
28 juegos ni sus mecánicas. La compatibilidad `postMessage` de los puentes se
prepara en 28 PRs adicionales, autorizadas por el propietario y todavía sin
merge. No se cambiaron DNS, Pages settings, Auth Console, Firebase, Vercel ni
Sync.

## Estado verificado

GitHub Pages informa `cname: optilab.club`, `https_enforced: false` y URL
canónica HTTP. `https://optilab.club/` falló al establecer TLS; el host antiguo
`https://israeltiburcio-ai.github.io/optilab/` responde 301 a
`http://optilab.club/`. El dominio y certificado aún no están listos para
publicación segura. No se intentó activar HTTPS ni modificar DNS.

Puerta pública: certificado TLS válido, `https_enforced: true` en Pages y HTTPS
200 antes de cutover. La preparación local no satisface esta puerta.

## Cambios host-only en esta PR

- Vite compila al root `/` solo con `OPTILAB_PAGES_TARGET=optilab.club`; el
  default local/legacy sigue en `/optilab/`, y targets no reconocidos fallan.
- El workflow Pages selecciona el root para el hostname que el propietario
  configuró, y `public/CNAME` retiene ese dominio en el artefacto.
- `HashRouter` no cambia: rutas como `/#/optidex` y `/#/cuenta` siguen siendo
  válidas. Vite rehace rutas de bundle/assets desde `/`; los links del catálogo
  y URLs de los 28 juegos siguen en `israeltiburcio-ai.github.io`.
- Las acciones Auth e invitaciones usan `location.origin` y `BASE_URL`, por lo
  que formarían callbacks raíz en `optilab.club`. No se cambió `authDomain`.
- El host acepta `https://optilab.club` exacto en el source URL de resultados;
  mantiene validación de sesión, source de iframe, origen opaco y sandbox
  `allow-scripts` sin `allow-same-origin`.

### Dependencia: bridges de los 28 juegos

Los 27 `optilab-results.js` y el bridge legacy Memorama solo permiten hoy como
padre productivo el origen GitHub. Memorama exige además referrer bajo
`/optilab/`. Por eso, con el nuevo host la URL de sesión se forma, pero cada
bridge rechaza `host:init`; gameplay sigue abriendo, pero no hay handshake ni
informe hasta autorizar/mergear los **28 PRs de bridge**. Su cambio es solo una
allowlist exacta para `https://optilab.club` y, en Memorama, aceptación del
referrer exacto `/`; conserva origen GitHub, localhost de QA, protocolos y
mecánicas. No usar wildcard ni relajar sandbox.

Las 28 PRs autorizadas (cada diff limitado al bridge, aún sin merge ni deploy):

| Bridge | PR | Bridge | PR |
| --- | --- | --- | --- |
| OptiQuest1 | [#1](https://github.com/IsraelTiburcio-ai/OptiQuest1/pull/1) | system-lab | [#1](https://github.com/IsraelTiburcio-ai/system-lab/pull/1) |
| SystemScope | [#1](https://github.com/IsraelTiburcio-ai/SystemScope/pull/1) | complexity-lab | [#1](https://github.com/IsraelTiburcio-ai/complexity-lab/pull/1) |
| or-mission | [#1](https://github.com/IsraelTiburcio-ai/or-mission/pull/1) | model-match | [#1](https://github.com/IsraelTiburcio-ai/model-match/pull/1) |
| lp-factory | [#1](https://github.com/IsraelTiburcio-ai/lp-factory/pull/1) | constraint-dash | [#1](https://github.com/IsraelTiburcio-ai/constraint-dash/pull/1) |
| feasible-drop | [#1](https://github.com/IsraelTiburcio-ai/feasible-drop/pull/1) | solution-detective | [#1](https://github.com/IsraelTiburcio-ai/solution-detective/pull/1) |
| planificador-produccion | [#1](https://github.com/IsraelTiburcio-ai/planificador-produccion/pull/1) | mapa-produccion | [#1](https://github.com/IsraelTiburcio-ai/mapa-produccion/pull/1) |
| claves-planeacion-produccion | [#1](https://github.com/IsraelTiburcio-ai/claves-planeacion-produccion/pull/1) | rompecabezas-simplex | [#1](https://github.com/IsraelTiburcio-ai/rompecabezas-simplex/pull/1) |
| caza-el-pivote | [#1](https://github.com/IsraelTiburcio-ai/caza-el-pivote/pull/1) | espejo-dual | [#1](https://github.com/IsraelTiburcio-ai/espejo-dual/pull/1) |
| balanza-dual | [#1](https://github.com/IsraelTiburcio-ai/balanza-dual/pull/1) | domino-holguras | [#1](https://github.com/IsraelTiburcio-ai/domino-holguras/pull/1) |
| mercado-recursos-dual | [#1](https://github.com/IsraelTiburcio-ai/mercado-recursos-dual/pull/1) | semaforo-sensibilidad | [#1](https://github.com/IsraelTiburcio-ai/semaforo-sensibilidad/pull/1) |
| desviacion-express | [#1](https://github.com/IsraelTiburcio-ai/desviacion-express/pull/1) | torre-prioridades | [#1](https://github.com/IsraelTiburcio-ai/torre-prioridades/pull/1) |
| rompecabezas-metas | [#1](https://github.com/IsraelTiburcio-ai/rompecabezas-metas/pull/1) | ruta-de-metas | [#1](https://github.com/IsraelTiburcio-ai/ruta-de-metas/pull/1) |
| candado-simplex | [#1](https://github.com/IsraelTiburcio-ai/candado-simplex/pull/1) | Ahorcado Simplex | [#1](https://github.com/IsraelTiburcio-ai/ahorcado-simplex/pull/1) |
| Ordena Simplex | [#1](https://github.com/IsraelTiburcio-ai/ordena-simplex/pull/1) | Memorama Simplex | [#1](https://github.com/IsraelTiburcio-ai/memorama-simplex/pull/1) |

Cada bridge PR cambia solo `optilab-results.js` (Memorama: `optilab-bridge.js`);
los 28 pasan `node --check`. Los workflows Pages publican solo desde `main` o
dispatch manual; todos siguen sin merge ni despliegue.

## Auth y Firebase

Firebase Auth sigue con `authDomain: optilab-cd829.firebaseapp.com`. El
propietario tendrá que añadir `optilab.club` a Authorized domains, revisar el
proveedor OAuth/redirect y comprobar enlaces de verificación/recuperación que
terminan en `/#/cuenta`. No se tocó Console.

La Sync productiva de PR #26 sigue apagada. Su target de host/base se preparó
para el origen GitHub y `/optilab/`; cuando se autorice el dominio nuevo habrá
que actualizar ese target en una PR posterior. Con el host nuevo, el gate actual
falla cerrado. Ningún cambio de esta PR activa Firebase ni escrituras automáticas.

## URL anterior

El dominio custom ya está asignado en Pages, así que GitHub redirige el URL
`github.io/optilab` a `optilab.club` (observado ahora hacia HTTP). Tras asegurar
TLS, el redirect del usuario normalmente lleva al dominio nuevo; no garantiza
que una URL de artefacto con `/optilab/assets/...` antiguo sobreviva. La nueva
compilación genera assets raíz. Para volver al path de proyecto se necesita
retirar el custom domain de Pages, no solo revertir el bundle.

## Publicación manual requerida

1. El propietario confirma DNS apex/`www` según la guía GitHub Pages vigente,
   espera certificado válido y activa Enforce HTTPS. Bloqueo presente: API
   devuelve `https_enforced=false`; HTTPS falla y el redirect observado es HTTP.
2. Revisar/mergear los 28 PRs de puentes; validar sus checks y el allowlist exacto
   antes de cambiar el host activo.
3. Revisar y autorizar esta PR. Solo un push/merge autorizado a `main` inicia el
   workflow Pages actual; no se ejecutó ese despliegue en esta preparación.
4. Tras el deployment, validar HTTP/HTTPS, CNAME, bundles root, hash routes,
   invitado, Auth con cuentas permitidas, los 28 handshakes/resultados y el
   sandbox. No usar datos de alumnos para el primer smoke.
5. Revisar por separado #26/Sync gates; esta migración no los activa.

## Rollback

Guardar SHA y configuración Pages anterior. Para revertir: (1) restaurar el
build `/optilab/`; (2) retirar `optilab.club` de Pages por acción autorizada y
confirmar URL/HTTPS del sitio; (3) publicar de nuevo el target legacy; y (4)
quitar `optilab.club` de Auth Authorized domains/OAuth solo si ya se añadió y
con aprobación. Las allowlists puente pueden mantener ambos origins exactos
durante la transición; eliminarlos se hace luego en PRs revisadas. No tocar
Rules, datos o journals como rollback web.

## Pruebas y límite actual

Unit de base Vite/auth callback/original result source, build legacy y build root,
smoke de raíz/HashRouter/assets e integración Chromium/WebKit se ejecutan en CI
y local. El endpoint público TLS no responde en esta revisión, así que no se
certifica aún el dominio ni Auth real. Sin los 28 merges puente tampoco se puede
declarar telemetría integrada en el nuevo host. Las PRs de allowlist están
abiertas y no se han fusionado ni publicado.

En esta preparación pasaron: `pages-base` 3/3, default legacy build, root build
y smoke de HashRouter/assets 1/1 por motor, contrato original results 14/14,
Memorama legacy en host viejo 31/31 por motor, Ahorcado/Ordena y fixtures
44/44 por motor. Para integración cross-origin se sirvió el bundle root Vite
local en el origin `https://optilab.club` simulado y se sobrescribió únicamente
el bridge de cada juego desde su rama PR; el HTML/data/gameplay vinieron de sus
URLs Pages públicas. Los otros 27 pasaron **61/61 por motor** y Memorama
**9/9 por motor**: `host:init`, origen/source y resultados, partidas/replay,
abandono, independencia, almacenamiento legacy de Memorama y cero requests
Firebase por estos recorridos. El TLS público sigue fallando, así que este smoke
valida candidate build + allowlists candidate, no disponibilidad real del dominio.
