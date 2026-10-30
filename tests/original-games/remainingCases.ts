import {expect,type FrameLocator,type Page,type Locator} from '@playwright/test';
import catalog from '../../catalogo_optimizacion_gimnasios_1_a_5.json' with {type:'json'};

export const remainingGames=catalog.juegos.filter(g=>g.gimnasio!==3);
export const startSelectors:Record<string,string>={
  OptiQuest1:'#btn-start','system-lab':'#btn-play',SystemScope:'#btn-play','complexity-lab':'#btn-start','or-mission':'#btn-play',
  'model-match':'#btnPlay','lp-factory':'#btnPlay','constraint-dash':'#btn-play','feasible-drop':'#btn-play','solution-detective':'#playBtn',
  'planificador-produccion':'#btn-comenzar','mapa-produccion':'#btn-comenzar','claves-planeacion-produccion':'#btn-start',
  'espejo-dual':'#start','balanza-dual':'#start','domino-holguras':'#start','mercado-recursos-dual':'#start','semaforo-sensibilidad':'#start',
  'desviacion-express':'#start','torre-prioridades':'#start','rompecabezas-metas':'#start','ruta-de-metas':'#start','candado-simplex':'#start',
};
const stateSelectors:Record<string,string[]>={
  OptiQuest1:['#menu-screen','#btn-resume'],
  'system-lab':['#score','#combo-chip'],
  SystemScope:['#hud-score','#hud-dots .ok','#hud-dots .no'],
  'complexity-lab':['#round-num','#score-val'],
  'model-match':['#scoreValue','#dots .ok','#dots .bad'],
  'planificador-produccion':['#reto-ronda','#m-puntos','#feedback-texto'],
  'mapa-produccion':['#stage-kicker','#m-contador','#feedback-text'],
  'claves-planeacion-produccion':['#rail-count','#question'],
  'or-mission':['#hud-score','.option','#pb-text'],
  'lp-factory':['#scoreValue','#pointsValue','#card'],
  'constraint-dash':['#hud-score','#stmt-text'],
  'feasible-drop':['#hud-score','#prompt','.answer-btn'],
  'solution-detective':['#caseTag','#caseCode','#verdictStamp','#verdictText'],
  'espejo-dual':['.slot','#progress','#feedback'],
  'balanza-dual':['#z','#w','#pz','#dw','#round'],
  'domino-holguras':['#score','#round','#feedback'],
  'mercado-recursos-dual':['#round','#profit','#next'],
  'semaforo-sensibilidad':['#round','#math','.correct','.wrong','#next'],
  'desviacion-express':['#progress','#serial','#feedback-text','#next'],
  'torre-prioridades':['.slot','#case-title','#feedback'],
  'rompecabezas-metas':['.slot','#round','#selection'],
  'ruta-de-metas':['#round','#title','.chosen','#next'],
  'candado-simplex':['#feedback','.selected-row','.selected','#next'],
};
/** Actual UI controls only. No game-state mutation, injected results or synthetic events. */
export async function interact(frame:FrameLocator,page:Page,id:string,touch:boolean){
  const activate=async(n:Locator)=>{
    await expect(n).toBeEnabled();
    await n.scrollIntoViewIfNeeded();
    // Keep controls clear of host navigation, then send real pointer/touch input.
    const geometry=async()=>{const inner=await n.evaluate(el=>el.getBoundingClientRect().toJSON()),outer=(await page.locator('.original-player iframe').boundingBox())!;return {x:outer.x+inner.x,y:outer.y+inner.y,width:inner.width,height:inner.height};};
    const box=await geometry(),header=await page.locator('.site-header').boundingBox(),nav=await page.getByRole('navigation',{name:'Navegación principal'}).boundingBox(),height=page.viewportSize()!.height;
    const bottom=nav&&nav.y>height/2?nav.y-8:height-8;
    const top=(header?.y??0)+(header?.height??0)+8;
    const shift=box.y<top?box.y-top:box.y+box.height>bottom?box.y+box.height-bottom:0;
    if(shift)await page.evaluate(y=>window.scrollBy(0,y),shift);
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    const visible=await geometry();if(touch)await page.touchscreen.tap(visible.x+visible.width/2,visible.y+visible.height/2);else await page.mouse.click(visible.x+visible.width/2,visible.y+visible.height/2);
  };
  const press=(selector:string)=>activate(frame.locator(selector).first());
  await press(startSelectors[id]);
  if(id==='OptiQuest1'){
    await expect(frame.locator('#btn-intro-next')).toBeVisible();
    for(let i=0;i<15&&await frame.locator('#btn-intro-next').isVisible();i++)await press('#btn-intro-next');
    await expect(frame.locator('#btn-menu')).toBeVisible();
    // Fixed-position game controls need the host iframe itself in view.
    await page.locator('.original-player iframe').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await press('.dpad-btn.up');await press('#btn-menu');await expect(frame.locator('#btn-resume')).toBeVisible();
  }else if(id==='or-mission'){
    await activate(frame.getByRole('button',{name:'Vagón: PROBLEMA',exact:true}));
    await expect.poll(async()=>Number(await frame.locator('#hud-score').innerText())).toBeGreaterThan(0);
    await page.waitForTimeout(800); // Train coupling animation finishes before snapshot.
  }else if(id==='system-lab'){
    const card=frame.locator('#fall-zone .elem');await card.waitFor();const item=(await card.getAttribute('data-id'))!;
    const category=await frame.locator('body').evaluate((_,id)=>(window as any).SYSTEM_CATCH_DATA.elements.find((e:any)=>e.id===id).category,item);
    await press(`.catcher[data-cat="${category}"]`);await expect.poll(async()=>Number(await frame.locator('#score').innerText())).toBeGreaterThan(0);
  }else if(id==='SystemScope'){
    await press('.door');await expect(frame.locator('#hud-dots .ok,#hud-dots .no')).toHaveCount(1);
  }else if(id==='complexity-lab'){
    await press('.opt');await expect(frame.locator('#round-num')).toContainText('R2/');
  }else if(id==='model-match'){
    await press('.cat-btn');await expect(frame.locator('#dots .dot').nth(1)).toHaveClass(/now/);
  }else if(id==='planificador-produccion'){
    await press('.opcion');await expect(frame.locator('#feedback-texto')).not.toHaveText('');
  }else if(id==='mapa-produccion'){
    const initial=await frame.locator('#feedback-text').innerText();await press('.game-card');await press('.map-slot');await expect(frame.locator('#feedback-text')).not.toHaveText(initial);
  }else if(id==='claves-planeacion-produccion'){
    const initial=await frame.locator('#rail-count').innerText();await press('.option');await expect.poll(()=>frame.locator('#feedback').getAttribute('class')).toMatch(/ok|err/);
    if((await frame.locator('#feedback').getAttribute('class'))?.includes('ok'))await expect(frame.locator('#rail-count')).not.toHaveText(initial);
  }else if(id==='lp-factory'){
    await press('.machine');await expect(frame.locator('body')).toContainText('PREGUNTA 2 / 15');
  }else if(id==='constraint-dash'){
    const initial=await frame.locator('#stmt-text').innerText();await press('.zone');await expect(frame.locator('#stmt-text')).not.toHaveText(initial);
  }else if(id==='feasible-drop'){
    await activate(frame.locator('.answer-btn').nth(1));
    await expect(frame.locator('#feedback')).toBeVisible();await expect(frame.locator('#feedback')).toBeHidden({timeout:8000});
  }else if(id==='solution-detective'){
    await press('.stamp');await expect(frame.locator('#nextBtn')).toBeVisible();
  }else if(id==='espejo-dual'){
    await press('.piece');await press('.slot');await expect(frame.locator('#feedback')).not.toHaveText('');
  }else if(id==='balanza-dual'){
    await frame.locator('#z').fill('5');await frame.locator('#w').fill('18');await press('button[type="submit"]');
    await expect(frame.locator('#pz')).toHaveText('5');await expect(frame.locator('#dw')).toHaveText('18');
  }else if(id==='domino-holguras'){
    await press('.tile');await expect(frame.locator('#feedback')).not.toHaveText('');
  }else if(id==='mercado-recursos-dual'){
    await press('article button');await expect(frame.locator('#next')).toBeVisible();
  }else if(id==='semaforo-sensibilidad'){
    await activate(frame.getByRole('button',{name:/Cambio en b/}));await expect(frame.locator('#next')).toBeVisible();
  }else if(id==='desviacion-express'){
    await press('.bin');await expect(frame.locator('#next')).toBeVisible();
  }else if(id==='torre-prioridades'){
    await press('.block');await press('.slot');await expect(frame.locator('#feedback')).not.toHaveText('');
  }else if(id==='rompecabezas-metas'){
    await press('.piece');await press('.slot');await expect(frame.locator('.slot').first()).not.toContainText('?');
  }else if(id==='ruta-de-metas'){
    await activate(frame.getByRole('button',{name:/^A \(/}));await expect(frame.locator('#next')).toBeVisible();
  }else if(id==='candado-simplex'){
    const initial=await frame.locator('#feedback').innerText();await press('.cell');await expect(frame.locator('#feedback')).not.toHaveText(initial);
  }else throw new Error(`No real interaction defined for ${id}`);
}
export async function snapshot(frame:FrameLocator,id:string){
  return frame.locator('body').evaluate((_,selectors)=>selectors.map(selector=>({selector,values:[...document.querySelectorAll(selector)].map(e=>({text:e.textContent,value:e instanceof HTMLInputElement?e.value:null,disabled:e instanceof HTMLButtonElement?e.disabled:null}))})),stateSelectors[id]);
}
