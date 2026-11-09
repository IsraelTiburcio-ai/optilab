import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Brand Kit: shell, PWA and responsive accessibility',async({page,request})=>{
 await page.goto('/');
 const principal=page.locator('.brand .brand-logo');
 const footer=page.locator('.footer-brand .brand-logo');
 await expect(principal).toBeVisible();
 await expect(footer).toBeVisible();
 await expect(principal).toHaveAttribute('src',/\/optilab\/brand\/svg\/optilab-logo-principal\.svg$/);
 await expect(footer).toHaveAttribute('src',/\/optilab\/brand\/svg\/optilab-logotipo-color\.svg$/);
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#073E33');
 await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href',/\/optilab\/brand\/pwa\/favicon\.svg$/);
 await expect(page.locator('link[rel="icon"][sizes="any"]')).toHaveAttribute('href',/\/optilab\/brand\/pwa\/favicon\.ico$/);
 await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href',/\/optilab\/brand\/pwa\/apple-touch-icon\.png$/);
 const manifestHref=await page.locator('link[rel="manifest"]').getAttribute('href');
 expect(manifestHref).toMatch(/\/optilab\/site\.webmanifest$/);
 const manifestUrl=new URL(manifestHref!,page.url()).href;
 const manifestResponse=await request.get(manifestUrl);
 expect(manifestResponse.ok()).toBe(true);
 const manifest=await manifestResponse.json();
 expect(manifest).toMatchObject({name:'OptiLab · La aventura del conocimiento',short_name:'OptiLab',lang:'es',start_url:'.',scope:'.',display:'standalone',background_color:'#F9F5E9',theme_color:'#073E33'});
 expect(manifest.icons.map((icon:{sizes:string})=>icon.sizes).sort()).toEqual(['192x192','512x512']);
 for(const icon of manifest.icons){const response=await request.get(new URL(icon.src,manifestUrl).href);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');}
 for(const width of [390,820,1440]){
  await page.setViewportSize({width,height:900});
  await expect(principal).toBeVisible();
  await expect(page.locator('.site-header')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:900});
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(audit.violations).toEqual([]);
});
