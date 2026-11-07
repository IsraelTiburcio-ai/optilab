# Rediseño de actividades y gimnasios

## Análisis de impacto

El modelo actual separa:

- Definiciones y asignaciones externas por grupo (`groupActivities`).
- Orden externo por gimnasio (`activityPlacements`).
- Los 28 juegos originales, que viven solo en el catálogo estático y no tienen configuración por grupo.
- La UI del alumno, que renderiza primero los originales y luego una sección separada de complementos.

Por eso no se puede resolver el orden/visibilidad conjunto solo con React: hace falta persistir una configuración por curso, periodo, grupo y gimnasio.

## PR1 — publicación sencilla y tarjetas unificadas

- El docente pega un enlace público de LearningApps o Wordwall.
- El cliente detecta proveedor, `resourceId`, URL de origen y embed cuando es derivable.
- LearningApps deriva `watch` → `show.php`.
- Wordwall público no permite inventar el embed: se guarda con `embedUrl:null` y se abre externamente de forma segura.
- No se aceptan HTML, hosts ajenos, IDs escritos por el docente ni URLs de embed arbitrarias.
- `Publicar actividad` guarda y publica en una acción; borrador y vista previa siguen disponibles.
- Las actividades de grupo se renderizan dentro de `.game-grid` con las tarjetas de los juegos originales.

## PR2 — administrador visual

La implementación posterior agregará un documento de layout por grupo/gimnasio, separado de `activityPlacements` para no invalidar los datos existentes:

```text
courses/{courseId}/terms/{termId}/groups/{groupId}/gymLayouts/{gymId}
{
  schemaVersion: 1,
  courseId, termId, groupId, gymId,
  orderedActivityIds: [...originales y externas...],
  hiddenOriginalGameIds: [...],
  revision,
  updatedBy,
  updatedAt
}
```

- El orden combina IDs de juegos originales y actividades externas.
- La visibilidad de originales se guarda en `hiddenOriginalGameIds`.
- La visibilidad externa sigue usando el estado de la asignación (`published`/`hidden`).
- Una operación backend autorizada guarda el layout con CAS; los alumnos solo leen su grupo.
- El editor mostrará una lista única por gimnasio, drag-and-drop, botones Subir/Bajar, toggles de visibilidad, vista previa y restauración del orden base.
- Los juegos originales no se eliminan del catálogo ni se borran historiales/progreso.

## Compatibilidad y reversión

- PR1 mantiene el contrato anterior y acepta actividades con o sin embed.
- PR2 no modifica documentos existentes hasta que el docente guarda un layout.
- Sin layout, el alumno recibe el orden base: originales del catálogo + externas publicadas.
- Revertir el frontend no requiere tocar los datos de actividades.

## Validación

- Parser y allowlist de enlaces.
- Publicación con y sin embed.
- Tarjetas unificadas en Chromium/WebKit.
- Aislamiento por grupo y denegación a alumnos.
- Tests académicos, typecheck y build.
