# Piloto de juegos originales

> Registro histórico del piloto de PR #21. El cierre a 28 juegos y la resolución
> de los bloqueos están en [ORIGINAL-GAMES-EXPANSION.md](ORIGINAL-GAMES-EXPANSION.md).

`ahorcado-simplex`, `ordena-simplex`, `rompecabezas-simplex` y `caza-el-pivote`
usan `/jugar-original/:gameId`: completan los cinco juegos del Gimnasio 3 junto
con Memorama.
Las URLs se obtienen del catálogo y deben coincidir exactamente con la allowlist.
Memorama conserva su reproductor/protocolo; los otros 23 conservan sus enlaces.

`OriginalGamePlayer` reutiliza `GameArena` sin modificarlo. No escucha mensajes,
registra resultados ni altera recompensas. Salir o recargar termina la partida.

El sandbox es **solo `allow-scripts`**. Nunca añadir `allow-same-origin`: los
juegos comparten origen con OptiLab en Pages. El origen opaco impide leer DOM,
cookies y almacenamiento del host y también impide el localStorage del juego.
Los cuatro juegos reales arrancan e interactúan pese a esa restricción; no se garantiza
persistencia de sus preferencias. El fallback independiente sigue disponible.

Esta política corresponde a los **cuatro juegos del reproductor genérico**.
Memorama sigue usando `GameArena` con su iframe existente, **sin atributo sandbox**,
y su protocolo de resultados intacto. Aplicarle `allow-scripts` cambiaría el origen
de sus mensajes a `null` y requeriría revisar ese contrato; no se hace en este piloto.

## QA funcional manual informado por el propietario

El propietario confirmó que los cinco juegos del Gimnasio 3 funcionan correctamente
y aprobó el QA manual. No especificó navegadores ni dispositivos; no se atribuyen
pruebas físicas móviles a esta aprobación.

QA (servidor aislado de Firebase en 5189; ejecutar secuencialmente):

```sh
npm run build
npm run test:original-games -- player.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit npm run test:original-games -- player.spec.ts --reporter=dot
VERIFY_ORIGINAL_GAMES=1 npm run test:original-games -- real.spec.ts --reporter=dot
ORIGINAL_GAME_BROWSER=webkit VERIFY_ORIGINAL_GAMES=1 npm run test:original-games -- real.spec.ts --reporter=dot
```

Los fixtures prueban política, rutas, fallback y ausencia de resultados. Los tests
reales prueban interacción y conservación de partida en cuatro viewports y ambos
motores, además del aislamiento sobre el dominio público compartido. Viewports
móviles y gestos táctiles automatizados no son QA físico en iPhone/iPad.

QA de la ampliación: build/typecheck y diff PASS; fixtures **8/8** y red real
**20/20 por motor**. Regresión Memorama/arena **17/17** y catálogo **1/1**.
Rompecabezas: arrastre real en escritorio, colocación táctil en móvil/tablet y
comprobación de armado; el test respeta los 450ms de supresión de clics que aplica
el juego después del arrastre. Caza: selección real de columna y renglón pivote.
Partida, marcadores y cronómetro se conservan al ampliar/restaurar. No se añaden
resultados a OptiLab. Sin bloqueos de sandbox ni cambios en repositorios ajenos.

En el cierre se repitieron build/typecheck, fixtures 8/8 y red real 20/20 por
motor. La ejecución combinada de Memorama/arena y aventura/catálogo pasó **31/31**.

Los fixtures se ejecutan también en la matriz PR-only existente de Chromium/WebKit.
Las pruebas reales siguen siendo opt-in. El cierre autoriza commit, push y PR;
no autoriza merge, despliegue ni cambios de Firebase productivo.
