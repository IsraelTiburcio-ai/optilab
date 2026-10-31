# Release de telemetría 28/28 — emisores publicados, OptiLab pendiente de merge

## Resultado

- 25/25 emisores publicados en `main`, con `optilab-results.js` explícitamente
  incluido. Ningún cambio en los tres emisores ya publicados.
- 25/25 workflows Pages finalizados con éxito para los SHAs de esta tabla.
- 75/75 recursos (`index.html`, script principal y `optilab-results.js` de cada
  juego) responden HTTP 200, con tipos HTML/JavaScript correctos y contenido
  byte a byte idéntico al archivo de su commit. No se aceptó una página de error
  con código 200 ni una versión anterior como evidencia.
- 28/28 smoke PASS: emisores públicos contra OptiLab candidato local, sin
  despliegue de OptiLab. Las partidas independientes también usan URLs públicas.

## Emisores

Todos los repositorios pertenecen a `IsraelTiburcio-ai`. La URL del juego es
`https://israeltiburcio-ai.github.io/<repositorio>/`.

| Repositorio | SHA publicado | Pages |
| --- | --- | --- |
| OptiQuest1 | `b2755c976e371e5797296022513f983c3f685368` | [PASS](https://github.com/IsraelTiburcio-ai/OptiQuest1/actions/runs/41189178956) |
| system-lab | `a42f8eb1b5750b835599aceddf134e0ce125eb87` | [PASS](https://github.com/IsraelTiburcio-ai/system-lab/actions/runs/41189181516) |
| SystemScope | `ba875ed41dfc5f55838ddfb512d283dcd8388f0a` | [PASS](https://github.com/IsraelTiburcio-ai/SystemScope/actions/runs/41189183591) |
| complexity-lab | `330da763454d139d59c1fe3d5cee64dcc3568f30` | [PASS](https://github.com/IsraelTiburcio-ai/complexity-lab/actions/runs/41189186041) |
| or-mission | `18fce84b95cb7d6ff7b06d3c2cde42fc9d419131` | [PASS](https://github.com/IsraelTiburcio-ai/or-mission/actions/runs/41189188674) |
| model-match | `a980d9fcaa9faf9ea4be6c9ad8d89d5bf34bc1bf` | [PASS](https://github.com/IsraelTiburcio-ai/model-match/actions/runs/41189190905) |
| lp-factory | `5e2a67a4f549799ee25bf3d4f13d78fa483638dc` | [PASS](https://github.com/IsraelTiburcio-ai/lp-factory/actions/runs/41189193464) |
| constraint-dash | `dddb763111c69b1ea7f2ccd58c6496d9d03f82a2` | [PASS](https://github.com/IsraelTiburcio-ai/constraint-dash/actions/runs/41189195895) |
| feasible-drop | `db4e07480b19f204658c27cddffe12000a281683` | [PASS](https://github.com/IsraelTiburcio-ai/feasible-drop/actions/runs/41189199138) |
| solution-detective | `24eecc9f6e2c09ece79bc4e529a5822c37bba1db` | [PASS](https://github.com/IsraelTiburcio-ai/solution-detective/actions/runs/41189201687) |
| planificador-produccion | `72aff3c769ac6afe0654ee7c3263a7b16b596f6b` | [PASS](https://github.com/IsraelTiburcio-ai/planificador-produccion/actions/runs/41189203754) |
| mapa-produccion | `ed10ec9db64d6847858d23a2445b06146591ded7` | [PASS](https://github.com/IsraelTiburcio-ai/mapa-produccion/actions/runs/41189206069) |
| claves-planeacion-produccion | `f571e979d78e3505ac9b982c3c438b9c7924eb7a` | [PASS](https://github.com/IsraelTiburcio-ai/claves-planeacion-produccion/actions/runs/41189208284) |
| rompecabezas-simplex | `a963354df0b8d18bbaa953cd086af55df5f61b27` | [PASS](https://github.com/IsraelTiburcio-ai/rompecabezas-simplex/actions/runs/41189210827) |
| caza-el-pivote | `f39ecc4e0ef53682a6d15ecc237d1e06b947decd` | [PASS](https://github.com/IsraelTiburcio-ai/caza-el-pivote/actions/runs/41189213001) |
| espejo-dual | `698d640c26d060f61bf884eaf84210e9e3e728d0` | [PASS](https://github.com/IsraelTiburcio-ai/espejo-dual/actions/runs/41189215944) |
| balanza-dual | `78e1fd4846db018070979dac44774fbb3683ed67` | [PASS](https://github.com/IsraelTiburcio-ai/balanza-dual/actions/runs/41189218324) |
| domino-holguras | `93427e8cc4b8f51523e526a53915e7742452f698` | [PASS](https://github.com/IsraelTiburcio-ai/domino-holguras/actions/runs/41189220380) |
| mercado-recursos-dual | `ab08d6f12abd6efa0a13bc55cfa48c1f4d1df54e` | [PASS](https://github.com/IsraelTiburcio-ai/mercado-recursos-dual/actions/runs/41189222811) |
| semaforo-sensibilidad | `ae9055421278b776f90162aebe175a861f96dd2f` | [PASS](https://github.com/IsraelTiburcio-ai/semaforo-sensibilidad/actions/runs/41189226114) |
| desviacion-express | `cccbb496eaa498673d7f0034a0bc476847297d50` | [PASS](https://github.com/IsraelTiburcio-ai/desviacion-express/actions/runs/41189227805) |
| torre-prioridades | `9176d0898c179e3f866a3713d368907ea581228b` | [PASS](https://github.com/IsraelTiburcio-ai/torre-prioridades/actions/runs/41189230254) |
| rompecabezas-metas | `e16225b7b43da6acb24568fde218802638b2d903` | [PASS](https://github.com/IsraelTiburcio-ai/rompecabezas-metas/actions/runs/41189232855) |
| ruta-de-metas | `e171b00bece892af2dab24273078fe4197ff985a` | [PASS](https://github.com/IsraelTiburcio-ai/ruta-de-metas/actions/runs/41189235803) |
| candado-simplex | `f663e03ca25581bbfebe69f580e8081b07c14420` | [PASS](https://github.com/IsraelTiburcio-ai/candado-simplex/actions/runs/41189237753) |

Mapa también tiene el build legacy [41189205577](https://github.com/IsraelTiburcio-ai/mapa-produccion/actions/runs/41189205577), PASS para el mismo SHA.

Se corrigieron antes del primer push las cinco listas selectivas de artefactos
de Caza, Balanza, Torre, Ruta y Candado para incluir `optilab-results.js`.
Los otros workflows suben la raíz completa; OptiQuest usa Pages legacy desde
`main` y su workflow administrado también pasó. Se excluyeron los `.DS_Store`
locales ajenos. No se alteraron contenido académico ni mecánicas durante release.

## QA público y regresiones

| Comprobación | Chromium | WebKit |
| --- | --- | --- |
| 25 emisores: dos partidas integradas, métricas, repetición, abandono, falsificación y partida independiente | 52 casos PASS | 52/52 PASS |
| Ahorcado/Ordena públicos + reproductor/fixtures | 44/44 PASS | 44/44 PASS |
| Memorama público + arena/piloto/aventura, host candidato local | 31/31 PASS | 31/31 PASS |

Chromium tuvo inicialmente 50/52 PASS. Se corrigieron dos supuestos del QA:
Balanza debe esperar al handshake antes del primer clic público; Rompecabezas
Simplex admite una respuesta alternativa que no debe usarse como error
intencional. La repetición dirigida de ambos escenarios y el standalone de
Rompecabezas pasó 3/3. No se modificaron emisores por estos ajustes. WebKit pasó
los 52 casos juntos después de corregir el QA.

Build y typecheck PASS; contrato de seguridad 13/13 PASS; `git diff --check` PASS.
Los recorridos instrumentados mantienen progreso protegido y cero solicitudes
Firebase para el contrato de resultados temporales. Memorama conserva su
registro de finalización preexistente y su protocolo, comprobados por regresión.

Los cinco archivos `*-results-local.spec.ts` admiten ahora
`RESULT_EXPANSION_PUBLIC=1` para desactivar por completo la interceptación de
recursos. Los JSON de raíces locales siguen proporcionando el banco de referencia
de los SHAs publicados para planificar controles, sin sustituir recursos web.
Memorama usa `MEMORAMA_PUBLIC=1` con el host local; Ahorcado/Ordena usan
`RESULT_PILOT_PUBLIC=1`.

No hay bloqueos de emisores públicos. Issue #6 permanece abierto. OptiLab
requiere revisión de su única PR antes de cualquier merge o despliegue.
