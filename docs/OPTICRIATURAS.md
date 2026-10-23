# OptiCriaturas · compañeros y evoluciones

## Entrega verificada · 22 de octubre de 2026

**Estado: COMPLETADO y publicado.**

- App: https://israeltiburcio-ai.github.io/optilab/
- Selector: https://israeltiburcio-ai.github.io/optilab/#/companero
- Único repositorio modificado: `IsraelTiburcio-ai/optilab`.
- Implementación: `67f2909`.
- [GitHub Actions 39896866835](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/39896866835): **success**.

### QA real

| Viewport | Equipo, selección y evolución públicos Chromium | Equipo, selección y evolución públicos WebKit |
|---|---|---|
| 390 × 844 | PASS | PASS |
| 820 × 1180 | PASS | PASS |
| 1180 × 820 | PASS | PASS |
| 1440 × 900 | PASS | PASS |

- **18 pruebas públicas PASS:** nueve Chromium y nueve WebKit. Se probaron bienvenida completa, elecciones persistidas, guardianes distintos, escena protagonista con apodo y forma activa, celebración accesible, no repetición, cambio de entrenador/familia, migración de etapa 3, consulta de formas anteriores, reinicio, datos inválidos y fallbacks.
- **Regresión local completa: 61 PASS, cuatro pruebas públicas opt-in omitidas.** Incluye mapa, insignias, OptiDex, rutas, diagnóstico, Memorama independiente/integrado, GameArena y personalización anterior. Tras añadir el versionado de reglas, los cuatro casos de reglas y los nueve casos de compañeros se ejecutaron de nuevo: **13 PASS**.
- **WebKit local: nueve casos de compañeros PASS.**
- **Memorama público 390×844 en Chromium: PASS**, con ampliar/restaurar varias veces, partida intacta, ocho parejas y un solo resultado guardado.
- **Build de producción + TypeScript: PASS.**
- **Quince ilustraciones originales: PASS**, carga real e inspección visual de las tres formas de cada familia, todas de 1254×1254.
- **Accesibilidad básica:** Axe A/AA en las experiencias existentes, selector y celebración; controles nativos de selección, foco modal, Escape, omisión y movimiento reducido.

Las verificaciones públicas usan la aplicación y los assets publicados; solo la prueba explícita de fallo bloquea Cloudinary. Los tamaños y motores son emulados; queda pendiente la comprobación en dispositivos físicos.

### Archivos modificados y creados

- Datos/reglas: `src/data/companions.ts`, `src/lib/evolutionRules.ts`.
- Componentes nuevos: `CompanionPortrait.tsx`, `CompanionProgress.tsx`, `EvolutionCelebration.tsx`, `EvolutionLine.tsx`, `ExpeditionPanel.tsx` bajo `src/components/`.
- Pantalla/estilos nuevos: `src/pages/CompanionSelector.tsx`, `src/styles/companions.css`.
- Integración: `src/store.tsx`, `src/App.tsx`, `src/pages/TrainerSelect.tsx`, `src/pages/Profile.tsx`, `src/pages/GymMap.tsx`.
- QA: `tests/companion-assets.spec.ts`, `tests/evolution-rules.spec.ts`, `tests/companions.spec.ts`; adaptación del flujo inicial en `tests/adventure.spec.ts` y `tests/personalization.spec.ts`.
- Documentación: `README.md`, `docs/PERSONAJES-INSIGNIAS.md`, este documento.

## Flujo y representación

`Inicio → Entrenador → Compañero → Mapa`. La ruta nueva es `#/companero`.

La portada conserva su invitación inicial hasta confirmar ambos personajes. Si ya existe entrenador, el botón ofrece elegir compañero; si existe el equipo completo, muestra el saludo con el apodo guardado, los nombres de ambos, su escena conjunta con el paisaje original, la etapa activa y **Continuar aventura**. Un apodo vacío o el predeterminado genérico no se convierten en un nombre personal inventado.

Las rutas directas a mapa, gimnasio, catálogo, práctica y juego integrado siguen abiertas. Una representación predeterminada no guarda una elección. El personaje y la familia se cambian desde Mi aventura, y la portada se actualiza desde el mismo estado local.

## Catálogo oficial

Las quince URLs proporcionadas se encuentran únicamente en `src/data/companions.ts`. No se generaron ni sustituyeron las ilustraciones. Los IDs de familia y de forma son estables e independientes de sus nombres visibles y URLs.

| ID de familia | Gimnasio de origen | Etapa 1 | Etapa 2 | Etapa 3 |
|---|---:|---|---|---|
| `nexo` | 1 | Nexo | Nexor | Nexarbor |
| `poli` | 2 | Poli | Poligon | Polidrón |
| `piv` | 3 | Piv | Pivox | Pivótrón |
| `dua` | 4 | Dua | Dualuna | Dualaris |
| `brio` | 5 | Brío | Brion | Bríomonte |

El selector ofrece cinco familias, no quince opciones iniciales. Sus tarjetas muestran las formas base; la vista previa indica la forma que acompañará al estudiante según su avance general. No hay ventajas académicas por familia.

En el mapa permanecen cinco guardianes distintos, siempre en su etapa 1. La expedición personal muestra aparte al entrenador, compañero activo, etapa y prácticas válidas totales. Visitar un gimnasio no cambia la familia personal ni evoluciona su guardián.

## Reglas centrales

`src/lib/evolutionRules.ts` define:

- Etapa 1: representación inicial.
- Etapa 2: **6 juegos únicos**, repartidos entre **2 gimnasios** como mínimo.
- Etapa 3: **18 juegos únicos**, repartidos entre **4 gimnasios** como mínimo.

