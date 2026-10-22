import {test, expect, type Page, type FrameLocator} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const remote = 'https://israeltiburcio-ai.github.io/memorama-simplex/';
const sizes = [[390,844],[820,1180],[1180,820],[1440,900]];
test.skip(!process.env.MEMORAMA_DIR, 'Define MEMORAMA_DIR con el clon del juego para probar ambos cambios locales.');

async function localGame(page: Page) {
  // Keep the real remote origin in the browser; serve the candidate commit locally.
  await page.route('https://israeltiburcio-ai.github.io/memorama-simplex/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get('http://127.0.0.1:5190/' + url.pathname.replace('/memorama-simplex/', '') + url.search);
    await route.fulfill({response});
  });
}

async function boardPairs(frame: FrameLocator) {
  return frame.locator('#board').evaluate(board => {
    const data = (window as any).MEMORAMA_DATA.pairs;
    const text = (html: string) => {const el = document.createElement('div'); el.innerHTML = html; return el.textContent!.replace(/\s+/g,' ').trim();};
    const groups: Record<string, number[]> = {};
    board.querySelectorAll('.card-text').forEach((el, i) => {
      const content = el.textContent!.replace(/\s+/g,' ').trim();
      const pair = data.find((p: any) => text(p.a) === content || text(p.b) === content);
      if (!pair) throw new Error('Carta no corresponde al banco académico');
      (groups[pair.id] ||= []).push(i);
    });
    return Object.values(groups);
  });
}

async function complete(frame: FrameLocator, pairs: number[][], from = 0) {
  for (const pair of pairs.slice(from)) {
    await frame.locator('.card').nth(pair[0]).click();
    await frame.locator('.card').nth(pair[1]).click();
  }
  await expect(frame.locator('#end')).toBeVisible();
}

