import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]]) test(`cuenta sin configurar ${width}×${height}: invitado, responsive y accesibilidad`,async({page})=>{
  await page.setViewportSize({width,height});
  // Audit the settled/reduced-motion view, not the transient opacity of the RPG entry animation.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('#/cuenta');
  await expect(page.getByRole('heading',{name:'Tu cuenta OptiLab'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeDisabled();
  await expect(page.getByText('El acceso con cuenta necesita configuración')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.getByRole('link',{name:'Cuenta',exact:true}).count()).toBe(1);
  if(width===390){const rows=await page.locator('.site-header nav a').evaluateAll(links=>links.map(a=>Math.round(a.getBoundingClientRect().top)));expect(new Set(rows).size).toBe(1);}
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole('link',{name:'Continuar como invitado'}).click();
  await expect(page.locator('.map-node')).toHaveCount(5);
});
