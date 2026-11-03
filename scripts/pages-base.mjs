/** Exact GitHub Pages targets; no URL or arbitrary base path is accepted. */
export function pagesBase(target) {
  if (target === undefined || target === '' || target === 'github-pages') return '/optilab/';
  if (target === 'optilab.club') return '/';
  throw new Error(`Unsupported OptiLab Pages target: ${target}`);
}
