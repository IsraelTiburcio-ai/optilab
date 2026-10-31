import {test,expect,type FrameLocator,type Page} from '@playwright/test';
import {protectedProgress,observeFirebase} from '../progressAssertions';
const roots:Record<string,string>=JSON.parse(process.env.RESULT_EXPANSION_REPOS??'{}');
test.skip(!process.env.RESULT_EXPANSION_REPOS,'Candidatos locales no publicados: RESULT_EXPANSION_REPOS JSON ID → raíz.');
const ids=['system-lab','SystemScope','complexity-lab'];
type Surface=Page|FrameLocator;
async function complete(f:Surface,id:string){
  if(id==='system-lab'){
    let previous='';for(let i=0;i<8;i++){
      const card=f.locator('#fall-zone .elem');await expect(card).not.toHaveAttribute('data-id',previous);const current=(await card.getAttribute('data-id'))!;
      const category=await f.locator('body').evaluate((_,id)=>(window as any).SYSTEM_CATCH_DATA.elements.find((e:any)=>e.id===id).category,current);
      await f.locator(`.catcher[data-cat="${category}"]`).click();previous=current;
    }
    await expect(f.locator('#screen-result')).toBeVisible();await expect(f.locator('#r-correct')).toHaveText('8/8');return {correct:8,total:8,score:Number(await f.locator('#r-score').innerText())};
  }
  if(id==='SystemScope'){
    for(let i=0;i<6;i++){
      if(i)await expect(f.locator('.door.open,.door.wrong')).toHaveCount(0);
      const text=await f.locator('#situation').innerText(),kind=await f.locator('body').evaluate((_,text)=>(window as any).SITUATIONS.find((s:any)=>s.text===text).kind,text);
      await f.locator(`.door[data-kind="${kind}"]`).click();await expect(f.locator('#hud-dots .ok')).toHaveCount(i+1);
    }
    await expect(f.locator('#result')).toBeVisible();await expect(f.locator('#res-correct')).toHaveText('6/6');return {correct:6,total:6,score:Number((await f.locator('#res-score').innerText()).replace(/[^0-9]/g,'')),durationMs:Number((await f.locator('#res-time').innerText()).replace(/[^0-9]/g,''))*1000};
  }
  for(let i=0;i<4;i++){
    await expect(f.locator('#round-num')).toHaveText(`R${i+1}/4`);
    const answer=await f.locator('body').evaluate((_,i)=>(window as any).NB_DATA.rounds[i].answer,i);
    await f.locator('.opt').filter({hasText:new RegExp(`^${answer}$`)}).click();
  }
  await expect(f.locator('#screen-result')).toBeVisible();await expect(f.locator('#r-correct')).toHaveText('4');return {correct:4,total:4,score:Number((await f.locator('#r-pts').innerText()).replace(/[^0-9]/g,''))};
}
test.beforeEach(async({context,page})=>{
  if(process.env.RESULT_EXPANSION_PUBLIC!=='1')for(const id of ids)await context.route(`https://israeltiburcio-ai.github.io/${id}/**`,async r=>{
    const name=new URL(r.request().url()).pathname.slice(id.length+2);
    if(['','index.html','js/game.js','optilab-results.js'].includes(name))await r.fulfill({path:`${roots[id]}/${name||'index.html'}`,contentType:name.endsWith('.js')?'application/javascript':'text/html'});else await r.continue();
  });
  await page.addInitScript(()=>{if(window!==window.top)return;(window as any).expansionEvents=[];window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-original-results')(window as any).expansionEvents.push({data:e.data,origin:e.origin,direct:e.source===document.querySelector<HTMLIFrameElement>('.original-player iframe')?.contentWindow});});});
});
for(const id of ids)test(`${id}: partidas reales, unidades nativas, sandbox y replay`,async({page})=>{
  test.setTimeout(120000);const firebase=observeFirebase(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:900});
  await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await expect(page.locator('.original-player iframe')).toHaveAttribute('sandbox','allow-scripts');
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();const start=id==='complexity-lab'?'#btn-start':'#btn-play';await frame.locator(start).click();const first=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
  await expect(page.locator('.original-session-result')).toBeVisible();const messages=await page.evaluate(()=>(window as any).expansionEvents),end=messages.find((m:any)=>m.data.type==='game:completed');expect(end.origin).toBe('null');expect(end.direct).toBe(true);expect(end.data.result).toEqual({reason:'completed',...first});const run=end.data.runId;
  await frame.locator('body').evaluate((_,data)=>{parent.postMessage(data,'*');parent.postMessage(data,'*');},end.data);await expect(page.locator('.original-session-result')).toHaveCount(1);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator(id==='system-lab'?'#btn-again':'#btn-again').click();await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.locator('.original-session-result')).toHaveCount(0);
  await frame.locator('body').evaluate((_,data)=>parent.postMessage(data,'*'),end.data);await expect(page.locator('.original-session-result')).toHaveCount(0);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();const second=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.locator('.original-session-result')).toBeVisible();const all=await page.evaluate(()=>(window as any).expansionEvents);const completed=all.filter((m:any)=>m.data.type==='game:completed');const last=completed.at(-1).data;expect(last.runId).not.toBe(run);expect(last.result).toEqual({reason:'completed',...second});expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
});
for(const id of ids)test(`${id}: modo independiente e interrupción no producen resultados`,async({page})=>{
  test.setTimeout(45000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`https://israeltiburcio-ai.github.io/${id}/`);const start=id==='complexity-lab'?'#btn-start':'#btn-play';await page.locator(start).click();
  await complete(page,id);
  expect(await page.evaluate(()=>(window as any).expansionEvents)).toEqual([]);expect(errors).toEqual([]);
  await page.goto(`/optilab/#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();
  const progress=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator(start).click();
  await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toHaveText('Bosque de Sistemas');await expect(page.locator('.original-session-result')).toHaveCount(0);expect(await protectedProgress(page)).toEqual(progress);
});
