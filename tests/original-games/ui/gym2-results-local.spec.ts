import {test,expect,type FrameLocator,type Page} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
import {protectedProgress,observeFirebase} from '../progressAssertions';
const roots:Record<string,string>=JSON.parse(process.env.GYM2_RESULT_REPOS??'{}');
test.skip(!process.env.GYM2_RESULT_REPOS,'Candidatos locales no publicados: GYM2_RESULT_REPOS JSON ID → raíz.');
test.describe.configure({mode:'parallel'});
const ids=['model-match','lp-factory','constraint-dash','feasible-drop'] as const;
type Id=typeof ids[number];type Surface=Page|FrameLocator;
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
const start:Record<Id,string>={'model-match':'#btnPlay','lp-factory':'#btnPlay','constraint-dash':'#btn-play','feasible-drop':'#btn-play'};
const replay:Record<Id,string>={'model-match':'#btnAgain','lp-factory':'#btnAgain','constraint-dash':'#btn-again','feasible-drop':'#btn-again'};
async function serveLocal(context:any,id:Id){if(process.env.RESULT_EXPANSION_PUBLIC==='1')return;const base=path.resolve(roots[id]);await context.route(`https://israeltiburcio-ai.github.io/${id}/**`,async(route:any)=>{let rel=decodeURIComponent(new URL(route.request().url()).pathname.slice(`/${id}/`.length));if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve(base,rel);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream'});});}
async function complete(f:Surface,id:Id){
  if(id==='model-match'){
    for(let i=0;i<10;i++){
      await expect(f.locator('#dots .dot').nth(i)).toHaveClass(/now/);
      if(i===0){await expect(f.locator('#dots .dot').nth(0)).toHaveClass(/bad/,{timeout:9000});continue;}
      const label=await f.locator('#cardLabel').innerText(),category=await f.locator('body').evaluate((_,label)=>(window as any).MODEL_MATCH.items.find((item:any)=>item.label===label).cat,label);
      const button=i===1?f.locator(`.cat-btn:not([data-cat="${category}"])`).first():f.locator(`.cat-btn[data-cat="${category}"]`);await button.click();
    }
    await expect(f.locator('#screen-result')).toBeVisible();await expect(f.locator('#resultScore')).toHaveText('8/10');const seconds=Number((await f.locator('#resultTime').innerText()).match(/\d+/)![0]);return {correct:8,total:10,attempts:9,errors:1,timeouts:1,durationMs:seconds*1000};
  }
  if(id==='lp-factory'){
    for(let i=0;i<15;i++){
      await expect(f.locator('#pieceCounter')).toHaveText(`PREGUNTA ${i+1} / 15`);const text=await f.locator('#card').innerText();
      const cat=await f.locator('body').evaluate((_,text)=>(window as any).LP_FACTORY.items.find((v:any)=>text.includes(v.display.value)).cat,text);
      await f.locator(i===0?`.machine:not([data-cat="${cat}"])`:`.machine[data-cat="${cat}"]`).first().click();
    }
    await expect(f.locator('#screen-result')).toHaveClass(/active/);await expect(f.locator('#resultScore')).toContainText('14/15');return {correct:14,total:15,attempts:15,errors:1,score:Number((await f.locator('#resultPoints').innerText()).replace(/[^0-9]/g,''))};
  }
  if(id==='constraint-dash'){
    for(let i=0;i<10;i++){
      await expect(f.locator('#hud-dots i').nth(i)).toHaveClass(/cur/);
      if(i===0){await expect(f.locator('#hud-dots i').nth(i)).toHaveClass(/bad/,{timeout:10000});continue;}
      const statement=await f.locator('#stmt-text').innerText(),answer=await f.locator('body').evaluate((_,text)=>(window as any).ConstraintQuestions.all.find((q:any)=>q.text===text).answer,statement),idx=['lte','gte','eq'].indexOf(answer);
      await f.locator('.zone').nth(i===1?(idx+1)%3:idx).click();
    }
    await expect(f.locator('#screen-result')).toHaveClass(/active/);await expect(f.locator('#stat-hits')).toHaveText('8/10');const seconds=Number((await f.locator('#stat-time').innerText()).replace(/\D/g,''));return {correct:8,total:10,attempts:9,errors:1,timeouts:1,durationMs:seconds*1000,score:Number(await f.locator('#result-score').innerText())};
  }
  for(let i=0;i<6;i++){
    const choice=f.locator('.answer-btn:visible, .point-hit[role="button"]');await choice.first().click();await expect(f.locator('#feedback')).toBeVisible();if(i<5)await expect(f.locator('#feedback')).toBeHidden({timeout:6000});
  }
  await expect(f.locator('#screen-results')).toHaveClass(/active/);return {total:6,score:Number(await f.locator('#res-score').innerText())};
}
test.beforeEach(async({context,page})=>{for(const id of ids)await serveLocal(context,id);await page.addInitScript(()=>{if(window!==window.top)return;(window as any).__gym2Events=[];window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-original-results')(window as any).__gym2Events.push({data:e.data,origin:e.origin,direct:e.source===document.querySelector<HTMLIFrameElement>('.original-player iframe')?.contentWindow});});});});
for(const id of ids)test(`${id}: dos partidas reales, expiración/errores y rechazo de duplicados`,async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const firebase=observeFirebase(page);await page.setViewportSize({width:1440,height:900});await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await expect(page.locator('.original-player iframe')).toHaveAttribute('sandbox','allow-scripts');
  const session=new URL((await page.locator('.original-player iframe').getAttribute('src'))!).searchParams.get('optilabSession');await page.evaluate(({id,session})=>{const source=document.querySelector<HTMLIFrameElement>('.original-player iframe')!.contentWindow,data={protocol:'optilab-original-results',version:1,gameId:id,session,type:'game:started',runId:crypto.randomUUID()};for(const e of [{origin:'null',source:window},{origin:'https://evil.example',source}])window.dispatchEvent(new MessageEvent('message',{...e,data}));},{id,session});await expect(page.locator('.original-session-result')).toHaveCount(0);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator(start[id]).click();const first=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();const panel=page.locator('.original-session-result');await expect(panel).toBeVisible();const events=await page.evaluate(()=>(window as any).__gym2Events),message=events.find((e:any)=>e.data.type==='game:completed');expect(message.origin).toBe('null');expect(message.direct).toBe(true);expect(message.data.result).toMatchObject({reason:'completed',...first});
  if(id==='model-match'||id==='constraint-dash'){await expect(panel.getByText('Respuestas incorrectas',{exact:true})).toBeVisible();await expect(panel.getByText('Rondas sin respuesta',{exact:true})).toBeVisible();}
  if(id==='feasible-drop'){const accuracy=Number((await frame.locator('#res-acc').innerText()).replace(/\D/g,''));expect(message.data.result.correct).toBe(Math.round(accuracy*6/100));expect(message.data.result).not.toHaveProperty('errors');expect(message.data.result).not.toHaveProperty('attempts');}
  if(id==='lp-factory'){const seconds=Number((await frame.locator('#resultTime').innerText()).replace(/\D/g,''));expect(Math.floor(message.data.result.durationMs/1000)).toBe(seconds);}
  const run=message.data.runId;await frame.locator('body').evaluate((_,data)=>{parent.postMessage(data,'*');parent.postMessage(data,'*');},message.data);await expect(panel).toHaveCount(1);await expect(panel).toHaveAttribute('data-run-id',run);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator(replay[id]).click();await expect(panel).toHaveCount(0);const second=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(panel).toBeVisible();const all=await page.evaluate(()=>(window as any).__gym2Events),last=all.filter((e:any)=>e.data.type==='game:completed').at(-1).data;expect(last.runId).not.toBe(run);expect(last.result).toMatchObject({reason:'completed',...second});await frame.locator('body').evaluate((_,data)=>parent.postMessage(data,'*'),message.data);await expect(panel).toHaveAttribute('data-run-id',last.runId);expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
});
for(const id of ids)test(`${id}: independiente y abandono no envían resultados`,async({page})=>{
  test.setTimeout(100000);await page.goto(`https://israeltiburcio-ai.github.io/${id}/`);await page.locator(start[id]).click();await complete(page,id);expect(await page.evaluate(()=>(window as any).__gym2Events)).toEqual([]);await page.goto(`/optilab/#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator(start[id]).click();await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toHaveText('Valle Lineal');await expect(page.locator('.original-session-result')).toHaveCount(0);expect(await protectedProgress(page)).toEqual(before);
});
