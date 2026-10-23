import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {avatars} from '../src/data/avatars';
import {badges, gymBadges, specialBadges} from '../src/data/badges';
import catalog from '../catalogo_optimizacion_gimnasios_1_a_5.json' with {type:'json'};

const publicMode = process.env.VERIFY_PERSONALIZATION === '1';
const host = publicMode ? 'https://israeltiburcio-ai.github.io/optilab/' : '';
const go = (path: string) => host + '#/' + path;

for (const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]]) {
  test.describe(`entrenadores ${width}`, () => {
    test.use({hasTouch: width === 390});
    test(`selección, vista previa, persistencia y cambio ${width}×${height}`, async ({page}) => {
      test.setTimeout(90000);
      await page.setViewportSize({width,height});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.goto(go(''));
      await page.getByRole('link',{name:'Comenzar aventura',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Elige a tu entrenador'})).toBeVisible();
      await expect(page.getByRole('radio')).toHaveCount(6);
      for (const a of avatars) {
        const option = page.getByRole('radio',{name:a.name,exact:true});
        if (width === 390) await option.locator('..').tap(); else await option.check();
        await expect(option).toBeChecked();
        await expect(page.locator('.trainer-story h2')).toHaveText(a.name);
      }
      await expect.poll(() => page.locator('.trainer-preview img').evaluate((img: HTMLImageElement)=>img.complete&&img.naturalWidth>0),{timeout:20000}).toBe(true);
      await expect.poll(() => page.locator('.trainer-roster img').evaluateAll(images=>images.every((img: HTMLImageElement)=>img.complete&&img.naturalWidth>0)),{timeout:20000}).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const radioBoxes = await page.locator('.trainer-slot').evaluateAll(labels=>labels.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
      expect(radioBoxes.every(b=>b.width>=44&&b.height>=44)).toBe(true);
      await page.screenshot({path:`test-results/trainers-${publicMode?'public':'local'}-${width}.png`,fullPage:true});
      const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
      await page.getByRole('button',{name:'Comenzar aventura',exact:true}).click();
      await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();
      await expect(page.locator('.traveler-strip')).toContainText('Nova');
      await page.reload();await expect(page.locator('.traveler-strip')).toContainText('Nova');
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!).avatarId)).toBe('avatar-06');
      await page.goto(go(''));
      await page.getByRole('link',{name:'Continuar aventura',exact:true}).click();
      await expect(page.locator('.world-map')).toBeVisible();
      await expect(page.getByRole('heading',{name:'Elige a tu entrenador'})).toHaveCount(0);
      await page.goto(go('aventura'));
      await expect(page.locator('.profile-portrait-stage')).toContainText('Nova');
      await page.getByRole('link',{name:'Cambiar entrenador'}).click();
      await page.getByRole('radio',{name:'Lyra',exact:true}).check();
      await page.getByRole('button',{name:'Guardar entrenador'}).click();
      await expect(page.locator('.profile-portrait-stage')).toContainText('Lyra');
      await page.reload();await expect(page.locator('.profile-portrait-stage')).toContainText('Lyra');
      await expect(page.locator('.badge-collection .gym-badge')).toHaveCount(5);
      await expect(page.locator('.special-badge-card')).toHaveCount(4);
      await expect(page.locator('.special-badge-card .future-label')).toHaveText(['Próximamente','Próximamente','Próximamente','Próximamente']);
      for (const image of await page.locator('.badge-collection img, .special-badge-card img').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(()=>image.evaluate((img: HTMLImageElement)=>img.complete&&img.naturalWidth>0),{timeout:20000}).toBe(true);
        await image.evaluate((img: HTMLImageElement)=>img.decode());
        expect(await image.evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain');
      }
      await page.evaluate(()=>scrollTo(0,0));
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const profileAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(profileAudit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
      await page.screenshot({path:`test-results/trainer-profile-${publicMode?'public':'local'}-${width}.png`,fullPage:true});
    });
  });
}

test('migración conserva todo el progreso y fechas; insignias tienen correspondencia estable',async({page})=>{
  const practiced=Object.fromEntries(catalog.juegos.filter(g=>g.gimnasio===3).map((g,i)=>[g.repo,`2026-10-${String(10+i).padStart(2,'0')}T12:00:00Z`]));
  const gameResult={gameId:'memorama-simplex',runId:'b951c401-3f2a-4f61-a2c6-19df8fbe0024',date:'2026-10-14T12:00:00Z',completed:true,matchedPairs:8,totalPairs:8,attempts:9,errors:1,elapsedMs:42000,accuracy:89};
  const prior={practiced,visited:[1,3],badges:[3],nickname:'Explorador anterior',route:['memorama-simplex'],results:[{date:'2026-10-14T12:00:00Z',answers:[1,0,2,1,0],score:5}],gameResults:[gameResult]};
  await page.addInitScript(p=>{if(!localStorage.getItem('optilab-v1'))localStorage.setItem('optilab-v1',JSON.stringify(p))},prior);
  await page.goto(go('aventura'));
  await expect(page.getByRole('img',{name:'Kai, entrenador de OptiLab',exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'Insignia Pivote: obtenida',exact:true})).toBeVisible();
  await expect(page.locator('time')).toHaveAttribute('dateTime','2026-10-14T12:00:00.000Z');
  for(const b of gymBadges){const item=page.locator(`.badge-collection [data-gym-id="${b.gymId}"]`);await expect(item).toHaveAttribute('data-badge-id',b.assetId);await expect(item.locator('img')).toHaveAttribute('src',badges.find(x=>x.id===b.assetId)!.image);}
  expect(new Set([...gymBadges.map(b=>b.assetId),...specialBadges.map(b=>b.assetId)]).size).toBe(9);
  await page.getByRole('link',{name:'Cambiar entrenador'}).click();
  await page.getByRole('radio',{name:'Mika',exact:true}).check();
  await page.getByRole('button',{name:'Guardar entrenador'}).click();
  await expect(page.locator('.profile-portrait-stage')).toContainText('Mika');
  await page.reload();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!));
  expect(stored).toMatchObject({...prior,avatarId:'avatar-02'});
  await page.goto(go('mapa'));
  await expect(page.locator('.map-panel .gym-badge')).toHaveAttribute('data-badge-id','badge-01');
  await expect(page.locator('.map-panel .gym-badge')).toHaveClass(/is-earned/);
  await page.goto(go('gimnasio/3'));
  await expect(page.locator('.gym-banner .gym-badge')).toHaveClass(/is-earned/);
  await page.locator('.practice-toggle').first().click();
  await expect(page.locator('.gym-banner .gym-badge')).toHaveClass(/is-locked/);
  await page.locator('.practice-toggle').first().click();
  await expect(page.locator('.gym-banner .gym-badge')).toHaveClass(/is-earned/);
  await expect(page.locator('.gym-banner .gym-badge')).toHaveClass(/just-earned/);
  await page.goto(go('aventura'));
  await expect(page.locator('.badge-collection .gym-badge.is-earned')).toHaveCount(1);
  await expect(page.locator('.special-badge-card')).toHaveCount(4);
});

