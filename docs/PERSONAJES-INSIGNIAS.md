# Personalización · entrenadores e insignias Cloudinary

## Experiencia

La portada conserva su diseño. **Comenzar aventura** lleva a `#/entrenador` si no existe una elección confirmada, o al mapa si ya se guardó un entrenador. La pantalla ofrece seis personajes, selección táctil/teclado, vista previa, personalidad y confirmación. **Mi aventura → Cambiar entrenador** permite cambiarlo o cancelar sin modificar la elección.

Kai, Mika, Ares, Lyra, Zane y Nova son opciones equivalentes: no cambian juegos, resultados, rutas ni acceso a gimnasios. El personaje se muestra en el perfil y en la cabecera de expedición del mapa. No se exige nombre ni registro.

Las rutas directas al mapa, OptiDex, gimnasios y Memorama siguen funcionando sin pasar por el selector. Si todavía no se confirmó un avatar, Kai se usa como representación predeterminada; eso no cuenta como una elección guardada.

## Datos y fuentes

- `src/data/avatars.ts`: array TypeScript `avatars` con los seis IDs y URLs originales, nombres, personalidad y lema.
- `src/data/badges.ts`: array TypeScript `badges` con las nueve URLs originales; `gymBadges` y `specialBadges` definen la correspondencia estable.
- No se duplican las imágenes en el repositorio ni se sustituyen las URLs por recursos inventados.
- Imágenes WebP con transparencia, `object-fit: contain`, dimensiones explícitas y fallbacks vectoriales. No se recortan personajes ni objetos.

Se inspeccionaron los 15 originales en una lámina generada por `tests/asset-inspection.spec.ts` antes de elegir las correspondencias. Los seis avatares miden 1024×1536 y las nueve insignias 1254×1254.

## Correspondencia visual

| Gimnasio | Nombre conservado | ID de asset | Motivo de la elección visual |
|---|---|---|---|
| 1 · Sistemas | Sistema | `badge-09` | Tres nodos morados conectados: componentes y relaciones. |
| 2 · Programación Lineal | Lineal | `badge-06` | Retícula naranja de rombos: geometría y regiones. |
| 3 · Simplex | Pivote | `badge-01` | Rotor naranja con un eje central: pivote y movimiento. |
| 4 · Dualidad | Espejo | `badge-05` | Dos esferas en equilibrio: perspectivas relacionadas. |
| 5 · Programación de Metas | Meta | `badge-02` | Cumbre azul: objetivo y avance hacia una meta. |

Los IDs no dependen del orden de renderizado de gimnasios ni del índice del array de imágenes.

| Recompensa adicional | ID | Estado |
|---|---|---|
| Horizonte · brújula estelar | `badge-03` | Futura, sin regla de obtención implementada |
| Prioridades · torre de niveles | `badge-04` | Futura, sin regla de obtención implementada |
| Conexión · circuito verde | `badge-07` | Futura, sin regla de obtención implementada |
| Rumbo · marcador dorado | `badge-08` | Futura, sin regla de obtención implementada |

Estas cuatro no se conceden automáticamente ni se vinculan a calificaciones o dominio académico.

## Progreso y estados

La clave existente `optilab-v1` añade únicamente `avatarId: string | null`. Se valida contra los seis IDs. Un ID desconocido o la ausencia del campo producen el valor predeterminado sin borrar prácticas, visitas, apodo, ruta, diagnósticos o historial integrado. La elección solo se escribe al confirmar y queda en memoria si `localStorage` no está disponible, con el aviso existente.

Las cinco insignias mantienen exactamente su condición original: **todos los juegos del gimnasio marcados manualmente como practicados**. Se recalculan al marcar/desmarcar. Completar Memorama o aprobar el diagnóstico no las concede automáticamente.

- Bloqueada: imagen desaturada, menor opacidad, candado y explicación de la condición.
- Conseguida: color, brillo moderado y animación breve al pasar de bloqueada a conseguida en una vista montada.
- Fecha: si existen las fechas válidas de todas las prácticas, se muestra la fecha de la última, que es el momento en que se cumple la condición. No se inventa una fecha si falta esa información.
- Se respeta `prefers-reduced-motion`.

Las imágenes aparecen en los cinco puntos del mapa, el panel de destino, los interiores de gimnasio y la colección de progreso de Mi aventura. Las cuatro especiales se muestran aparte como futuras.

## Componentes

- `AssetImage`: carga, dimensiones, `contain` y recuperación ante error.
- `AvatarPortrait`: personaje o retrato vectorial original de respaldo.
- `GymBadge`: correspondencia, estado accesible, candado, brillo y animación. Usa el SVG anterior como fallback.
- `TrainerSelect`: nueva selección de entrenador.
- `GymMap` y `Profile`: se extrajeron de `App.tsx` para integrar la personalización conservando sus experiencias y controles anteriores.
- `Progress`: barra compartida sin cambio de semántica.
- `personalization.css`: composiciones específicas de celular, tablet vertical/horizontal y escritorio.

`Art.tsx` conserva todos sus SVG originales. GamePlayer, GameArena, protocolo e integración del memorama permanecen intactos. No se modifican los repositorios de los 28 juegos.

## QA reproducible

```sh
npx playwright test tests/asset-inspection.spec.ts
npx playwright test tests/personalization.spec.ts --browser chromium
npx playwright test tests/personalization.spec.ts --browser webkit

# Regresión completa, incluido el candidato del juego integrado
MEMORAMA_DIR="/ruta/absoluta/memorama-simplex" npm test
npm run build

# Personalización sobre el sitio publicado
VERIFY_PERSONALIZATION=1 npx playwright test tests/personalization.spec.ts --browser chromium
VERIFY_PERSONALIZATION=1 npx playwright test tests/personalization.spec.ts --browser webkit
```

Las pruebas de personalización verifican los seis personajes, preview, confirmación, recarga, omisión del selector tras elegir, edición/cancelación, migración de un perfil anterior con resultados reales de juego, correspondencia de cinco insignias, regla de obtención/desmarcado, cuatro futuras, selección por teclado, recuperación de IDs inválidos y fallos forzados de Cloudinary. Los viewports son 390×844, 820×1180, 1180×820 y 1440×900. Se comprueban imágenes cargadas, dimensiones táctiles, `object-fit`, overflow y reglas Axe A/AA.

Las pruebas públicas usan la aplicación y los assets reales; solo el caso explícito de fallo de imagen bloquea Cloudinary para verificar sus fallbacks. Los motores y tamaños son emulados, no dispositivos físicos. La disponibilidad de las imágenes depende de Cloudinary; la selección y navegación siguen funcionando con los respaldos si falla su carga.
