# Release de telemetría 28/28 — aceptación de los dos contratos

## Resultado

- 25/25 emisores publicados en `main`, con `optilab-results.js` explícitamente
  incluido. Ningún cambio en los tres emisores ya publicados.
- 25/25 workflows Pages finalizados con éxito para los SHAs de esta tabla.
- 75/75 recursos (`index.html`, script principal y `optilab-results.js` de cada
  juego) responden HTTP 200, con tipos HTML/JavaScript correctos y contenido
  byte a byte idéntico al archivo de su commit. No se aceptó una página de error
  con código 200 ni una versión anterior como evidencia.
- PR #24 fusionada mediante squash `8aa4d2265ee28e85370530d9288a81b590ebc489`;
  [Pages PASS](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/41206519046).
  OptiLab y los 28 juegos están publicados. El smoke funcional público pasa
  28/28 en Chromium y WebKit.
- **28/28 aceptación PASS en Chromium y WebKit**, aplicando el contrato legacy
  de Memorama y el contrato temporal de los otros 27. No hay bloqueo por la
  persistencia local esperada de Memorama.

## Criterio de aceptación corregido

El release conserva **dos contratos distintos**. Exigir ausencia absoluta de
`gameResults` a los 28 juegos era un criterio incorrecto: contradice el contrato
legacy intencional de Memorama y las expectativas explícitas de
`tests/pilot.spec.ts` y `tests/pilot-public.spec.ts`.

| Alcance | Resultado esperado para aceptación |
| --- | --- |
| Memorama Simplex, protocolo `optilab-game` | Guarda exactamente su resultado legacy en `optilab-v1.gameResults`: `completed`, `matchedPairs`, `totalPairs`, `attempts`, `errors`, `elapsedMs`, `accuracy`, más `gameId`, `runId` y `date`. El payload coincide con la partida nativa; duplicados del mismo `runId` no añaden entradas. Una nueva partida válida tiene otro `runId`. El historial local persiste al salir y recargar, como exige el contrato existente. |
| Otros 27 juegos, protocolo `optilab-original-results` | El informe vive solo en la sesión montada del reproductor. Desaparece al salir y no reaparece al volver; no crea entradas en `gameResults` ni otros resultados persistidos. |
| Los 28 juegos | La telemetría no cambia prácticas manuales, diagnósticos, insignias, evolución ni recompensas; tampoco genera nuevas escrituras Firebase. Las visitas de navegación se distinguen de la práctica y de las finalizaciones. |

La excepción de persistencia de Memorama es **esperada y no constituye un
bloqueo**. Este criterio no modifica su protocolo, persistencia, emisor ni
reproductor, y no amplía el alcance Cloud de la telemetría.

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

## QA previo al despliegue y regresiones

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

## Revalidación de aceptación en OptiLab público

Comprobaciones reejecutadas contra
`https://israeltiburcio-ai.github.io/optilab/`, sobre el squash publicado de
PR #24. Los recorridos de partida real usan emisores públicos sin interceptar
sus recursos:

| Comprobación afectada | Chromium | WebKit |
| --- | --- | --- |
| Otros 27: carga, partidas completas/repetidas, informe nativo, abandono, aislamiento y modo independiente | 61/61 PASS | 61/61 PASS |
| Memorama: regresiones arena/piloto/aventura, `pilot-public.spec.ts` y comprobación estricta del contrato legacy | 36/36 PASS | 36/36 PASS |
| Aceptación de ambos contratos | **28/28 PASS** | **28/28 PASS** |

En Memorama se completaron dos partidas reales: la primera con un fallo
intencional (8 parejas, 9 intentos, 1 error, 89 %) y la segunda perfecta. Cada
registro coincide exactamente con su payload nativo más `gameId`, `runId` y
`date`; no se añaden otros campos. Reenviar la finalización dos veces no cambia
el registro ni su fecha; repetir una partida crea una segunda entrada con otro
`runId`, y reenviar el resultado anterior no crea una tercera. Al salir y
recargar se conserva el historial legacy. El resto del estado de progreso se
comparó íntegramente antes y después: prácticas, diagnósticos, insignias,
evolución, recompensas y preferencias permanecen iguales.

Para los otros 27, las comprobaciones adicionales de aceptación verifican
`gameResults: []`, prácticas y diagnósticos vacíos e insignias sin cambios en
contextos limpios. Tras cada informe completo se abandona la ruta y se vuelve
al mismo juego: el informe desaparece y no se recupera de almacenamiento. Las
comparaciones de progreso de las suites también permanecen iguales.

La observación de red de ambas suites no registró llamadas a los endpoints de
Firestore, Identity Toolkit, Secure Token, Firebase Realtime Database o Cloud
Functions durante estos recorridos de invitado; no hubo nuevas escrituras
Firebase por telemetría. La carga del iframe auxiliar de Auth en producción no
es una escritura de resultados. Los selectores del QA se limitaron al iframe
del juego cuando ese iframe auxiliar estaba presente; no se alteró el DOM ni
se bloquearon solicitudes para obtener el PASS.

Las suites existentes se ejecutaron con una configuración temporal que usa
la URL base del host público y añade verificaciones de red, salida de la
sesión y payload legacy exacto. Los opt-in usados fueron
`RESULT_EXPANSION_PUBLIC=1`, `RESULT_PILOT_PUBLIC=1`, `MEMORAMA_PUBLIC=1` y
`VERIFY_PUBLIC=1`; los fixtures locales de contenido quedaron desactivados.
El caso negativo de handshake simula expresamente un puente indisponible y
después comprueba la reconexión con el emisor real.
Las 36 comprobaciones de Memorama incluyen las 31 regresiones existentes,
los cuatro escenarios de `tests/pilot-public.spec.ts` y la comprobación estricta
adicional de payload, deduplicación y estado. La corrección versionada contiene
solo documentación y el criterio de aceptación; no modifica código, tests
existentes, emisores, reproductores ni persistencia.

## Estado de los alcances Cloud

Los issues #6 y #7 permanecen abiertos por sus alcances Cloud. La aceptación de
este release no certifica resultados Cloud, calificaciones, asignaciones ni
recompensas y no modifica esos subsistemas.
