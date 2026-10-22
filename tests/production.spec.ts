import {test,expect} from '@playwright/test';
test('cinco portadas Simplex originales y diferenciadas en OptiDex',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('#/optidex');
 await page.getByRole('button',{name:'Gimnasio 3 5',exact:true}).click();
 await expect(page.locator('.simplex-cover')).toHaveCount(5);
 expect(new Set(await page.locator('.simplex-cover').evaluateAll(art=>art.map(s=>s.innerHTML))).size).toBe(5);
 await expect(page.locator('.game-glyph')).toHaveCount(0);
 for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]]){
   await page.setViewportSize({width,height});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`test-results/simplex-covers-${width}.png`,fullPage:true});
 }
});
test('estado corrupto se recupera sin bloquear el catálogo',async({page})=>{await page.addInitScript(()=>localStorage.setItem('optilab-v1','{corrupto'));await page.goto('#/optidex');await expect(page.locator('.cartridge')).toHaveCount(28);await page.locator('.practice-toggle').first().click();await expect(page.locator('.practice-toggle').first()).toHaveAttribute('aria-pressed','true')});
test('filtros pendientes y práctica se actualizan de forma conjunta',async({page})=>{await page.goto('#/optidex');await page.getByRole('checkbox',{name:'Solo pendientes'}).check();await expect(page.locator('.cartridge')).toHaveCount(28);await page.locator('.practice-toggle').first().click();await expect(page.locator('.cartridge')).toHaveCount(27);await page.getByRole('checkbox',{name:'Solo pendientes'}).uncheck();await expect(page.locator('.cartridge')).toHaveCount(28)});
test('capturas de presentación con animación terminada',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]]){await page.setViewportSize({width,height});for(const route of ['','mapa','gimnasio/3']){await page.goto('#/'+route);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`test-results/presentacion-${width}-${route.replace('/','-')||'inicio'}.png`,fullPage:true})}}});
