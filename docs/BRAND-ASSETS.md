# OptiLab Brand Kit

Fuente: `OptiLab_Identidad_Arquitectura_01`, reconstrucción vectorial interpretada del diseño aprobado en noviembre de 2026. El paquete original no estaba aplicado a la interfaz y esta entrega tampoco la modifica.

## Contenido

| Ruta | Uso |
| --- | --- |
| `public/brand/svg/` | Fuentes vectoriales editables para logos e isotipos. |
| `public/brand/pwa/` | Set canónico PWA/navegador: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`. |
| `public/brand/app-icons/` | Iconos de aplicación a 1024 px para tiendas o usos de alta resolución. |
| `brand-assets.json` | Manifiesto con `public_id`, URL original y variantes de entrega de los PNG alojados en Cloudinary. |
| `scripts/verify-brand-assets.mjs` | Verificación local y, opcionalmente, remota. |

No se incluyen los PNG originales de logotipos en el repositorio porque su entrega se resuelve desde el CDN. Tampoco se duplican los favicons redundantes: `Web/18_Favicon_180x180.png` y `Web/18_Favicon_512x512.png` eran idénticos a `apple-touch-icon.png` e `icon-512.png`.

## Rutas en Vite

Vite sirve el contenido de `public/` bajo su `base`. En GitHub Pages la base es `/optilab/`; en el dominio propio es `/`. Por eso el manifiesto guarda:

- `path`: ruta física del repositorio, por ejemplo `public/brand/pwa/icon-192.png`.
- `vite_path`: ruta relativa a `import.meta.env.BASE_URL`, por ejemplo `brand/pwa/icon-192.png`.

Para consumirla en la futura interfaz:

```tsx
const icon = `${import.meta.env.BASE_URL}${brand.pwa.icon192.vite_path}`;
```

No usar `/brand/...` como ruta absoluta: rompería el despliegue bajo `/optilab/`.

## Cloudinary

El MCP oficial se registró con:

```bash
opencode mcp add cloudinary --url https://asset-management.mcp.cloudinary.com/mcp
opencode mcp auth cloudinary
```

La autenticación es OAuth y vive fuera del repositorio. No hay API keys, secretos ni tokens en este directorio ni en el manifiesto.

Carpeta remota: `optilab/brand/`.

Los archivos raster se subieron una sola vez como originales. Las variantes son transformaciones de URL, no copias almacenadas:

```text
f_auto,q_auto,w_<ancho>,c_limit
```

`f_auto` selecciona el mejor formato compatible, `q_auto` optimiza calidad y `c_limit` conserva proporción y transparencia sin recortar.

## Actualización futura

1. Aprobar el cambio visual antes de tocar el manifiesto o la interfaz.
2. Reemplazar el archivo fuente en `public/brand/` manteniendo el nombre canónico y sin duplicar variantes locales.
3. Para un raster nuevo o reemplazado, reutilizar el `public_id` existente desde el MCP de Cloudinary y mantener las URLs de variantes generadas por transformación. No crear copias por tamaño.
4. Si cambia el contenido de un raster, actualizar `bytes`, dimensiones, `sha256`, `version` y `original_url` en `brand-assets.json`.
5. Ejecutar `node scripts/verify-brand-assets.mjs` antes del build. Ejecutar `node scripts/verify-brand-assets.mjs --remote` solo cuando haya red y Cloudinary disponible; no forma parte del build.
6. Revisar visualmente transparencia, proporción y contraste en fondo claro y oscuro antes de la integración.

No volver a subir assets ni regenerar variantes si el contenido no cambió.

## Validación

```bash
node scripts/verify-brand-assets.mjs
node scripts/verify-brand-assets.mjs --remote
npm run build
```

La verificación remota es independiente del build para que Cloudinary no sea una dependencia de CI o despliegue.

## Integración pendiente

Este paquete no está conectado a `index.html`, al manifiesto PWA, a estilos ni a componentes. La aplicación debe seguir mostrando la identidad anterior hasta la PR de interfaz #60.
