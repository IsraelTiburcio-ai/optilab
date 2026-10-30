import {test,expect,type Page,type FrameLocator,type Locator} from '@playwright/test';
// Actual candidate scripts from independently checked-out repositories. Other
// resources remain real; this suite does NOT claim the public fixes are deployed.
const files:Record<string,string>=JSON.parse(process.env.STORAGE_CANDIDATE_SCRIPTS??'{}');
test.skip(!process.env.STORAGE_CANDIDATE_SCRIPTS,'Local candidate paths required: STORAGE_CANDIDATE_SCRIPTS JSON map.');
test.describe.configure({mode:'parallel'});
const cases=[
  {id:'system-lab',script:'js/game.js',start:'#btn-play',mute:'#btn-sound',key:'systemcatch_sound',off:'off',on:'on',best:'systemcatch_best'},
  {id:'SystemScope',script:'js/game.js',start:'#btn-play',mute:'#btn-sound',key:'boundaryrun_sound',off:'0',on:'1',best:'boundaryrun_best'},
  {id:'complexity-lab',script:'js/game.js',start:'#btn-start',mute:'#btn-sound',key:'networkbomb.sound',off:'off',on:'on',best:'networkbomb.best'},
  {id:'model-match',script:'script.js',start:'#btnPlay',mute:'#btnMute',key:'mm_muted',off:'1',on:'0',best:''},
  {id:'planificador-produccion',script:'script.js',start:'#btn-comenzar',mute:'#btn-sonido-inicio',key:'pp_sonido',off:'off',on:'on',best:''},
  {id:'mapa-produccion',script:'script.js',start:'#btn-comenzar',mute:'#btn-sonido-inicio',key:'mapa-produccion-sonido',off:'off',on:'on',best:''},
  {id:'claves-planeacion-produccion',script:'script.js',start:'#btn-start',mute:'#btn-mute',key:'claves-mute',off:'1',on:'0',best:''},
];
type Surface=Page|FrameLocator;
const soundState=(button:Locator)=>button.evaluate(e=>({text:e.textContent?.trim(),label:e.getAttribute('aria-label'),pressed:e.getAttribute('aria-pressed'),icons:[...e.querySelectorAll('path,use')].map(p=>({d:p.getAttribute('d'),href:p.getAttribute('href'),display:getComputedStyle(p).display}))}));
async function interaction(f:Surface,id:string,touch=false){
  const press=async(selector:string)=>{if(touch)await f.locator(selector).first().tap();else await f.locator(selector).first().click();};
  if(id==='system-lab'){
    const card=f.locator('#fall-zone .elem');await card.waitFor();const id=(await card.getAttribute('data-id'))!;
    const category=await f.locator('body').evaluate((_,id)=>(window as any).SYSTEM_CATCH_DATA.elements.find((e:any)=>e.id===id).category,id);
    await press(`.catcher[data-cat="${category}"]`);await expect.poll(async()=>Number(await f.locator('#score').innerText())).toBeGreaterThan(0);
  }else if(id==='SystemScope'){
    await press('.door');await expect(f.locator('#hud-dots .ok,#hud-dots .no')).toHaveCount(1);
  }else if(id==='complexity-lab'){
    await press('.opt');await expect(f.locator('#round-num')).toContainText('R2/');
  }else if(id==='model-match'){
    await press('.cat-btn');await expect(f.locator('#srStatus')).not.toHaveText('Juego iniciado. Clasifica cada modelo.');
  }else if(id==='planificador-produccion'){
    await press('.opcion');await expect(f.locator('#feedback-texto')).not.toHaveText('');
  }else if(id==='mapa-produccion'){
    const before=await f.locator('#feedback-text').innerText();await press('.game-card');await press('.map-slot');await expect(f.locator('#feedback-text')).not.toHaveText(before);
  }else{
    await press('.option');await expect.poll(()=>f.locator('#feedback').getAttribute('class')).toMatch(/ok|err/);
  }
}
async function completeRecordGame(f:Surface,id:string){
  if(id==='system-lab'){
    let previous='';
    for(let i=0;i<8;i++){
      const card=f.locator('#fall-zone .elem');await expect(card).not.toHaveAttribute('data-id',previous);
      const current=(await card.getAttribute('data-id'))!;
      const category=await f.locator('body').evaluate((_,id)=>(window as any).SYSTEM_CATCH_DATA.elements.find((e:any)=>e.id===id).category,current);
      await f.locator(`.catcher[data-cat="${category}"]`).click();previous=current;
    }
    await expect(f.locator('#screen-result')).toBeVisible();await expect(f.locator('#r-correct')).toHaveText('8/8');
    return Number(await f.locator('#r-score').innerText());
  }
  if(id==='SystemScope'){
    for(let i=0;i<6;i++){
      if(i)await expect(f.locator('.door.open,.door.wrong')).toHaveCount(0);
      const text=await f.locator('#situation').innerText();
      const kind=await f.locator('body').evaluate((_,text)=>(window as any).SITUATIONS.find((s:any)=>s.text===text).kind,text);
      await f.locator(`.door[data-kind="${kind}"]`).click();await expect(f.locator('#hud-dots .ok')).toHaveCount(i+1);
    }
    await expect(f.locator('#result')).toBeVisible();await expect(f.locator('#res-correct')).toHaveText('6/6');
    return Number((await f.locator('#res-score').innerText()).replace(/[^0-9]/g,''));
  }
  for(let i=0;i<4;i++){
    await expect(f.locator('#round-num')).toHaveText(`R${i+1}/4`);
    const answer=await f.locator('body').evaluate((_,i)=>(window as any).NB_DATA.rounds[i].answer,i);
    await f.locator('.opt').filter({hasText:new RegExp(`^${answer}$`)}).click();
  }
  await expect(f.locator('#screen-result')).toBeVisible();await expect(f.locator('#r-correct')).toHaveText('4');
  return Number((await f.locator('#r-pts').innerText()).replace(/[^0-9]/g,''));
}
for(const c of cases){
  const base=`https://israeltiburcio-ai.github.io/${c.id}/`;
  for(const [width,height] of [[390,844],[1440,900]])test.describe(`${c.id} opaque ${width}`,()=>{
    test.use({hasTouch:width===390});
    test('LOCAL: arranque, sonido en memoria, interacción y mismo documento',async({page,context})=>{
      test.setTimeout(45000);await page.setViewportSize({width,height});
      await context.route(base+c.script+'*',r=>r.fulfill({path:files[c.id],contentType:'application/javascript'}));
      const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('https://israeltiburcio-ai.github.io/optilab/');
      await page.evaluate(url=>{localStorage.setItem('candidate-canary','host-only');const f=document.createElement('iframe');f.id='candidate';f.src=url;f.sandbox='allow-scripts';f.referrerPolicy='no-referrer';f.allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; autoplay 'none'; fullscreen 'none'";f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:white';document.body.append(f);},base);
      const frame=page.frameLocator('#candidate');await frame.locator(c.start).waitFor();await page.frames().find(f=>f.url()===base)!.waitForLoadState('load');
      const button=frame.locator(c.mute),before=await soundState(button);
      if(width===390)await button.tap();else await button.click();expect(await soundState(button)).not.toEqual(before);
      if(width===390)await button.tap();else await button.click();expect(await soundState(button)).toEqual(before);
      await frame.locator(c.start).click();await interaction(frame,c.id,width===390);
      const marker=await frame.locator('body').evaluate(()=>{(window as any).storageCandidateMarker=crypto.randomUUID();return (window as any).storageCandidateMarker;});const element=await page.locator('#candidate').elementHandle();
      await page.setViewportSize({width:width===390?820:1180,height:height===844?1180:820});
      expect(await element!.evaluate(e=>e.isConnected)).toBe(true);expect(await frame.locator('body').evaluate(()=>(window as any).storageCandidateMarker)).toBe(marker);
      expect(await frame.locator('body').evaluate(()=>{const denied=(fn:()=>unknown)=>{try{fn();return false;}catch(e){return (e as Error).name==='SecurityError';}};return {own:denied(()=>localStorage.getItem('probe')),parent:denied(()=>parent.localStorage.getItem('candidate-canary')),dom:denied(()=>parent.document.body)};})).toEqual({own:true,parent:true,dom:true});
      expect(await page.evaluate(()=>localStorage.getItem('candidate-canary'))).toBe('host-only');expect(errors).toEqual([]);
    });
  });
  for(const mode of ['normal','quota'])test(`${c.id} ${mode}: preferencias restauradas y escrituras opcionales`,async({page,context})=>{
    test.setTimeout(30000);await context.route(base+c.script+'*',r=>r.fulfill({path:files[c.id],contentType:'application/javascript'}));
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://israeltiburcio-ai.github.io/optilab/');await page.evaluate(c=>{localStorage.setItem(c.key,c.off);if(c.best)localStorage.setItem(c.best,'1');},c);
    if(mode==='quota')await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('QA quota exhausted','QuotaExceededError');};});
    await page.goto(base);const button=page.locator(c.mute),before=await soundState(button);await button.click();const after=await soundState(button);expect(after).not.toEqual(before);
    expect(await page.evaluate(key=>localStorage.getItem(key),c.key)).toBe(mode==='normal'?c.on:c.off);
    if(mode==='normal'){await page.reload();expect(await soundState(page.locator(c.mute))).toEqual(after);}
    else{await button.click();expect(await soundState(button)).toEqual(before);}
    await page.locator(c.start).click();await interaction(page,c.id);expect(errors).toEqual([]);
  });
  if(c.best)for(const mode of ['opaque','quota','normal'])test(`${c.id} ${mode}: finalizar y conservar récord sin depender de la escritura`,async({page,context})=>{
    test.setTimeout(45000);await context.route(base+c.script+'*',r=>r.fulfill({path:files[c.id],contentType:'application/javascript'}));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    let f:Surface=page;
    if(mode==='opaque'){
      await page.goto('https://israeltiburcio-ai.github.io/optilab/');await page.evaluate(url=>{const n=document.createElement('iframe');n.id='record';n.src=url;n.sandbox='allow-scripts';n.referrerPolicy='no-referrer';n.allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; autoplay 'none'; fullscreen 'none'";n.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';document.body.append(n);},base);f=page.frameLocator('#record');await f.locator(c.start).waitFor();await page.frames().find(p=>p.url()===base)!.waitForLoadState('load');
    }else{
      if(mode==='quota')await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('QA quota exhausted','QuotaExceededError');};});
      await page.goto(base);
    }
    await f.locator(c.start).click();const score=await completeRecordGame(f,c.id);expect(score).toBeGreaterThan(0);
    if(mode==='normal'){expect(await page.evaluate(key=>Number(localStorage.getItem(key)),c.best)).toBe(score);await page.reload();expect(await page.evaluate(key=>Number(localStorage.getItem(key)),c.best)).toBe(score);}
    if(mode==='quota')expect(await page.evaluate(key=>localStorage.getItem(key),c.best)).toBeNull();
    expect(errors).toEqual([]);
  });
}
