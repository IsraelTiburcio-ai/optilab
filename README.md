# OptiLab

**Tu aventura por los gimnasios de Optimización I.**

OptiLab convierte 28 microjuegos existentes en una aventura de autoestudio: cinco destinos, criaturas originales, una colección explorable y una bitácora local. Proyecto educativo independiente desarrollado para acompañar Optimización I en el contexto de Matemáticas Aplicadas y Computación de la UNAM.

## Problema y visión

Los juegos estaban distribuidos en sitios independientes. OptiLab ofrece un punto de entrada coherente para encontrarlos, organizar el repaso y detectar temas por reforzar sin exigir cuentas. La visión es hacer del estudio una exploración, con claridad académica y libertad para recorrer cualquier gimnasio.

## Ejecutar

Requisitos: Node.js 22 y npm.

```sh
npm ci
npm run dev
```

Abrir la URL indicada por Vite, normalmente `http://localhost:5173/optilab/`.

```sh
npm run build
npm run preview
```

`dist/` contiene la versión estática de producción. TypeScript se verifica antes de generar el build.

## Qué incluye

- Portada ilustrada, cinco OptiCriaturas SVG originales y cinco insignias originales.
- Mapa HTML/SVG interactivo, vertical en móvil y panorámico en escritorio, con selección por teclado.
- Cinco interiores temáticos y los 28 juegos del JSON original.
- OptiDex: búsqueda por nombre/tema, filtros por gimnasio, pendientes, detalles y código original.
- Registro manual de práctica con fecha, gimnasios visitados y apodo local.
- Insignias de exploración al registrar todos los juegos de cada gimnasio.
- Ruta determinista configurable por gimnasio, tiempo disponible e interés, persistida localmente.
- Reto Simplex: cinco reactivos, corrección inmediata, explicación, resultado, bitácora y recomendaciones según cada error.
- Mi Aventura: progreso, insignias, último diagnóstico, ruta y reinicio con confirmación.

## Los gimnasios

| Gimnasio | Región | Tema | Juegos | OptiCriatura |
|---|---|---|---:|---|
| 1 | Bosque de Sistemas | Introducción a la Teoría de Sistemas; fundamentos de IO en el catálogo | 5 | Nexo |
| 2 | Valle Lineal | Modelos de Programación Lineal | 8 | Poli |
| 3 | Fortaleza Simplex | Método Simplex | 5 | Piv |
| 4 | Santuario Dual | Teoría de la Dualidad | 5 | Dua |
| 5 | Cumbre de Metas | Programación de Metas | 5 | Brío |

Los nombres narrativos no sustituyen los temas académicos. El título del primer gimnasio se ajustó al PDF localizado.

## Arquitectura y stack

React 19 + TypeScript estricto + Vite + React Router (`HashRouter`), CSS personalizado mobile-first y Lucide para iconografía de interfaz. Sin backend ni autenticación.

```text
src/
  main.tsx      Entrada, router, proveedor y límite de errores
  App.tsx       Pantallas y componentes reutilizables de catálogo/progreso
  Art.tsx       Paisaje, cinco mascotas e insignias SVG originales
  data.ts       Adaptador tipado, validación, gimnasios y reactivos
  store.tsx     Estado local, persistencia y recuperación defensiva
  styles.css    Identidad visual, composiciones responsive y movimiento reducido
tests/          Recorridos funcionales, accesibilidad, HTTP y responsive
```

El JSON de la raíz se importa directamente; no se duplica ni se reconstruyen manualmente sus registros. Se validan campos esenciales, HTTPS, gimnasio, IDs únicos y total. Los datos inválidos provocan un error explícito y el límite de errores muestra una recuperación. Campos de verificación del catálogo se conservan en la fuente original; no se presentan como resultados actuales de ejecución.

Los juegos usan `repo` como identidad estable y un único `GameCard` reutilizable. Los enlaces abren otra pestaña con `noopener noreferrer`; no hay iframes ni modificaciones a sus repositorios.

## Progreso local y honestidad

Clave: `optilab-v1` de `localStorage`. Guarda práctica por repositorio y fecha ISO, gimnasios visitados, insignias derivadas, últimos 30 resultados, apodo y ruta activa. Las insignias se recalculan coherentemente al marcar/desmarcar; no constituyen una evaluación académica.