Solo se usan repositorios del catálogo original de 28 juegos y fechas UTC ISO válidas de práctica manual. Se rechazan fechas imposibles, valores de otro tipo e IDs ajenos. Visitas, puntuaciones, partidas repetidas de Memorama, diagnósticos y actividades externas de la profesora no suman juegos únicos. Un mismo ID se cuenta una vez.

Las insignias mantienen su regla anterior e independiente: todos los juegos de su gimnasio marcados como practicados. La evolución reconoce constancia autorregistrada, no dominio académico.

### Configuración futura

Las reglas están versionadas en `EVOLUTION_RULE_SETS`; `CURRENT_RULE_VERSION` elige la versión activa. Para cambiar umbrales en una versión futura se añade otro conjunto y se conserva el anterior. Así se pueden validar los hitos previos con las reglas bajo las cuales se obtuvieron, sin revocarlos por un cambio posterior de configuración.

## Persistencia aditiva en `optilab-v1`

Campos nuevos:

```ts
companionId: 'nexo' | 'poli' | 'piv' | 'dua' | 'brio' | null;
evolutionMilestones: Array<{
  stage: 2 | 3;
  ruleVersion: number;
  unlockedAt: string;
  practice: Array<{ gameId: string; practicedAt: string }>;
}>;
evolutionCelebratedStage: 1 | 2 | 3;
```

La migración conserva `avatarId`, `practiced`, `visited`, `results`, `gameResults`, `nickname`, `route` y el progreso de insignias. Si las prácticas anteriores ya cumplen un umbral, se reconoce al cargar, incluso antes de escoger familia. La fecha de reconocimiento del hito se registra entonces; no se presenta como una fecha histórica de obtención desconocida.

Cada hito conserva una copia de los IDs y fechas válidos que justificaron el umbral. Se valida de nuevo su esquema, versión, unicidad, pertenencia al catálogo y distribución. Esto permite conservar las etapas aunque una práctica se desmarque después. Un número de etapa escrito sin evidencia válida no concede una forma. El estado es local y no constituye una certificación firmada.

La forma más avanzada desbloqueada es la representación activa. Cambiar familia no borra ni reinicia hitos. El control existente de reinicio global borra también compañero, evidencias y celebraciones.

## Celebración y revisión

Un aviso ofrece **Evolucionar** al existir una etapa todavía no celebrada. La celebración se abre solo por acción explícita, con imágenes anterior/siguiente, silueta, halo y partículas CSS. No hay vídeos ni audio automático.

El reconocimiento de la celebración se guarda al iniciarla, de modo que recargar, cerrar o pulsar **Omitir animación** no la repite automáticamente. Si se migran dos etapas de una vez, se pueden recorrer sus celebraciones en orden; la representación del equipo ya utiliza la etapa más alta reconocida.

La línea evolutiva del perfil muestra formas desbloqueadas a color y las pendientes como siluetas con candado y requisitos. Consultar una forma anterior no la convierte en activa. **Revisar evolución** abre un recuerdo sin cambiar progreso o reconocimientos.

El diálogo bloquea el fondo, gestiona foco y tabulación, permite Escape/cerrar y respeta `prefers-reduced-motion`, que muestra el resultado directamente. La animación normal dura menos de dos segundos y siempre se puede omitir.

## Componentes y cambios

- `CompanionPortrait`: imágenes oficiales, `object-fit: contain`, proporción cuadrada y SVG existente como respaldo.
- `CompanionSelector`: selección por familia, preview y confirmación.
- `CompanionProgress`: métricas y requisito del próximo hito.
- `EvolutionLine`: consulta y revisión de formas.
- `EvolutionCelebration` / `EvolutionNotice`: experiencia de desbloqueo y repetición voluntaria.
- `ExpeditionPanel`: equipo compacto del mapa.
- `src/styles/companions.css`: escenas y composiciones responsive.

Se integraron en `store.tsx`, `App.tsx`, `TrainerSelect.tsx`, `Profile.tsx` y `GymMap.tsx`. `Art.tsx`, el catálogo académico, GamePlayer, GameArena y el protocolo de Memorama se conservaron. No se editó ningún otro repositorio.

Las formas futuras usan carga diferida donde procede; el selector solo solicita las cinco bases y la vista previa necesaria. La animación solicita únicamente sus dos formas. No se descargan las quince evoluciones en cada visita móvil.

## Pruebas

```sh
npx playwright test tests/evolution-rules.spec.ts
npx playwright test tests/companion-assets.spec.ts
npx playwright test tests/companions.spec.ts --browser chromium
npx playwright test tests/companions.spec.ts --browser webkit
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npm test
npm run build

# Tras publicar, usa los sitios y las imágenes reales:
VERIFY_COMPANIONS=1 npx playwright test tests/companions.spec.ts --browser chromium
VERIFY_COMPANIONS=1 npx playwright test tests/companions.spec.ts --browser webkit
```

Se verifican los umbrales y distribución, duplicados/IDs/fechas inválidos, veinte partidas del mismo juego sin sumar prácticas, migración, no involución, cambio de familia, saludo y escena reactivos, omisión de animación, no repetición al recargar, recuerdos, reinicio y fallback de imágenes.

Los viewports son 390×844, 820×1180, 1180×820 y 1440×900. Las capturas permiten revisar el equipo protagonista, selección y celebración; se comprueba `contain`, límites de los retratos, overflow y Axe A/AA. Las quince imágenes se inspeccionaron visualmente y todas midieron 1254×1254. Son pruebas con navegadores y tamaños emulados; no se afirma verificación en dispositivos físicos.
