import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import catalog from '../catalogo_optimizacion_gimnasios_1_a_5.json' with {type:'json'};
import {companions} from '../src/data/companions';

const publicMode=process.env.VERIFY_COMPANIONS==='1';
const host=publicMode?'https://israeltiburcio-ai.github.io/optilab/':'';
const go=(route:string)=>host+'#/'+route;
const date='2026-10-20T12:00:00Z';
function practices(counts:number[]){return Object.fromEntries(catalog.juegos.filter(g=>catalog.juegos.filter(x=>x.gimnasio===g.gimnasio).indexOf(g)<(counts[g.gimnasio-1]||0)).map(g=>[g.repo,date]));}
async function seed(page:Page,value:unknown){await page.addInitScript(p=>{if(!localStorage.getItem('optilab-v1'))localStorage.setItem('optilab-v1',JSON.stringify(p))},value);}
async function stored(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!));}
async function loadedImages(page:Page,selector:string){for(const image of await page.locator(selector).all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth>0),{timeout:20000}).toBe(true);await image.evaluate((i:HTMLImageElement)=>i.decode());expect(await image.evaluate(i=>getComputedStyle(i).objectFit)).toBe('contain');}}

for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]])test.describe(`equipo ${width}`,()=>{
  test.use({hasTouch:width===390});
  test(`bienvenida, equipo protagonista y evolución ${width}×${height}`,async({page})=>{
    test.setTimeout(90000);await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
    await seed(page,{practiced:practices([5,1]),nickname:'Israel',visited:[1,2]});
    await page.goto(go(''));await page.getByRole('link',{name:'Comenzar aventura',exact:true}).click();
    await page.getByRole('radio',{name:'Kai',exact:true}).check();await page.getByRole('button',{name:'Comenzar aventura',exact:true}).click();
    await expect(page.getByRole('heading',{name:'¡Elige a tu compañero de aventura!'})).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(5);
    for(const family of companions){await page.getByRole('radio',{name:family.name,exact:true}).check();await expect(page.locator('.trainer-story h2')).toHaveText(family.evolutions[1].name);}
    await page.getByRole('radio',{name:'Piv',exact:true}).check();
    await loadedImages(page,'.companion-roster img,.companion-preview-portrait img');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/companion-selector-${publicMode?'public':'local'}-${width}.png`,fullPage:true});
    const selectAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(selectAudit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();
    await expect(page.locator('.expedition-panel')).toContainText('Kai + Pivox');
    expect((await stored(page)).avatarId).toBe('avatar-01');expect((await stored(page)).companionId).toBe('piv');
    await page.reload();await expect(page.locator('.expedition-panel')).toContainText('Pivox');
    const guardians=await page.locator('.node-island>.companion-portrait').evaluateAll(nodes=>nodes.map(n=>({id:n.getAttribute('data-companion-id'),stage:n.getAttribute('data-stage')})));
    expect(new Set(guardians.map(g=>g.id)).size).toBe(5);expect(guardians.every(g=>g.stage==='1')).toBe(true);
    await page.getByRole('button',{name:'Evolucionar',exact:true}).click();
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading',{name:'¡Piv ha evolucionado a Pivox!'})).toBeVisible();
    await loadedImages(page,'.evolution-stage img');
    await page.screenshot({path:`test-results/evolution-${publicMode?'public':'local'}-${width}.png`});
    const evolutionAudit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(evolutionAudit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await dialog.getByRole('button',{name:'Regresar a la aventura'}).click();await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Evolucionar',exact:true})).toHaveCount(0);
    await page.goto(go(''));await expect(page.getByRole('heading',{level:1})).toHaveText('¡Bienvenido de nuevo, Israel!');
    await expect(page.locator('.hero-team-names')).toHaveText('Kai y Pivox');
    await expect(page.locator('.hero-team .companion-portrait')).toHaveAttribute('data-stage','2');
    await loadedImages(page,'.hero-team img');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/team-home-${publicMode?'public':'local'}-${width}.png`,fullPage:true});
    const scene=await page.locator('.hero-scene').boundingBox();
    for(const portrait of await page.locator('.hero-team>.avatar-portrait,.hero-team>.companion-portrait').all()){
      const box=await portrait.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(scene!.x);expect(box!.x+box!.width).toBeLessThanOrEqual(scene!.x+scene!.width+1);expect(box!.y+box!.height).toBeLessThanOrEqual(scene!.y+scene!.height+1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('link',{name:'Continuar aventura',exact:true}).click();await expect(page.locator('.world-map')).toBeVisible();
  });
});

test('práctica real desbloquea etapa 2, no involuciona y cambiar familia conserva hitos',async({page})=>{
  test.setTimeout(90000);await seed(page,{avatarId:'avatar-01',companionId:'piv',nickname:'Israel'});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(go('gimnasio/1'));for(let i=0;i<5;i++)await page.getByRole('button',{name:'Marcar como practicado'}).first().click();
  expect((await stored(page)).evolutionMilestones).toEqual([]);
  await page.goto(go('gimnasio/2'));await page.getByRole('button',{name:'Marcar como practicado'}).first().click();
  await expect(page.getByRole('button',{name:'Evolucionar',exact:true})).toBeVisible();
  expect((await stored(page)).evolutionMilestones.map((m:any)=>m.stage)).toEqual([2]);
  await page.getByRole('button',{name:'Evolucionar',exact:true}).click();await page.getByRole('button',{name:'Regresar a la aventura'}).click();
  await page.locator('.practice-toggle').first().click();await page.reload();
  await page.goto(go('aventura'));await expect(page.locator('.profile-companion-stage')).toContainText('Pivox');
  const milestones=(await stored(page)).evolutionMilestones;
  await page.getByRole('link',{name:'Cambiar compañero'}).click();await page.getByRole('radio',{name:'Dua',exact:true}).check();
  await expect(page.locator('.trainer-story h2')).toHaveText('Dualuna');await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();
  await expect(page.locator('.profile-companion-stage')).toContainText('Dualuna');expect((await stored(page)).evolutionMilestones).toEqual(milestones);
  await page.goto(go(''));await expect(page.locator('.hero-team-names')).toHaveText('Kai y Dualuna');
  await page.goto(go('aventura'));await page.getByRole('link',{name:'Cambiar entrenador'}).click();await page.getByRole('radio',{name:'Nova',exact:true}).check();await page.getByRole('button',{name:'Guardar entrenador'}).click();
  await page.goto(go(''));await expect(page.locator('.hero-team-names')).toHaveText('Nova y Dualuna');
});