test('rutas directas y cambio cancelado funcionan sin obligar a elegir',async({page})=>{
  await page.goto(go('optidex'));await expect(page.locator('.cartridge')).toHaveCount(28);
  await page.goto(go('mapa'));await expect(page.locator('.map-node')).toHaveCount(5);
  await page.goto(go('aventura'));await expect(page.locator('.profile-portrait-stage')).toContainText('Kai');
  await page.getByRole('link',{name:'Cambiar entrenador'}).click();
  await page.getByRole('radio',{name:'Ares',exact:true}).check();
  await page.getByRole('link',{name:'Cancelar',exact:true}).click();
  await expect(page.locator('.profile-portrait-stage')).toContainText('Kai');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!).avatarId)).toBeNull();
});

test('selección por teclado y recuperación de un ID de avatar desconocido',async({page})=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('optilab-v1'))localStorage.setItem('optilab-v1',JSON.stringify({avatarId:'avatar-inexistente',nickname:'Mi bitácora',practiced:{'memorama-simplex':'2026-10-14T12:00:00Z'}}));
  });
  await page.goto(go('entrenador'));
  const kai=page.getByRole('radio',{name:'Kai',exact:true});
  await expect(kai).toBeChecked();await kai.focus();await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio',{name:'Mika',exact:true})).toBeChecked();
  await expect(page.locator('.trainer-story h2')).toHaveText('Mika');
  await page.getByRole('button',{name:'Comenzar aventura'}).click();
  await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();
  await expect(page.locator('.traveler-strip')).toContainText('Mika');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!));
  expect(stored.avatarId).toBe('avatar-02');expect(stored.nickname).toBe('Mi bitácora');expect(stored.practiced).toHaveProperty('memorama-simplex');
});

test('assets fallidos conservan selección, nombres e insignias mediante SVG',async({page})=>{
  await page.route('https://res.cloudinary.com/**',route=>route.abort());
  await page.goto(go('entrenador'));await expect(page.getByRole('radio')).toHaveCount(6);
  await expect(page.locator('.trainer-roster [data-asset-fallback]')).toHaveCount(6);
  await page.getByRole('radio',{name:'Zane',exact:true}).check();
  await expect(page.locator('.trainer-story h2')).toHaveText('Zane');
  await page.getByRole('button',{name:'Comenzar aventura'}).click();
  await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();
  await expect(page.locator('.traveler-strip')).toContainText('Zane');
  await page.goto(go('aventura'));
  for(const item of await page.locator('.badge-collection .gym-badge').all())await item.scrollIntoViewIfNeeded();
  await expect(page.locator('.badge-collection .gym-badge [data-asset-fallback]')).toHaveCount(5);
  await expect(page.getByRole('img',{name:'Insignia Pivote: pendiente',exact:true})).toBeVisible();
});