Abrir un juego no registra práctica ni victoria. Solo el alumno puede marcarlo. OptiLab no recibe resultados de los juegos externos. Los resultados evaluados corresponden exclusivamente a los cinco reactivos internos. No se afirma dominio global.

Los datos permanecen en el navegador y origen actual: no se sincronizan entre dispositivos ni entre localhost y Pages. El almacenamiento bloqueado permite seguir utilizando la sesión e informa que no se conservará. El reinicio exige confirmación.

## Contenido académico

Se localizaron los cinco PDF en una ruta diferente de la propuesta. El reto se diseñó tras revisar el Gimnasio 3, especialmente §3.2 y §3.3, pp. 6–7 y 14–16. Cada reactivo incluye referencia y explicación matemática. Ver [docs/ACADEMIA.md](docs/ACADEMIA.md).

“Mapa de Producción” conserva la observación del catálogo: correspondencia pendiente de revisión docente. Se puede explorar y autorregistrar, pero no se usa en rutas recomendadas ni evaluación.

## QA

```sh
npx playwright install chromium
npm test
```

Playwright ejecuta Chromium con nueve viewports de 375 a 1920 px, comprueba todas las pantallas, ausencia de overflow horizontal, consola, datos, enlaces, filtros, estado, insignias, rutas y reto. Axe comprueba reglas WCAG A/AA en las experiencias principales. Los sitios externos se verifican por HTTP, no por completar sus partidas. Las capturas se generan en `test-results/` y el informe en `playwright-report/`; no se versionan.

Ver [docs/QA.md](docs/QA.md) para alcance y resultados reales. Las pruebas de viewport no sustituyen las pruebas en dispositivos físicos.

## Publicar en GitHub Pages

Vite usa `base: '/optilab/'`. El router usa fragmentos, por ejemplo `/optilab/#/gimnasio/3`, para poder recargar páginas internas sin depender de reescrituras del servidor.

El workflow `.github/workflows/deploy.yml` construye y despliega al recibir cambios en `main`. Configurar **Settings → Pages → Source → GitHub Actions**.

Para un repositorio nuevo autorizado:

```sh
git init -b main
git add .
git commit -m "Build OptiLab educational adventure MVP"
gh repo create IsraelTiburcio-ai/optilab --public --source=. --remote=origin
gh api repos/IsraelTiburcio-ai/optilab/pages -X POST -f build_type=workflow
git push -u origin main
```

URL de destino: `https://israeltiburcio-ai.github.io/optilab/`. El estado efectivo de publicación debe comprobarse con `gh run list` y una petición HTTP, no inferirse solo de la configuración.

## Cómo presentar OptiLab

1. Abre la portada en el iPad y elige **Comenzar aventura**.
2. Selecciona **Fortaleza Simplex** y entra al gimnasio.
3. Abre **Memorama Simplex**. Regresa a OptiLab y marca manualmente la práctica.
4. Consulta **Mi aventura**: se distingue práctica de evaluación.
5. En **Entrenar**, elige Gimnasio 3, 10 minutos y traza la ruta de dos actividades.
6. Abre **Reto final**, responde cinco reactivos y revisa las explicaciones.
7. Muestra que el repaso recomendado depende de los errores y que el resultado se guarda.

## Limitaciones actuales

- Un solo diagnóstico de cinco preguntas; no cubre todo el programa ni certifica conocimientos.
- Duraciones de juegos sin medir: el tiempo solo orienta la extensión de la ruta.
- Juegos externos independientes y sujetos a su disponibilidad; no se integran sus resultados.
- Progreso exclusivamente local, sin exportación o sincronización.
- Tipografías de Google Fonts con fallback local; la aplicación no requiere la fuente remota para funcionar.
- Sin sonido, instalación PWA ni modo offline en esta versión.
- QA automatizado en Chromium; Safari/iOS y dispositivos físicos requieren comprobación adicional.

## Próximas mejoras

Validación docente de catálogo y reactivos; más diagnósticos por gimnasio; medición real de duración; exportación/importación de bitácora; pruebas de Safari y dispositivos físicos; integración optativa de resultados mediante un protocolo explícito entre juegos y OptiLab; evolución del arte de regiones y despliegue PWA.
