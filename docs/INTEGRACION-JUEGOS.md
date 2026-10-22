# Integración piloto · Memorama Simplex · protocolo v1

## Alcance

Solo se integra `IsraelTiburcio-ai/memorama-simplex`. Los otros 27 juegos continúan como enlaces externos. El catálogo JSON permanece intacto. OptiLab conserva mapa, mascotas, insignias, rutas, diagnóstico y práctica manual.

**Entrada integrada:** `/optilab/#/jugar/memorama-simplex`.

**Juego independiente:** `https://israeltiburcio-ai.github.io/memorama-simplex/`.

Antes de modificar el juego se comprobaron sus cabeceras HTTP y se abrió su versión publicada en un iframe real: no había `X-Frame-Options` ni una política `frame-ancestors` que lo bloqueara. Se generó el tablero de 16 cartas. La disponibilidad debe volver a verificarse para cada juego futuro.

## Cambios en cada repositorio

### OptiLab

- `src/pages/GamePlayer.tsx`: vista, sesión de enlace, handshake, estados, iframe y recuperación.
- `src/integration/protocol.ts`: tipos y validadores estrictos.
- `src/components/GameResultPanel.tsx`: resultado con identidad OptiLab.
- `src/components/GameHistory.tsx`: última finalización en Mi Aventura.
- `src/components/GameCard.tsx`: el botón Jugar del piloto navega internamente; alternativa externa en detalles y reproductor.
- `src/components/SimplexCover.tsx`: cinco escenas SVG originales para los cinco juegos de Simplex.
- `src/store.tsx`: migración aditiva, historial deduplicado, máximo 50 resultados.

### Memorama Simplex

- `optilab-bridge.js`: puente opcional de comunicación.
- `index.html`: carga del puente y tema; versión de script para evitar caché del código anterior; repaso final enfocable.
- `script.js`: notificaciones desde `startClock` (primera carta real) y `finish` (ocho parejas reales). El diálogo incluye su repaso en el orden de teclado.
- `optilab-theme.css`: tema aplicado exclusivamente después de handshake validado; sin modificar mecánica, banco académico, aciertos o selección aleatoria.

`data.js` permanece sin cambios. La apariencia independiente mantiene su tema original.

## Handshake

1. OptiLab crea un UUID v4 aleatorio por montaje/reconexión. El iframe tiene una URL constante de lista permitida, no una dirección elegida por query o catálogo externo.
2. Añade `optilabSession` y `optilabOrigin` a la URL del iframe. No contienen información personal.
3. Registra el listener y envía `host:init` cada 600 ms hasta recibir `game:ready`.
4. El hijo valida origen, `source === parent`, esquema exacto, versión, juego, sesión y un referrer permitido. Producción requiere origen `https://israeltiburcio-ai.github.io` y ruta del padre que empiece por `/optilab/`. Para desarrollo se permite `http://localhost` o `http://127.0.0.1`, con referrer del mismo origen declarado.
5. El hijo responde con `game:ready` usando un `targetOrigin` explícito; aplica el tema embebido.
6. Sin respuesta en 15 segundos, OptiLab retira el iframe y ofrece reintentar o abrir el sitio independiente. El enlace externo siempre está disponible, incluso durante una conexión correcta.

No se usa `targetOrigin: '*'`. El referrer ausente o incompatible impide el enlace de resultados; el juego independiente sigue disponible.

## Mensajes

Campos comunes exactos:

```ts
{
  protocol: 'optilab-game',
  version: 1,
  gameId: 'memorama-simplex',
  session: '<UUID v4 del host>',
  type: 'host:init' | 'game:ready' | 'game:started' | 'game:completed'
}
```

`game:started` añade `runId` (UUID v4 nuevo por partida). Se emite al voltear la primera carta, no al cargar el iframe ni pulsar Jugar.

`game:completed` añade el mismo `runId` y:

```ts
result: {
  completed: true,
  matchedPairs: 8,
  totalPairs: 8,
  attempts: 9,
  errors: 1,
  elapsedMs: 42000,
  accuracy: 89
}
```

El ejemplo ilustra la estructura, no se inserta como resultado predeterminado. Los valores reales se calculan a partir del estado privado del juego en su función de finalización.