test('migración de etapa 3, celebraciones una sola vez, revisión y reinicio completo',async({page})=>{
  test.setTimeout(90000);const previous={avatarId:'avatar-03',companionId:'nexo',practiced:practices([5,8,4,1]),visited:[1,2,3,4],nickname:'',route:['memorama-simplex'],results:[{date,answers:[1,0,2,1,0],score:5}],gameResults:[]};
  await seed(page,previous);await page.emulateMedia({reducedMotion:'reduce'});await page.goto(go('aventura'));
  await expect(page.locator('.profile-companion-stage')).toContainText('Nexarbor');const state=await stored(page);expect(state).toMatchObject(previous);expect(state.evolutionMilestones.map((m:any)=>m.stage)).toEqual([2,3]);
  for(const name of ['¡Nexo ha evolucionado a Nexor!','¡Nexor ha evolucionado a Nexarbor!']){
    await page.getByRole('button',{name:'Evolucionar',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(name);await page.getByRole('button',{name:'Regresar a la aventura'}).click();await page.reload();
  }
  await expect(page.getByRole('button',{name:'Evolucionar',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Ver Nexor, etapa 2'}).click();await page.getByRole('button',{name:'Revisar evolución a Nexor'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Cerrar evolución'}).click();expect((await stored(page)).evolutionCelebratedStage).toBe(3);
  await page.goto(go(''));await expect(page.getByRole('heading',{level:1})).toHaveText('¡Bienvenido de nuevo!');await expect(page.locator('.hero-team-names')).toHaveText('Ares y Nexarbor');
  await page.goto(go('aventura'));await page.getByRole('link',{name:'Cambiar compañero'}).click();await page.getByRole('radio',{name:'Brío',exact:true}).check();await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();
  await expect(page.locator('.profile-companion-stage')).toContainText('Bríomonte');
  await page.getByRole('button',{name:'Reiniciar progreso local'}).click();await page.getByRole('button',{name:'Sí, borrar progreso'}).click();
  const empty=await stored(page);expect(empty.companionId).toBeNull();expect(empty.avatarId).toBeNull();expect(empty.evolutionMilestones).toEqual([]);expect(empty.evolutionCelebratedStage).toBe(1);expect(empty.practiced).toEqual({});
});

test('registros inválidos, familia desconocida, un solo gimnasio y visitas no dan nuevas formas',async({page})=>{
  const six=practices([0,6]);const repeatedGames=Array.from({length:20},(_,i)=>({gameId:'memorama-simplex',runId:`b951c401-3f2a-4f61-a2c6-${String(i).padStart(12,'0')}`,date,completed:true,matchedPairs:8,totalPairs:8,attempts:8,errors:0,elapsedMs:1000,accuracy:100}));
  await seed(page,{avatarId:'avatar-01',companionId:'desconocida',practiced:{...six,externoProfesora:date},visited:[1,2,3,4,5],gameResults:repeatedGames,evolutionMilestones:[{stage:3,ruleVersion:1,unlockedAt:date,practice:Array.from({length:18},()=>({gameId:'memorama-simplex',practicedAt:date}))}],evolutionCelebratedStage:3});
  await page.goto(go('aventura'));const state=await stored(page);expect(state.companionId).toBeNull();expect(state.evolutionMilestones).toEqual([]);expect(state.evolutionCelebratedStage).toBe(1);expect(state.gameResults).toHaveLength(20);
  await expect(page.locator('.companion-progress')).toContainText('Etapa 1');await page.goto(go(''));await expect(page.getByRole('link',{name:'Elegir compañero',exact:true})).toBeVisible();
  await page.goto(go('optidex'));await expect(page.locator('.cartridge')).toHaveCount(28);await page.goto(go('mapa'));await expect(page.locator('.map-node')).toHaveCount(5);
});

test('animación se puede omitir y recargar no repite la celebración iniciada',async({page})=>{
  await seed(page,{avatarId:'avatar-01',companionId:'piv',practiced:practices([5,1])});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(go('aventura'));
  await page.getByRole('button',{name:'Evolucionar',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Omitir animación'}).click();
  await expect(page.getByRole('dialog').getByRole('heading')).toHaveText('¡Piv ha evolucionado a Pivox!');
  await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Evolucionar',exact:true})).toHaveCount(0);
});

test('fallbacks de criaturas siguen permitiendo elegir familia sin Cloudinary',async({page})=>{
  await page.route('https://res.cloudinary.com/**',r=>r.abort());await page.goto(go('companero'));
  await expect(page.getByRole('radio')).toHaveCount(5);await expect(page.locator('.companion-roster [data-asset-fallback]')).toHaveCount(5);
  await page.getByRole('radio',{name:'Poli',exact:true}).check();await page.getByRole('button',{name:'Elegir compañero',exact:true}).click();await expect(page.locator('.expedition-panel')).toContainText('Poli');
});