for (const [width,height] of sizes) {
  test(`piloto ${width}×${height}: partida real, error, finalización, regreso y persistencia`, async ({page,context}) => {
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    await localGame(page);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('#/gimnasio/3');
    await page.locator('.cartridge').filter({hasText:'Memorama Simplex'}).locator('a.play').click();
    await expect(page.locator('.player-status')).toContainText('Conectado');
    expect(context.pages()).toHaveLength(1);
    const frame = page.frameLocator('.player-frame-shell iframe');
    await expect(frame.locator('html')).toHaveClass('optilab-embedded');
    await frame.locator('#btn-play').click();
    const pairs = await boardPairs(frame);
    expect(pairs).toHaveLength(8);
    // Intentionally make one real mismatch: accuracy must be 8/9 = 89%, not a fabricated win.
    await frame.locator('.card').nth(pairs[0][0]).click();
    await expect(page.locator('.player-status')).toContainText('Partida en curso');
    await frame.locator('.card').nth(pairs[1][0]).click();
    await expect(frame.locator('.card.is-miss')).toHaveCount(0);
    await frame.locator('.card').nth(pairs[0][0]).click();
    await frame.locator('.card').nth(pairs[0][1]).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!).gameResults.length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await frame.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/pilot-${width}-playing.png`,fullPage:true});
    await complete(frame, pairs, 1);
    await expect(page.getByRole('heading',{name:'Memorama Simplex completado',exact:true})).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!));
    expect(stored.gameResults).toHaveLength(1);
    expect(stored.gameResults[0]).toMatchObject({gameId:'memorama-simplex',completed:true,matchedPairs:8,totalPairs:8,attempts:9,errors:1,accuracy:89});
    expect(stored.practiced).toEqual({});
    expect(stored.badges).toEqual([]);
    const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
    expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.screenshot({path:`test-results/pilot-${width}-completed.png`,fullPage:true});
    await page.getByRole('link',{name:'Regresar a Fortaleza Simplex',exact:true}).click();
    await expect(page.locator('.gym-banner h1')).toHaveText('Fortaleza Simplex');
    await expect(page.locator('.completion-label')).toContainText('89%');
    await page.reload();
    await expect(page.locator('.completion-label')).toContainText('89%');
    await page.goto('#/aventura');
    await expect(page.locator('.game-result-panel')).toContainText('89%');
    expect(errors).toEqual([]);
  });

  test(`independiente ${width}×${height}: completa partida sin host`, async ({page}) => {
    await page.setViewportSize({width,height});
    await localGame(page);
    await page.goto(remote);
    await expect(page.locator('html')).not.toHaveClass('optilab-embedded');
    await page.locator('#btn-play').click();
    // Shared helpers accept a frame-like page locator surface.
    const pairs = await boardPairs(page as unknown as FrameLocator);
    await complete(page as unknown as FrameLocator, pairs);
    await expect(page.locator('#end-accuracy')).toHaveText('100%');
    await expect(page.locator('#end-attempts')).toHaveText('8');
    await page.locator('#btn-again').click();
    await expect(page.locator('#stat-pairs')).toHaveText('0/8');
    await expect(page.locator('html')).not.toHaveClass('optilab-embedded');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('mensajes falsos: origen, source, sesión, juego, esquema, orden y datos incoherentes', async ({page}) => {
  await localGame(page);
  await page.goto('#/jugar/memorama-simplex');
  await expect(page.locator('.player-status')).toContainText('Conectado');
  await page.evaluate(() => {
    const f = document.querySelector('iframe')!;
    const session = new URL(f.src).searchParams.get('optilabSession');
    const runId = crypto.randomUUID();
    const base = {protocol:'optilab-game',version:1,gameId:'memorama-simplex',session,type:'game:completed',runId,
      result:{completed:true,matchedPairs:8,totalPairs:8,attempts:8,errors:0,elapsedMs:1000,accuracy:100}};
    const emit = (data: any, origin = 'https://israeltiburcio-ai.github.io', source: Window | null = f.contentWindow) => window.dispatchEvent(new MessageEvent('message',{data,origin,source}));
    emit(base); // no preceding start
    emit({...base,type:'game:started',result:undefined}, 'https://evil.example');
    emit({...base,type:'game:started',session:crypto.randomUUID()});
    emit({...base,gameId:'ordena-simplex'});
    emit({...base,session:undefined});
    emit(base,'https://israeltiburcio-ai.github.io',window); // same-origin different window
    const sibling = document.createElement('iframe');document.body.appendChild(sibling);
    emit(base,'https://israeltiburcio-ai.github.io',sibling.contentWindow);sibling.remove();
    emit('invalid');emit(null);emit([]);
    const {result: _, ...start} = {...base,type:'game:started'};
    emit(start);
    emit({...base,result:{...base.result,errors:7}});
    emit({...base,result:{...base.result,accuracy:99}});
    emit({...base,result:{...base.result,matchedPairs:7}});
    emit({...base,result:{...base.result,elapsedMs:NaN}});
    emit({...base,extra:'unexpected'});
    emit({...base,runId:crypto.randomUUID()});
    emit({...base,result:{...base.result,attempts:-1}});
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!).gameResults)).toEqual([]);
  await expect(page.getByRole('heading',{name:'Memorama Simplex completado',exact:true})).toHaveCount(0);
});

test('fallo de handshake ofrece alternativa externa, reconecta y no inventa resultados', async ({page,context}) => {
  await localGame(page);
  await page.route('**/optilab-bridge.js',route=>route.fulfill({body:'/* integration unavailable */',contentType:'application/javascript'}));
  await page.clock.install();
  await page.goto('#/jugar/memorama-simplex');
  await page.clock.fastForward(16000);
  await expect(page.getByRole('heading',{name:'El portal necesita otro camino'})).toBeVisible();
  const popup = context.waitForEvent('page');
  await page.getByRole('link',{name:'Jugar en otra pestaña'}).click();
  const external = await popup;
  await expect(external).toHaveURL(remote);
  await external.close();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!).gameResults)).toEqual([]);
  await page.unroute('**/optilab-bridge.js');
  await page.getByRole('button',{name:'Reintentar conexión'}).click();
  await page.clock.resume();
  await expect(page.locator('.player-status')).toContainText('Conectado');
});

test('estado v1 anterior mantiene práctica, apodo, rutas, insignias y diagnóstico',async({page})=>{
  const prior={nickname:'Opti anterior',practiced:{'memorama-simplex':'2026-10-01T12:00:00Z'},visited:[3],badges:[],route:['memorama-simplex'],results:[{date:'2026-10-01T12:00:00Z',answers:[1,0,2,1,0],score:5}]};
  await page.addInitScript(p=>localStorage.setItem('optilab-v1',JSON.stringify(p)),prior);
  await page.goto('#/aventura');
  await expect(page.locator('#nickname')).toHaveValue('Opti anterior');
  await expect(page.locator('.score')).toHaveText('5/5');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!));
  expect(state.practiced).toEqual(prior.practiced);expect(state.route).toEqual(prior.route);expect(state.gameResults).toEqual([]);
});

test('salida anticipada, reinicio, duplicados, handshake del hijo y borrado de resultados',async({page})=>{
  await localGame(page);
  await page.addInitScript(()=>{
    (window as any).gameMessages=[];
    window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-game')(window as any).gameMessages.push(e.data)});
  });
  await page.goto('#/jugar/memorama-simplex');
  await expect(page.locator('.player-status')).toContainText('Conectado');
  let frame=page.frameLocator('.player-frame-shell iframe');
  await frame.locator('#btn-play').click();
  await frame.locator('.card').first().click();
  await expect(page.locator('.player-status')).toContainText('Partida en curso');
  await page.getByRole('link',{name:'Regresar al gimnasio'}).click();
  await expect(page.locator('.gym-banner h1')).toHaveText('Fortaleza Simplex');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!).gameResults)).toEqual([]);
  await page.goto('#/jugar/memorama-simplex');
  await expect(page.locator('.player-status')).toContainText('Conectado');
  frame=page.frameLocator('.player-frame-shell iframe');
  const readyCount=await page.evaluate(()=>(window as any).gameMessages.filter((m:any)=>m.type==='game:ready').length);
  await frame.locator('html').evaluate(()=>{
    document.documentElement.classList.remove('optilab-embedded');
    const params=new URLSearchParams(location.search);
    const init={protocol:'optilab-game',version:1,gameId:'memorama-simplex',session:params.get('optilabSession'),type:'host:init'};
    const origin=params.get('optilabOrigin')!;
    for(const [data,source,eventOrigin] of [[init,window,origin],[init,parent,'https://evil.example'],[{...init,session:crypto.randomUUID()},parent,origin],[{...init,gameId:'other'},parent,origin],[{...init,version:2},parent,origin]]){
      window.dispatchEvent(new MessageEvent('message',{data,source:source as Window,origin:eventOrigin as string}));
    }
  });
  expect(await page.evaluate(()=>(window as any).gameMessages.filter((m:any)=>m.type==='game:ready').length)).toBe(readyCount);
  await expect(frame.locator('html')).not.toHaveClass('optilab-embedded');
  await page.evaluate(()=>{const f=document.querySelector('iframe')!;f.contentWindow!.postMessage({protocol:'optilab-game',version:1,gameId:'memorama-simplex',session:new URL(f.src).searchParams.get('optilabSession'),type:'host:init'},'https://israeltiburcio-ai.github.io')});
  await expect(frame.locator('html')).toHaveClass('optilab-embedded');
  await frame.locator('#btn-play').click();
  await complete(frame,await boardPairs(frame));
  await expect(page.getByRole('heading',{name:'Memorama Simplex completado',exact:true})).toBeVisible();
  const last=await page.evaluate(()=>(window as any).gameMessages.filter((m:any)=>m.type==='game:completed').at(-1));
  await frame.locator('html').evaluate((_,message)=>{parent.postMessage(message,new URLSearchParams(location.search).get('optilabOrigin')!)},last);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!).gameResults)).toHaveLength(1);
  await frame.locator('#btn-again').click();
  await complete(frame,await boardPairs(frame));
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!).gameResults.length)).toBe(2);
  await page.goto('#/aventura');
  await page.getByRole('button',{name:'Reiniciar progreso local'}).click();
  await page.getByRole('button',{name:'Sí, borrar progreso'}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!).gameResults)).toEqual([]);
});