## Validación en OptiLab

Se exige simultáneamente:

- `event.origin === GAME_ORIGIN`.
- `event.source === iframe.contentWindow` y atributo `src` esperado.
- `protocol`, `version`, `gameId` y sesión actuales.
- Objeto no nulo, sin arrays, campos adicionales ni tipos inesperados.
- `game:ready` anterior a la partida y `game:started` anterior a su finalización.
- `runId` activo, no retirado ni ya registrado.
- Ocho parejas encontradas de ocho; intentos enteros entre 8 y 100000.
- `errors === attempts - 8` y `accuracy === round(8 / attempts * 100)`.
- Tiempo entero finito entre 0 y siete días. El juego mide tiempo activo y pausa al ocultar la pestaña.

Reinicios crean otra partida. Mensajes repetidos, finalizaciones sin inicio y resultados incoherentes no se guardan. Al reconectar se crea un nuevo iframe y sesión. El hijo puede repetir su snapshot en un handshake repetido; el host deduplica.

## Límite de confianza del origen compartido

Comprobar origen por sí solo no distingue repositorios Pages. Ventana emisora, sesión y juego evitan aceptar mensajes accidentales o procedentes de otra ventana con ese origen. **No son aislamiento criptográfico ni un sistema antitrampas.** Ambos son proyectos propios de confianza y todo el resultado es cliente/local, sin firma de servidor. Un script malicioso ejecutado con el mismo origen puede acceder a otras páginas de ese origen; para aislar código no confiable se necesitarían orígenes distintos y otro diseño de sandbox/CSP. No se presenta este resultado como certificación académica.

El iframe no solicita cámara, micrófono, ubicación ni autoplay. No se habilita navegación superior desde la lógica del juego. Se mantiene como contenido propio de confianza y no se afirma que un sandbox con `allow-scripts allow-same-origin` aislase repositorios de un mismo origen.

## Persistencia y semántica

La clave existente `optilab-v1` añade `gameResults`. Si no existe, se inicializa a `[]` sin eliminar apodo, rutas, prácticas, visitas o diagnósticos. Cada registro guarda `runId`, `gameId`, fecha ISO del host y métricas validadas. Se conserva un máximo de 50 registros y se valida de nuevo al cargar.

**Abrir ≠ iniciar ≠ finalizar ≠ practicar manualmente ≠ dominar.**

Completar Memorama registra finalización y precisión. No marca automáticamente la práctica manual, no cambia la regla de insignias ni certifica dominio. Una salida anticipada no produce finalización. El reinicio global también borra estos resultados. Si `localStorage` falla, se conserva la sesión en memoria y se muestra el aviso existente.

## Reproducir pruebas locales de ambos repositorios

```sh
gh repo clone IsraelTiburcio-ai/memorama-simplex ../memorama-simplex
MEMORAMA_DIR="$(realpath ../memorama-simplex)" npm test
npm run build
```

Playwright levanta Vite en 5187 y el clon del juego en 5190. Intercepta únicamente las solicitudes al sitio del juego y sirve el candidato local conservando su origen real en el navegador. Esto prueba el origen remoto sin publicar código sin verificar. La prueba pública adicional no intercepta recursos.

Sin `MEMORAMA_DIR`, las pruebas específicas de los dos candidatos locales quedan explícitamente omitidas; el resto se puede ejecutar con `npm test`.

## Patrón para los otros 27

1. Inspeccionar repositorio, permisos de iframe, responsive y fuente real de finalización.
2. Mantener intactas sus respuestas y reglas; identificar inicio real, reinicio y resultado real.
3. Definir un `gameId`, URL y esquema de resultado específicos. No reutilizar la regla de ocho parejas para otro tipo de juego.
4. Añadir puente opcional con esquema versionado, origen/referrer permitidos, sesión y `runId`.
5. Registrar el juego en una lista de integraciones explícita del host, con validador propio y alternativa externa.
6. Probar una partida real con errores, abandono, reinicio, duplicados, mensajes falsos y operación independiente en los cuatro tamaños.
7. Publicar primero el juego compatible; después, el host. Verificar ambos en producción, sin proxies de pruebas.

Ninguno de los otros 27 repositorios fue modificado para este piloto.
