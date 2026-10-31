import {test,expect,type FrameLocator,type Page} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
import {protectedProgress,observeFirebase} from '../progressAssertions';
const roots:Record<string,string>=JSON.parse(process.env.REMAINING_RESULT_REPOS??'{}');
test.skip(!process.env.REMAINING_RESULT_REPOS,'Candidatos locales: REMAINING_RESULT_REPOS JSON ID → raíz.');
test.describe.configure({mode:'parallel'});
const ids=['OptiQuest1','or-mission','solution-detective','planificador-produccion','mapa-produccion','claves-planeacion-produccion','rompecabezas-simplex','caza-el-pivote'] as const;
type Id=typeof ids[number];type Surface=Page|FrameLocator;
const start:Record<Id,string>={'OptiQuest1':'#btn-start','or-mission':'#btn-play','solution-detective':'#playBtn','planificador-produccion':'#btn-comenzar','mapa-produccion':'#btn-comenzar','claves-planeacion-produccion':'#btn-start','rompecabezas-simplex':'#start-game','caza-el-pivote':'#play-button'};
const replay:Record<Id,string>={...start,'or-mission':'#btn-again','solution-detective':'#againBtn','planificador-produccion':'#btn-repetir','mapa-produccion':'#btn-replay','claves-planeacion-produccion':'#btn-replay','rompecabezas-simplex':'#replay-game','caza-el-pivote':'#replay-button'};
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
const ms=(text:string)=>{const values=text.match(/\d+(?::\d+)?/)![0].split(':').map(Number);return (values.length===2?values[0]*60+values[1]:values[0])*1000;};
async function serveLocal(context:any,id:Id){if(process.env.RESULT_EXPANSION_PUBLIC==='1')return;const base=path.resolve(roots[id]);await context.route(`https://israeltiburcio-ai.github.io/${id}/**`,async(route:any)=>{let rel=decodeURIComponent(new URL(route.request().url()).pathname.slice(`/${id}/`.length));if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve(base,rel);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream',headers:{'access-control-allow-origin':'*'}});});}
async function begin(f:Surface,id:Id,again=false){
  if(again&&id==='OptiQuest1'){await f.locator('#btn-result').click();await f.locator('#btn-menu').click();await f.locator('#btn-menu-title').click();}
  await f.locator(again?replay[id]:start[id]).click();
}
async function complete(f:Surface,id:Id){
  if(id==='OptiQuest1'){
    for(let i=0;i<4;i++)await f.locator('#btn-intro-next').click();
    const bank=JSON.parse(fs.readFileSync(path.join(roots[id],'data/gym1.json'),'utf8')).zones.flatMap((z:any)=>z.questions);
    for(let zone=0;zone<3;zone++){
      if(zone)await f.locator('body').press(zone===1?'ArrowLeft':'ArrowRight',{delay:800});
      for(let step=0;step<40&&!await f.locator('#dialogue').isVisible();step++){await f.locator('body').press('ArrowUp',{delay:200});await f.locator('#btn-a').click();}
      await expect(f.locator('#dialogue')).toBeVisible();
      for(let line=0;line<10&&await f.locator('#dialogue').isVisible();line++)await f.locator('#btn-dialogue-next').click();
      await expect(f.locator('#battle-ui')).toBeVisible();
      for(let turn=0;turn<30&&!await f.locator('#result-screen').isVisible();turn++){
        const text=await f.locator('#battle-question').innerText(),question=bank.find((q:any)=>q.question===text);expect(question).toBeTruthy();await f.locator(`.answer-btn[data-i="${question.answer}"]`).click();await f.locator('#btn-feedback-next').click();
      }
      await expect(f.locator('#result-title')).toHaveText('¡Victoria!');
      if(zone<2)await f.locator('#btn-result').click();
    }
    await expect(f.locator('#result-text')).toContainText('completaste el Gimnasio');return {correct:3,total:3};
  }
  if(id==='or-mission'){
    const names=['PROBLEMA','DEFINICIÓN','CONSTRUCCIÓN','MODELO','VALIDACIÓN','SOLUCIÓN','RESULTADOS','IMPLEMENTACIÓN'];
    for(let i=0;i<names.length;i++){
      const button=f.getByRole('button',{name:`Vagón: ${names[i]}`,exact:true});await expect(button).toBeVisible();
      if(i===0){await f.locator('#options .option').filter({hasNotText:names[i]}).first().click();await expect(f.locator('#options .opt-wrong')).toHaveCount(0);await expect(f.locator('#options .opt-gone')).toHaveCount(0);}
      await button.click();await expect(f.locator('#pb-text')).toHaveText(names[i]);if(i<7)await expect(f.locator('#pb-text')).toHaveText('¿Qué fase sigue?');
    }
    await expect(f.locator('#screen-result')).toBeVisible();await expect(f.locator('#res-correct')).toHaveText('7/8');return {correct:7,total:8,errors:1,durationMs:ms((await f.locator('#res-time').textContent())!),score:Number((await f.locator('#res-score').innerText()).replace(/\D/g,''))};
  }
  if(id==='solution-detective'){
    for(let i=0;i<8;i++){
      await expect(f.locator('#caseTag')).toHaveText(`PREGUNTA ${i+1} DE 8`);const title=(await f.locator('#caseTitle').textContent())!,category=await f.locator('body').evaluate((_,title)=>(window as any).SD_CASES.find((c:any)=>c.title===title).type,title);
      await f.locator(i===0?`.stamp:not([data-type="${category}"])`:`.stamp[data-type="${category}"]`).first().click();await f.locator('#nextBtn').click();
    }
    await expect(f.locator('#screen-report')).toBeVisible();await expect(f.locator('#reportScore')).toContainText('7 / 8');return {correct:7,total:8,durationMs:ms((await f.locator('#reportTime').textContent())!)};
  }
  if(id==='planificador-produccion'){
    for(let i=0;i<5;i++){
      const index=await f.locator('#opciones .opcion').evaluateAll((buttons,i)=>buttons.findIndex(b=>Boolean((b as any)._ok)!==(i===0)),i);await f.locator('#opciones .opcion').nth(index).click();await f.locator('#btn-siguiente').click();
    }
    const indexes=await f.locator('#tarjetas .tarjeta-cara').evaluateAll(buttons=>buttons.flatMap((b,i)=>(b as any)._ok?[i]:[]));for(const index of indexes)await f.locator('#tarjetas .tarjeta-cara').nth(index).click();await f.locator('#btn-confirmar').click();await f.locator('#btn-siguiente').click();
    await expect(f.locator('#pantalla-resultado')).toBeVisible();await expect(f.locator('#r-aciertos')).toHaveText('5/6');return {correct:5,total:6,durationMs:ms((await f.locator('#r-tiempo').textContent())!),score:Number(await f.locator('#r-puntos').innerText())};
  }
  if(id==='mapa-produccion'){
    for(let stage=1;stage<=2;stage++){
      await expect(f.locator('#stage-kicker')).toContainText(`MOMENTO ${stage}`);const cards=await f.locator('#cards .game-card:not(.distractor)').evaluateAll(buttons=>buttons.map(b=>(b as HTMLElement).dataset.id!));expect(cards).toHaveLength(5);
      for(const card of cards){await f.locator(`#cards .game-card[data-id="${card}"]`).click();await f.locator(`#slots .map-slot[data-id="${card}"]`).click();}
    }
    await expect(f.locator('#pantalla-resultado')).toBeVisible();return {correct:5,total:5,durationMs:ms((await f.locator('#m-tiempo').textContent())!)};
  }
  if(id==='claves-planeacion-produccion'){
    for(let i=0;i<5;i++){
      await expect(f.locator('#rail-count')).toHaveText(`${i+1} / 5`);const text=(await f.locator('#question').textContent())!,html=await f.locator('#question').innerHTML(),answer=await f.locator('body').evaluate((_,html)=>{const q=eval('GRUPOS').flatMap((g:any)=>g.preguntas).find((q:any)=>q.q===html);return new DOMParser().parseFromString(q.opciones[q.correcta],'text/html').body.textContent!;},html);
      if(i===0)await f.locator('#options .option').filter({hasNotText:answer}).first().click();await f.locator('#options .option').filter({hasText:answer}).first().click();if(i<4)await expect(f.locator('#question')).not.toHaveText(text);
    }
    await expect(f.locator('#screen-final')).toHaveClass(/active/);for(let i=0;i<5;i++)await f.locator('#cards .card[data-ok="1"]').nth(i).click();await f.locator('#btn-check').click();await expect(f.locator('#screen-result')).toHaveClass(/active/);await expect(f.locator('#stats')).toContainText('4/5');return {correct:4,total:5,durationMs:ms((await f.locator('#stats').textContent())!)};
  }
  if(id==='rompecabezas-simplex'){
    for(let i=0;i<7;i++){
      await expect(f.locator('#round-count')).toHaveText(`${i+1} / 7`);const prompt=await f.locator('#prompt-text').innerText(),challenge=await f.locator('body').evaluate((_,prompt)=>(window as any).SIMPLEX_CHALLENGES.find((c:any)=>c.prompt===prompt),prompt);
      const fill=async(values:string[])=>{for(let slot=0;slot<values.length;slot++){await f.locator('.piece-button:not(.used)').filter({hasText:new RegExp(`^${values[slot].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).first().click();await f.locator(`.equation-slot[data-slot="${slot}"]`).click();}};
      if(i===0){const normalize=(v:string)=>v.normalize('NFKC').replace(/[−–—﹣－]/g,'-').replace(/\s+/g,'').toLowerCase(),accepted=[challenge.answer,...(challenge.alternatives??[])],wrong=challenge.distractors.map((d:string)=>[d,...challenge.answer.slice(1)]).find((candidate:string[])=>accepted.every((answer:string[])=>candidate.some((v,index)=>normalize(v)!==normalize(answer[index]))));expect(wrong).toBeTruthy();await fill(wrong);await f.locator('#check-button').click();await expect(f.locator('#feedback')).toHaveClass(/error/);await f.locator('#clear-button').click();}
      await fill(challenge.answer);await f.locator('#check-button').click();await f.locator('#next-button').click();
    }
    await expect(f.locator('#screen-result')).toBeVisible();const stats=await f.locator('#results-grid strong').allTextContents();expect(stats[2]).toBe('6 / 7');expect(stats[3]).toBe('1');return {correct:6,total:7,attempts:8,errors:1,score:Number(stats[4])};
  }
  for(let i=0;i<5;i++){
    await expect(f.locator('#round-number')).toHaveText(String(i+1));const solution=await f.locator('#simplex-table').evaluate(table=>{
      const number=(e:Element)=>Number(e.textContent!.trim().replace(/−/g,'-'));const z=[...table.querySelectorAll('[data-kind="zvalue"]')].map(number),col=z.indexOf(Math.min(...z));const ratios=[0,1].map(r=>{const a=number(table.querySelector(`[data-kind="cell"][data-r="${r}"][data-c="${col}"]`)!);return a>0?number(table.querySelector(`[data-kind="sol"][data-r="${r}"]`)!)/a:Infinity;});return {col,row:ratios.indexOf(Math.min(...ratios))};
    });
    if(i===0)await f.locator(`[data-kind="column"][data-c="${(solution.col+1)%4}"]`).click();await f.locator(`[data-kind="column"][data-c="${solution.col}"]`).click();await f.locator(`[data-kind="row"][data-r="${solution.row}"]`).click();await f.locator(`[data-kind="cell"][data-r="${solution.row}"][data-c="${solution.col}"]`).click();await f.locator('#next-button').click();
  }
  await expect(f.locator('#screen-results')).toBeVisible();return {correct:14,total:15,attempts:16,errors:1,score:Number(await f.locator('#final-score').innerText())};
}
test.beforeEach(async({context,page})=>{for(const id of ids)await serveLocal(context,id);await page.addInitScript(()=>{if(window!==window.top)return;(window as any).__last8Events=[];window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-original-results')(window as any).__last8Events.push({data:e.data,origin:e.origin,direct:e.source===document.querySelector<HTMLIFrameElement>('.original-player iframe')?.contentWindow});});});});
for(const id of ids)test(`${id}: dos partidas completas, métricas nativas, falsificación y replay`,async({page})=>{
  test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const firebase=observeFirebase(page);await page.setViewportSize({width:1440,height:900});await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe'),panel=page.locator('.original-session-result');await expect(page.locator('.original-player iframe')).toHaveAttribute('sandbox','allow-scripts');
  const session=new URL((await page.locator('.original-player iframe').getAttribute('src'))!).searchParams.get('optilabSession');await page.evaluate(({id,session})=>{const source=document.querySelector<HTMLIFrameElement>('.original-player iframe')!.contentWindow,data={protocol:'optilab-original-results',version:1,gameId:id,session,type:'game:started',runId:crypto.randomUUID()};for(const e of [{origin:'null',source:window},{origin:'https://evil.example',source}])window.dispatchEvent(new MessageEvent('message',{...e,data}));},{id,session});await expect(panel).toHaveCount(0);
  let first:any;for(let run=0;run<2;run++){
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await begin(frame,id,run===1);await expect(panel).toHaveCount(0);const native=await complete(frame,id);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(panel).toBeVisible();const events=await page.evaluate(()=>(window as any).__last8Events),last=events.filter((e:any)=>e.data.type==='game:completed').at(-1);expect(last.origin).toBe('null');expect(last.direct).toBe(true);expect(last.data.result).toMatchObject({reason:'completed',...native});
    if(id==='rompecabezas-simplex'){const time=await frame.locator('#results-grid strong').nth(1).innerText();expect(Math.floor(last.data.result.durationMs/1000)).toBe(ms(time)/1000);}
    if(id==='caza-el-pivote'){const time=await frame.locator('#result-stats div').filter({hasText:'Tiempo'}).locator('dd').innerText();expect(last.data.result.durationMs).toBe(ms(time));}
    if(run===0)first=last.data;else{expect(last.data.runId).not.toBe(first.runId);await frame.locator('body').evaluate((_,data)=>parent.postMessage(data,'*'),first);}
    await frame.locator('body').evaluate((_,data)=>{parent.postMessage(data,'*');parent.postMessage(data,'*');},last.data);await expect(panel).toHaveCount(1);await expect(panel).toHaveAttribute('data-run-id',last.data.runId);
  }
  expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
});
for(const id of ids)test(`${id}: partida independiente completa y abandono sin informe`,async({page})=>{
  test.setTimeout(180000);await page.setViewportSize({width:1440,height:900});await page.goto(`https://israeltiburcio-ai.github.io/${id}/`);await begin(page,id);await complete(page,id);expect(await page.evaluate(()=>(window as any).__last8Events)).toEqual([]);
  await page.goto(`/optilab/#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page),frame=page.frameLocator('.original-player iframe');await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await begin(frame,id);await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toBeVisible();await expect(page.locator('.original-session-result')).toHaveCount(0);expect(await protectedProgress(page)).toEqual(before);
});
test('Caza: expiración real y abandono desde pausa; lo pendiente no se convierte en error',async({page})=>{
  test.setTimeout(170000);const id='caza-el-pivote';await page.goto(`#/jugar-original/${id}`);const f=page.frameLocator('.original-player iframe');await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await begin(f,id);await f.locator('#pause-button').click();await f.locator('#quit-button').click();await expect(page.locator('.original-session-result')).toHaveCount(0);await begin(f,id);await expect(f.locator('#results-title')).toHaveText('¡Se acabó el tiempo!',{timeout:135000});await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.locator('.original-session-result')).toBeVisible();const event=await page.evaluate(()=>(window as any).__last8Events.filter((e:any)=>e.data.type==='game:completed').at(-1));expect(event.data.result).toEqual({reason:'time-limit',correct:0,total:15,attempts:0,errors:0,durationMs:120000,score:0});
});
