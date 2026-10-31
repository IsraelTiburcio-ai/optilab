import {test,expect,type FrameLocator,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {protectedProgress,observeFirebase} from '../progressAssertions';
const roots:Record<string,string>=JSON.parse(process.env.GYM4_RESULT_REPOS??'{}');
test.skip(!process.env.GYM4_RESULT_REPOS,'Candidatos locales no publicados: GYM4_RESULT_REPOS JSON ID → raíz.');
const ids=['espejo-dual','balanza-dual','domino-holguras','mercado-recursos-dual','semaforo-sensibilidad'] as const;
type Id=typeof ids[number];type Surface=Page|FrameLocator;
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
async function serveLocal(context:any,id:Id){if(process.env.RESULT_EXPANSION_PUBLIC==='1')return;const base=path.resolve(roots[id]);await context.route(`https://israeltiburcio-ai.github.io/${id}/**`,async(route:any)=>{let rel=decodeURIComponent(new URL(route.request().url()).pathname.slice(`/${id}/`.length));if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve(base,rel);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream'});});}
async function complete(f:Surface,id:Id){
  if(id==='espejo-dual'){
    for(let round=0;round<5;round++){
      const slots=f.locator('.slot'),n=await slots.count();
      for(let i=0;i<n;i++){
        const slot=slots.nth(i);for(let j=0;j<await f.locator('.piece').count();j++){if((await slot.getAttribute('class'))!.includes('done'))break;const piece=f.locator('.piece').nth(j);if(await piece.isDisabled())continue;await piece.click();await slot.click();}
        await expect(slot).toHaveClass(/done/);
      }
      await f.locator('#next').click();
    }
    await expect(f.locator('#result')).toBeVisible();const text=await f.locator('#stats').innerText(),match=text.match(/(\d+) s · (\d+) ajustes?/);if(!match)throw new Error('ESPEJO_METRICS_NOT_FOUND');return {correct:5,total:5,errors:Number(match[2]),durationMs:Number(match[1])*1000};
  }
  if(id==='balanza-dual'){
    const [{bank},{selectGame,inspect,evaluate}]=await Promise.all([import(pathToFileURL(path.join(roots[id],'bank.js')).href),import(pathToFileURL(path.join(roots[id],'math.js')).href)]);
    for(const scenario of selectGame(bank,()=>0.25)){
      const {p,d}=inspect(scenario);
      if(scenario.type==='values'){await f.locator('#z').fill(String(p.value));await f.locator('#w').fill(String(d.value));}
      if(scenario.type==='feasible'){await f.locator(`[data-seal="p"][data-value="${p.feasible}"]`).click();await f.locator(`[data-seal="d"][data-value="${d.feasible}"]`).click();}
      if(scenario.type==='bound'){const i=scenario.candidates.findIndex((y:number[])=>evaluate(scenario.dual,y).feasible);await f.locator('#candidate').fill(String(i));await f.locator('#w').fill(String(evaluate(scenario.dual,scenario.candidates[i]).value));}
      if(scenario.type==='optimal')await f.locator('#adjust').fill(String(scenario.target));
      if(scenario.type==='error'){const side=!p.feasible?'primal':'dual',v=side==='primal'?scenario.x:scenario.y,idx=evaluate(scenario[side],v).rows.findIndex((r:any)=>!r.ok);await f.locator(`[data-error="${side}:${idx}"]`).click();}
      await f.locator('button[type="submit"]').click();await expect(f.locator('#next')).toBeVisible();await f.locator('#next').click();
    }
    await expect(f.locator('#results')).toBeVisible();const seconds=Number((await f.locator('#summary').innerText()).match(/en (\d+) s/)![1]);await expect(f.locator('#score')).toHaveText('5 / 5');return {correct:5,total:5,durationMs:seconds*1000};
  }
  if(id==='domino-holguras'){
    for(let i=0;i<6;i++){
      const prompt=await f.locator('#prompt').innerText(),answer=await f.locator('body').evaluate((_,prompt)=>(window as any).DOMINO_BANK.find((v:any)=>v.prompt===prompt).answer,prompt);
      if(i===0){const wrong=f.locator('.tile').filter({hasNot:f.locator('.answer').filter({hasText:answer})}).first();await wrong.click();await expect(wrong).toBeDisabled();}
      await f.locator('.tile').filter({has:f.locator('.answer').getByText(answer,{exact:true})}).click();await f.locator('#next').click();
    }
    await expect(f.locator('#results')).toBeVisible();const text=await f.locator('#summary').innerText(),m=text.match(/(\d+) error(?:es)? · (\d+):(\d+)/);if(!m)throw new Error('DOMINO_METRICS_NOT_FOUND');return {correct:6,total:6,errors:Number(m[1]),durationMs:(Number(m[2])*60+Number(m[3]))*1000};
  }
  if(id==='mercado-recursos-dual'){
    let correct=0;for(let i=0;i<6;i++){await f.locator('#actions button').first().click();const text=await f.locator('#feedback').innerText();if(text.startsWith('✓'))correct++;await f.locator('#next').click();}
    await expect(f.locator('#results')).toBeVisible();const stats=await f.locator('#stats').innerText();expect(stats).toContain(`${correct} / 6`);const s=Number(stats.match(/(\d+) s/)![1]);return {correct,total:6,durationMs:s*1000};
  }
  let correct=0;for(let i=0;i<6;i++){await f.locator('#options button').first().click();const result=await f.locator('#feedback').innerText();if(result.startsWith('✓'))correct++;await f.locator('#next').click();}
  await expect(f.locator('#end')).toBeVisible();const text=await f.locator('#score').innerText(),match=text.match(/(\d+) \/ 6 retos correctos · (\d+) s/);if(!match)throw new Error('SEMAFORO_METRICS_NOT_FOUND');expect(Number(match[1])).toBe(correct);return {correct,total:6,durationMs:Number(match[2])*1000};
}
test.beforeEach(async({context,page})=>{for(const id of ids)await serveLocal(context,id);await page.addInitScript(()=>{Math.random=()=>0.25;if(window!==window.top)return;(window as any).__gym4Events=[];window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-original-results')(window as any).__gym4Events.push({data:e.data,origin:e.origin,direct:e.source===document.querySelector<HTMLIFrameElement>('.original-player iframe')?.contentWindow});});});});
for(const id of ids)test(`${id}: partidas reales, errores nativos, duplicados y replay`,async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const firebase=observeFirebase(page);await page.setViewportSize({width:1440,height:900});
  await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await expect(page.locator('.original-player iframe')).toHaveAttribute('sandbox','allow-scripts');
  const session=new URL((await page.locator('.original-player iframe').getAttribute('src'))!).searchParams.get('optilabSession');
  await page.evaluate(({id,session})=>{const source=document.querySelector<HTMLIFrameElement>('.original-player iframe')!.contentWindow,runId=crypto.randomUUID(),data={protocol:'optilab-original-results',version:1,gameId:id,session,type:'game:started',runId};for(const e of [{origin:'null',source:window},{origin:'https://evil.example',source}])window.dispatchEvent(new MessageEvent('message',{...e,data}));}, {id,session});
  await expect(page.locator('.original-session-result')).toHaveCount(0);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator('#start').click();const first=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
  const panel=page.locator('.original-session-result');await expect(panel).toBeVisible();const messages=await page.evaluate(()=>(window as any).__gym4Events),end=messages.find((m:any)=>m.data.type==='game:completed');expect(end.origin).toBe('null');expect(end.direct).toBe(true);expect(end.data.result).toEqual({reason:'completed',...first});const run=end.data.runId;
  await frame.locator('body').evaluate((_,data)=>{parent.postMessage(data,'*');parent.postMessage(data,'*');},end.data);await expect(panel).toHaveCount(1);await expect(panel).toHaveAttribute('data-run-id',run);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator(id==='mercado-recursos-dual'?'#restart':'#replay').click();await expect(panel).toHaveCount(0);const second=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(panel).toBeVisible();const all=await page.evaluate(()=>(window as any).__gym4Events),last=all.filter((m:any)=>m.data.type==='game:completed').at(-1).data;expect(last.runId).not.toBe(run);expect(last.result).toEqual({reason:'completed',...second});
  await frame.locator('body').evaluate((_,data)=>parent.postMessage(data,'*'),end.data);await expect(panel).toHaveAttribute('data-run-id',last.runId);expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
});
test('Balanza: validación nativa y Enter funcionan sin allow-forms',async({page})=>{
  await page.goto('#/jugar-original/balanza-dual');await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const f=page.frameLocator('.original-player iframe');await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await f.locator('#start').click();
  await f.locator('#z').fill('-1');await f.locator('#w').fill('9');await f.locator('button[type="submit"]').click();await expect(f.locator('#next')).toBeHidden();
  await f.locator('#z').fill('7');await f.locator('#w').fill('9');await f.locator('#w').press('Enter');await expect(f.locator('#next')).toBeVisible();
});
for(const id of ids)test(`${id}: modo independiente y abandono no producen resultados`,async({page})=>{
  test.setTimeout(90000);await page.goto(`https://israeltiburcio-ai.github.io/${id}/`);await page.locator('#start').click();await complete(page,id);expect(await page.evaluate(()=>(window as any).__gym4Events)).toEqual([]);
  await page.goto(`/optilab/#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator('#start').click();await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toHaveText('Santuario Dual');await expect(page.locator('.original-session-result')).toHaveCount(0);expect(await protectedProgress(page)).toEqual(before);
});
