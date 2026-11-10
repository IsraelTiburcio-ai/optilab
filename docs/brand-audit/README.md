# Evidencia visual · PR #60

Comparación realizada desde `main` `2fe4087` (antes) contra la implementación de esta PR (después). No se modificaron datos, lógica académica, ranking, juegos, autenticación ni backend.

## Capturas

| Viewport | Antes | Después |
| --- | --- | --- |
| 390 | `before/390-home.png`, `before/390-header.png` | `after/390-home.png`, `after/390-header.png` |
| 820 | `before/820-home.png`, `before/820-header.png` | `after/820-home.png`, `after/820-header.png` |
| 1440 | `before/1440-home.png`, `before/1440-header.png` | `after/1440-home.png`, `after/1440-header.png` |

Comparaciones de header: `comparison-390-header.png`, `comparison-820-header.png`, `comparison-1440-header.png`.

## Métricas locales

`metrics.json` registra LCP, CLS, altura del header y overflow horizontal en preview local. El LCP local no equivale a una medición de campo. El CLS se mantiene en el mismo orden que la línea base; el header conserva 78/95/100 px y no aparece scroll horizontal. La diferencia de CLS en 820 px es de 0.002 y está dentro de la variación entre ejecuciones.

## Accesibilidad y PWA

- Axe sin violaciones WCAG 2A/2AA/2.1AA en 390, 820 y 1440.
- `theme-color` `#073E33`; contraste de texto principal `#06392F` sobre crema 11.79:1.
- Acento verde `#138158` solo en textos grandes/decorativos sobre crema (4.47:1); no se usa para texto pequeño.
- Coral `#D76242` se reserva para foco/acento (3.37:1 sobre crema, suficiente para indicador no textual).
- Manifest PWA reconocido por Chromium con 0 errores; iconos 192/512, SVG/ICO y Apple Touch responden 200.
- Recursos locales resueltos con `BASE_URL` en React y rutas relativas en HTML para funcionar en `/optilab/` y en la raíz del dominio.

## Comandos

```bash
npm run build
npm run typecheck:academic
node scripts/verify-brand-assets.mjs
npx playwright test tests/brand-integration.spec.ts --browser chromium
npx playwright test tests/brand-integration.spec.ts --browser webkit
```

La verificación remota de Cloudinary no forma parte del build.
