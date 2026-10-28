# Actividades externas públicas · revisión de #6

Fecha de QA: **28 de octubre de 2026**. Rama `feat/external-activity-player`,
base `d00fcf7165eb9fdd0fd1003a5ce4a9e6b03b3ac8` (merge de PR #19).
Esta entrega implementa el reproductor público inicial. **#6 sigue abierto**:
las asignaciones privadas por grupo requieren un contrato académico posterior.

## A. Diagnóstico y alcance

- Los 28 juegos proceden del catálogo original; Memorama usa `GamePlayer` y su
  propio protocolo. No se cambia ese catálogo ni se reutiliza su protocolo para
  resultados de terceros.
- `GameArena` ya conserva sus hijos al ampliar/restaurar mediante CSS, gestiona
  foco, scroll, `inert` y salida. Se reutiliza sin modificar su implementación.
- `src/types/cloud.ts` contiene diseños de actividades y asignaciones, pero
  `server/academic/contracts.ts` no ofrece comandos operativos para publicarlas,
  asignarlas o registrar sus intentos. Las Rules siguen denegando esos accesos.
- Se añaden dos actividades complementarias públicas en **Gimnasio 3 / Fortaleza
  Simplex**, por su relación con Simplex y M Grande. No son asignaciones de clase.
  Permanecen los cinco gimnasios y 28 juegos, los entrenadores, compañeros,
  evoluciones, insignias, diagnóstico y progreso existentes.

## B. Implementación y puntos de extensión

| Archivo | Responsabilidad |
| --- | --- |
| `src/activities/types.ts` | Identidad, proveedor, capacidades y observaciones tipadas |
| `src/activities/catalog.ts` | Dos definiciones públicas y placements independientes del gimnasio |
| `src/activities/urls.ts` | Validación de URLs y política del iframe |
| `src/activities/messages.ts` | Adaptador acotado al recurso LearningApps verificado |
| `src/activities/ExternalActivityCards.tsx` | Tarjetas complementarias en el gimnasio |
| `src/pages/ExternalActivityPlayer.tsx` | Ruta lazy, sesión y arena con un iframe |
| `tests/activities/` | Seguridad, fixtures de UI y verificación real opt-in |

Rutas estables:

- `#/actividad/learningapps-formulas-simplex`
- `#/actividad/wordwall-metodo-m-grande`

`activityId` es independiente de su placement de gimnasio. Para publicar otra
actividad se necesita una definición explícita, URL validada y capacidades
honestas; añadir un proveedor requiere revisar su política y adaptador. La ruta
no recibe HTML ni abre URLs arbitrarias proporcionadas por el visitante.

No se añaden dependencias, backend de actividades, editor ni LMS.

### Recursos comprobados

**LearningApps · Fórmulas para el Simplex**

- Fuente: `https://learningapps.org/watch?v=pznycxd7t21`
- Embed: `https://learningapps.org/show.php?id=pznycxd7t21`
- Redirección observada: `https://learningapps.org/tools/71/37/watch?id=pznycxd7t21`.
- El oEmbed oficial también devolvió un iframe `watch?id=pznycxd7t21`;
  `show.php` abre directamente el ejercicio en lugar de la página de compartir.

**Wordwall · Método de M Grande**

- Fuente: `https://wordwall.net/resource/22610275/m%C3%A9todo-de-m-grande`
- Embed: `https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0`
- El hash del embed y el identificador numérico de la fuente se vincularon durante
  la inspección del recurso público; no se deduce uno del otro en tiempo de ejecución.

## C. Experiencia de uso

Las tarjetas aparecen debajo de los juegos de Gimnasio 3. El reproductor ofrece
regreso al gimnasio, ampliación/restauración y apertura externa. Conserva el mismo
nodo iframe, `contentWindow`, documento y partida al ampliar/restaurar: no cambia
`src`, no remonta el recurso ni necesita fullscreen nativo.

Salir de la ruta, recargar o cambiar de cuenta inicia otra sesión. No se mantiene
un iframe oculto al volver al gimnasio. Se espera a que Auth termine de cargar;
la sesión está delimitada por actividad y UID (o invitado).

La UI distingue apertura del visor de finalización. Un `load` del iframe **no**
prueba carga útil, éxito o resolución. Hay aviso de demora a los 15 segundos y
fallback siempre visible: los bloqueos cross-origin no se detectan infaliblemente.

## D. Telemetría y nivel de confianza

El registro existe **solo en memoria durante la sesión montada**:

| Observación | Significado | Persistencia / efecto académico |
| --- | --- | --- |
| `opened` | Se inició la sesión del reproductor | Ninguno |
| `completion-observed` | El iframe LearningApps activo emitió una señal compatible | Ninguno; señal no validada académicamente |

Incluye ID de actividad, UUID local de sesión y fecha de observación; la segunda
observación añade nombre de señal y `provider-signal-not-validated`. Se deduplica
la primera finalización. No hay almacenamiento local, Firestore, historial docente,
endpoint de intentos ni envío de estos eventos al proveedor.

En LearningApps se observaron desde la ventana directa del iframe y origen
`https://learningapps.org`:

```text
AppReady
AppTask|…|0
AppTitle|…|0
AppFeedback|…|0
AppSolved|pznycxd7t21|100|4|0
AppCompleted|pznycxd7t21|4|0
```

El adaptador admite únicamente los dos últimos formatos verificados para este
recurso/tool71 v37 (campo numérico variable limitado a 1–9 dígitos); descarta sus
números. **100 no se importa como nota y 4 no se importa como tiempo validado**.
`AppCompleted` no demuestra respuestas perfectas. Un cambio del proveedor exige
verificar de nuevo el contrato, no ampliar el parser por suposición.

En Wordwall se observaron **cero mensajes durante carga e inicio** en los probes.
No se verificó un resultado/finalización; su capacidad figura como no disponible.
Esto no afirma que Wordwall nunca emita mensajes.

Ninguna actividad incrementa práctica, progreso, recompensas, insignias, ranking,
evolución ni calificaciones. No se solicitan resultados autodeclarados.

## E. Seguridad y privacidad

- URLs HTTPS, hosts exactos, rutas y parámetros permitidos; rechazo de credenciales,
  puertos no estándar, fragmentos, parámetros duplicados, esquemas alternativos,
  subdominios y entradas malformadas. Las definiciones proceden del catálogo local.
- Sandbox: `allow-scripts allow-same-origin allow-forms`. Sin permisos de ventanas
  emergentes, navegación superior, descargas, modales o pointer lock.
- Política explícita deniega cámara, micrófono, geolocalización, pago, autoplay y
  fullscreen. Ampliar la arena usa CSS, no permiso del proveedor.
- `referrerPolicy="no-referrer"`; links externos con `noopener noreferrer` y
  `no-referrer`. No se añaden UID, correo, nombre, tokens, curso o grupo a las URLs.
- Mensajes: origen, ventana directa, recurso, formato, URL de origen del nodo y
  sesión activa deben coincidir. Mensajes ajenos, de otra ventana o del protocolo
  Memorama se ignoran. Wordwall no tiene adaptador de resultados.
- Los proveedores reciben conexiones de red y pueden usar cookies/políticas
  propias; el sandbox no los convierte en recursos propios de OptiLab.
- Catálogo exclusivamente público: nunca publicar aquí una definición privada
  confiando en ocultar su tarjeta. Parámetros de ruta no conceden acceso docente.

No se modifican Auth, backend académico, Rules/índices, credenciales ni proyectos
Firebase. Los tests nuevos del reproductor anulan la configuración Firebase del
entorno y no necesitan emuladores.

## F. QA local ejecutado

### QA funcional manual informado por el propietario

El propietario confirmó en la revisión final:

- Wordwall y LearningApps abren y funcionan correctamente.
- Ampliar y restaurar funcionan correctamente.
- La navegación no deja pantallas bloqueadas.
- Memorama Simplex continúa funcionando.
- LearningApps muestra una señal de finalización al terminar la actividad.
- La experiencia visual resulta satisfactoria.

Esta aprobación se registra como **QA funcional manual informado por el
propietario**. No se especificaron navegador, sistema operativo ni dispositivo;
no se atribuyen pruebas físicas móviles ni finalización WebKit a este reporte.
La señal LearningApps demuestra detección de finalización en el entorno probado,
no perfección, identidad ni acreditación académica.

### QA automatizado de implementación

| Comprobación | Resultado |
| --- | --- |
| Build y typecheck académico | PASS |
| Seguridad de actividades | **4/4** |
| UI con fixtures Chromium | **15 PASS, 1 omitida** |
| UI con fixtures WebKit | **15 PASS, 1 omitida** |
| Proveedores reales Chromium | **9/9** |
| Proveedores reales WebKit | **8 PASS, 1 omitida** |
| Regresión general con Memorama local fijado | **67 PASS, 4 omitidas** |
| API académica, emuladores locales | **70/70** |
| Sync core, incluidos Auth/Firestore reales emulados | **30/30** |
| Gate del build de producción Chromium / WebKit | **1/1 en cada motor** |
| `git diff --check` | PASS |

En la revisión final previa al commit se repitieron build, typecheck, seguridad,
UI con fixtures en ambos motores, proveedores reales en ambos motores, regresión
general con Memorama fijado y ambos gates de producción, con los mismos resultados
de la tabla. Los 70 tests de API y 30 de sync corresponden a la ejecución local
de implementación; no se repitieron contra los emuladores del propietario durante
esta revisión final. La CI de la PR verifica esas suites en su entorno aislado.

Las UI con fixtures prueban conservación de nodo/ventana/documento/contador,
responsive, foco, accesibilidad del host con axe, navegación, fallback, enlaces
externos, aislamiento de mensajes, deduplicación y ausencia de recompensas. **No
demuestran compatibilidad real del proveedor** ni accesibilidad de su contenido.

Los tests reales no interceptan recursos. LearningApps muestra 14 tarjetas y su
diálogo de tarea; Wordwall muestra el canvas con el loader oculto. Se verifican
los dos proveedores a 390×844, 820×1180, 1180×820 y 1440×900, incluida la arena.
Probes adicionales iniciaron Wordwall en ambos motores. No se verificó su final.

La finalización real LearningApps en Chromium se produjo mediante movimientos
de puntero: se consultaron las parejas del ejercicio y se recolocaron las tarjetas
para evitar solapamientos aleatorios. No se llamó a `setSolved`, ni se alteraron
respuestas ni se inyectó `postMessage`. Es una verificación automatizada del
contrato del proveedor, no evidencia de aprendizaje de un alumno.

Omisiones y fallos de preparación:

- Asignación privada/revocada por grupo: omitida en ambos motores, funcionalidad
  pendiente de #5/#6.
- Finalización real LearningApps WebKit: el arrastre automatizado no conectó
  parejas y el proveedor mostró un error cross-origin en el probe. Render y arena
  pasan; finalización WebKit permanece sin verificar.
- Cuatro pruebas de la regresión general de sitios publicados requieren
  `VERIFY_PUBLIC=1` y no se ejecutaron. La regresión de Memorama usó su copia local.
- El primer intento de regresión usó una copia temporal incompleta de Memorama y
  falló esperando `ready`. Se sustituyó por una copia de QA en el commit fijado
  `7a58545df7d3a657e85c2a87091f3277cdae97c0`; la ejecución posterior pasó. No se
  cambió el repositorio remoto del juego ni su protocolo.
- La primera aserción de finalización Chromium buscaba el panel mientras estaba
  oculto por la arena ampliada. Se corrigió el test para restaurar antes de leer
  el panel; la suite real completa pasó después.

Las suites académica/sync reutilizaron los emuladores `demo-optilab-sync` en
`127.0.0.1:9099` y `127.0.0.1:8085`, creando sus fixtures sintéticos propios. No se
detuvieron los servicios del propietario ni se vaciaron los emuladores. No se
reclaman ejecuciones nuevas de la suite completa de Rules, Auth UI o UI docente.
El cambio de cuenta real A→B dentro del reproductor tampoco se automatizó en esta
matriz; el límite de sesión por UID está implementado, no declarado como QA real.

### Comandos reproducibles

Desde el repositorio, con Node 22 y navegadores Playwright instalados:

```sh
npm run build
npm run typecheck:academic
npm run test:activities:security
npm run test:activities -- player.spec.ts --reporter=dot
ACTIVITY_BROWSER=webkit npm run test:activities -- player.spec.ts --reporter=dot
VERIFY_EXTERNAL_PROVIDERS=1 npm run test:activities -- providers-real.spec.ts --reporter=dot
ACTIVITY_BROWSER=webkit VERIFY_EXTERNAL_PROVIDERS=1 npm run test:activities -- providers-real.spec.ts --reporter=dot
MEMORAMA_DIR="/ruta/a/copia-qa-memorama" npm test -- --workers=2 --reporter=dot
npm run test:sync:production
TEACHER_BROWSER=webkit npm run test:sync:production
```

La matriz de actividades ocupa **5189**; ejecutar sus motores de forma secuencial.
La regresión ocupa 5187 y el servidor de la copia Memorama 5190. No usar directorios
temporales incompletos ni detener un proceso ajeno para liberar puertos. Para las
pruebas académicas/emuladas, seguir la configuración explícita de
`docs/ACADEMIC-ADMIN.md`; no arrancar wrappers de emuladores sobre puertos ocupados.

`.github/workflows/activities-ci.yml` ejecuta en PR las pruebas de seguridad y
fixtures Chromium/WebKit. Es PR-only, sin deploy ni credenciales; los proveedores
reales siguen opt-in. El resultado remoto del HEAD publicado se documenta en la
Pull Request, separado de los resultados locales.

## G. Compatibilidad

Validado en motores Playwright Chromium y WebKit de este Mac. Esto no equivale a
una prueba manual en Safari/iPhone/iPad físico. La ampliación CSS evita depender
del fullscreen nativo. La UI host no desborda horizontalmente en los cuatro
tamaños probados; el contenido y la ergonomía del ejercicio siguen en manos del
proveedor.

Durante la inspección ambos proveedores respondieron HTTP 200 y no se observaron
headers X-Frame-Options/CSP frame-ancestors restrictivos en los recursos revisados.
Es una observación fechada, no una garantía frente a cambios, bloqueos de red,
cookies, políticas escolares o disponibilidad futura.

## H. Limitaciones y continuación de #6

1. Contrato confiable de publicación/asignación por curso, periodo y grupo, con
   autorización de backend y revocación real antes de cualquier actividad privada.
2. Contrato de observaciones/attempts persistidos, idempotencia y permisos si se
   decide necesitar historial docente. La señal de un iframe no basta para
   convertir un resultado en calificación validada.
3. Verificar finalización LearningApps en WebKit y en dispositivos físicos;
   revalidar adaptadores ante cambios del proveedor.
4. Wordwall sin resultados integrados hasta disponer de evidencia verificable.
5. No hay restauración de partida garantizada al abandonar la ruta o recargar.
6. La adaptación de pantalla grande para los otros 27 juegos originales se
   realizará en una fase separada; esta entrega no modifica sus repositorios.

## I. Revisión local

Con el servidor docente local del propietario ya activo, revisar:

- `http://127.0.0.1:5195/optilab/#/gimnasio/3`
- `http://127.0.0.1:5195/optilab/#/actividad/learningapps-formulas-simplex`
- `http://127.0.0.1:5195/optilab/#/actividad/wordwall-metodo-m-grande`

Comprobar apertura, pantalla grande, restauración y regreso. En LearningApps,
completar el ejercicio y observar la señal sin cambios de progreso; en Wordwall,
confirmar que no se presenta una nota inventada. Abrir externamente si la red o
el navegador impide el embed.

La revisión final autoriza commit, push de `feat/external-activity-player` y
apertura de PR hacia `main`. **No autoriza merge ni despliegue**. La PR referencia
el issue #6 sin cerrarlo automáticamente. OCR permanece fuera de alcance; no se
modifica Firebase productivo ni se alteran progreso, recompensas o calificaciones.
