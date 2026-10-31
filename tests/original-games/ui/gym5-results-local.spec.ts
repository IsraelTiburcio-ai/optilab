import {test,expect,type FrameLocator,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {protectedProgress,observeFirebase} from '../progressAssertions';

declare const rounds:any;
declare const round:number;
declare const pieces:any[];

const roots:Record<string,string>=JSON.parse(process.env.GYM5_RESULT_REPOS??'{}');
test.skip(!process.env.GYM5_RESULT_REPOS,'Candidatos locales no publicados: GYM5_RESULT_REPOS JSON ID → raíz.');
const ids=['desviacion-express','torre-prioridades','rompecabezas-metas','ruta-de-metas','candado-simplex'] as const;
type Id=typeof ids[number];
type Surface=Page|FrameLocator;
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const labels:Record<Id,string[]>={
  'desviacion-express':['Aciertos · tarjetas','Total · tarjetas'],
  'torre-prioridades':['Colocaciones correctas','Intentos · colocaciones'],
  'rompecabezas-metas':['Máquinas correctas al primer intento'],
  'ruta-de-metas':['Retos superados'],
  'candado-simplex':['Aciertos al primer intento','Movimientos'],
};
function rootOf(id:Id){const root=roots[id];if(!root)throw new Error(`Falta GYM5_RESULT_REPOS para ${id}`);return path.resolve(root);}
async function serveLocal(context:any,id:Id){
  if(process.env.RESULT_EXPANSION_PUBLIC==='1')return;
  const base=rootOf(id);
  await context.route(`https://israeltiburcio-ai.github.io/${id}/**`,async(route:any)=>{
    const url=new URL(route.request().url());let rel=decodeURIComponent(url.pathname.slice(`/${id}/`.length));
    if(!rel||rel.endsWith('/'))rel+='index.html';
    const file=path.resolve(base,rel);
    if(!(file===base||file.startsWith(base+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();
    await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream'});
  });
}
async function dataFor(id:Id){
  if(id==='torre-prioridades'){const {bank}=await import(pathToFileURL(path.join(rootOf(id),'bank.js')).href);return {bank};}
  if(id==='ruta-de-metas'){const [{scenarios},{evaluate}]=await Promise.all([import(pathToFileURL(path.join(rootOf(id),'scenarios.js')).href),import(pathToFileURL(path.join(rootOf(id),'math.js')).href)]);return {scenarios,evaluate};}
  return {};
}
async function completeDesviacion(surface:Surface){
  for(let i=0;i<8;i++){
    const mode=await surface.locator('#mode').innerText();let choice:string;
    if(/PENALIZAR/.test(mode)){
      const situation=await surface.locator('#situation').innerText();
      choice=/al menos/.test(situation)?'minus':/a lo más/.test(situation)?'plus':'exact';
    }else{
      const numbers=await surface.locator('#numbers > div').evaluateAll(nodes=>nodes.map(n=>Number((n.querySelector('b')?.textContent??'').replace(/[^0-9.-]/g,''))));
      choice=numbers[0]>numbers[1]?'minus':numbers[0]<numbers[1]?'plus':'exact';
    }
    await surface.locator(`.bin[data-choice="${choice}"]`).click();
    await surface.locator('#next').waitFor({state:'visible',timeout:3000});
    await surface.locator('#next').click();
  }
  await expect(surface.locator('#result')).toBeVisible();
  return {correct:8,total:8};
}
async function completeTorre(surface:Surface,bank:any[]){
  let total=0;
  for(let r=0;r<5;r++){
    const title=(await surface.locator('#case-title').innerText()).trim(),scenario=bank.find((c:any)=>c.title===title);
    if(!scenario)throw new Error(`TORRE_SCENARIO_NOT_FOUND: ${title}`);
    const goals=[...scenario.goals].sort((a:any,b:any)=>a.priority-b.priority);
    for(const goal of goals){
      await surface.locator(`.block[data-goal="${goal.id}"]`).click();
      if(await surface.locator('[data-weight]').count())await surface.locator(`[data-weight="${goal.weight}"]`).click();
      await surface.locator(`.slot[data-priority="${goal.priority}"]:not([disabled])`).first().click();
      total++;
    }
    await surface.locator('#next').click();
  }
  await expect(surface.locator('.finish')).toBeVisible();
  return {correct:total,total,attempts:total};
}
async function completeRompecabezas(surface:Surface){
  for(let r=0;r<7;r++){
    const mapping=await surface.locator('body').evaluate(()=>{
      const puzzle=rounds[round],slots=puzzle.lines.flat().filter((t:any)=>typeof t==='object'),used=new Set<number>();
      return slots.map((slot:any)=>{
        const index=pieces.findIndex((piece:any,i:number)=>!used.has(i)&&piece.text===slot.answer);
        if(index<0)throw new Error('PIECE_NOT_FOUND');
        used.add(index);return index;
      });
    });
    for(let n=0;n<mapping.length;n++){
      await surface.locator(`.piece[data-piece="${mapping[n]}"]`).click();
      await surface.locator(`.slot[data-slot="${n}"]`).click();
    }
    await surface.locator('#check').click();
    await surface.locator('#next').waitFor({state:'visible',timeout:5000});
    await surface.locator('#next').click();
  }
  await expect(surface.locator('#result')).toBeVisible();
  return {correct:7,total:7};
}
async function completeRuta(surface:Surface,scenarios:any[],evaluate:any){
  for(let i=0;i<5;i++){
    const title=(await surface.locator('#title').innerText()).trim(),scenario=scenarios.find((s:any)=>s.title===title);
    if(!scenario)throw new Error(`RUTA_SCENARIO_NOT_FOUND: ${title}`);
    const ev=evaluate(scenario),target=ev.solutions[0];
    await surface.locator(`#candidates button[data-point="${target}"]`).click();
    await surface.locator('#next').click();
  }
  await expect(surface.locator('#result')).toBeVisible();
  return {correct:5,total:5};
}
async function completeCandado(surface:Surface){
  for(let r=0;r<5;r++){
    const next=surface.locator('#next'),choices=surface.locator('[data-choice]'),count=await choices.count();
    let solved=false;
    for(let i=0;i<count;i++){
      if(await next.isVisible()){solved=true;break;}
      await choices.nth(i).click();
      if(await next.isVisible()){solved=true;break;}
    }
    if(!solved)throw new Error('CANDADO_NOT_SOLVED');
    await next.click();
  }
  await expect(surface.locator('.welcome.final')).toBeVisible();
  const micro=await surface.locator('.welcome.final .micro').innerText();
  const match=micro.match(/(\d+)\s+movimientos\s+·\s+(\d+)\s+aciertos/);
  if(!match)throw new Error('CANDADO_METRICS_NOT_FOUND');
  return {correct:Number(match[2]),total:5,attempts:Number(match[1])};
}
async function completeGame(surface:Surface,id:Id,data:any){
  if(id==='desviacion-express')return completeDesviacion(surface);
  if(id==='torre-prioridades')return completeTorre(surface,data.bank);
  if(id==='rompecabezas-metas')return completeRompecabezas(surface);
  if(id==='ruta-de-metas')return completeRuta(surface,data.scenarios,data.evaluate);
  return completeCandado(surface);
}
function expectedKeys(result:any){return ['reason','correct','total','durationMs',...(result.attempts!==undefined?['attempts']:[])].sort();}

test.beforeEach(async({context})=>{for(const id of ids)await serveLocal(context,id);});
for(const id of ids)test(`${id}: partida completa, repetición, duplicados y aislamiento`,async({page})=>{
  test.setTimeout(150000);
  const firebase=observeFirebase(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(window!==window.top)return;(window as any).__gym5Events=[];window.addEventListener('message',e=>{if(e.data?.protocol!=='optilab-original-results')return;const frame=document.querySelector<HTMLIFrameElement>('.original-player iframe');(window as any).__gym5Events.push({data:e.data,origin:e.origin,direct:e.source===frame?.contentWindow});});});
  await page.setViewportSize({width:1440,height:900});
  const data=await dataFor(id);
  await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();
  const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator('#start').click();
  const firstExpected=await completeGame(frame,id,data);
  await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
  const panel=page.locator('.original-session-result');await expect(panel).toBeVisible();
  const firstRun=await panel.getAttribute('data-run-id');
  const first=await page.evaluate(()=>(window as any).__gym5Events.filter((event:any)=>event.data.type==='game:completed').at(-1));
  expect(first.origin).toBe('null');expect(first.direct).toBe(true);
  expect(first.data.result.reason).toBe('completed');expect(first.data.result.correct).toBe(firstExpected.correct);expect(first.data.result.total).toBe(firstExpected.total);
  if(firstExpected.attempts!==undefined)expect(first.data.result.attempts).toBe(firstExpected.attempts);
  expect(Object.keys(first.data.result).sort()).toEqual(expectedKeys(firstExpected));
  expect(first.data.result.durationMs).toBeGreaterThanOrEqual(0);
  for(const label of labels[id])await expect(panel.getByText(label,{exact:true})).toBeVisible();
  await frame.locator('body').evaluate((_,message)=>parent.postMessage(message,'*'),first.data);
  await frame.locator('body').evaluate((_,message)=>parent.postMessage(message,'*'),first.data);
  await expect(panel).toHaveCount(1);await expect(panel).toHaveAttribute('data-run-id',firstRun!);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator('#replay').click();
  await expect(panel).toHaveCount(0);
  const secondExpected=await completeGame(frame,id,data);
  await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
  await expect(panel).toBeVisible();
  const secondRun=await panel.getAttribute('data-run-id');expect(secondRun).not.toBe(firstRun);
  const second=await page.evaluate(()=>(window as any).__gym5Events.filter((event:any)=>event.data.type==='game:completed').at(-1));
  expect(second.data.runId).not.toBe(first.data.runId);expect(second.data.result.correct).toBe(secondExpected.correct);expect(second.data.result.total).toBe(secondExpected.total);
  if(secondExpected.attempts!==undefined)expect(second.data.result.attempts).toBe(secondExpected.attempts);
  await frame.locator('body').evaluate((_,message)=>parent.postMessage(message,'*'),first.data);
  await expect(panel).toHaveAttribute('data-run-id',secondRun!);
  expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
});
for(const id of ids)test(`${id}: modo independiente y abandono no producen resultados`,async({page})=>{
  test.setTimeout(60000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(window!==window.top)return;(window as any).__gym5Events=[];window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-original-results')(window as any).__gym5Events.push(e.data);});});
  const data=await dataFor(id);
  await page.goto(`https://israeltiburcio-ai.github.io/${id}/`);await page.locator('#start').click();
  await completeGame(page,id,data);
  expect(await page.evaluate(()=>(window as any).__gym5Events)).toEqual([]);expect(errors).toEqual([]);
  await page.goto(`/optilab/#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();
  const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator('#start').click();
  await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();
  await expect(page.locator('.gym-banner h1')).toBeVisible();await expect(page.locator('.original-session-result')).toHaveCount(0);expect(await protectedProgress(page)).toEqual(before);
});
