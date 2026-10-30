import {test,expect,type Page,type FrameLocator} from '@playwright/test';
import {protectedProgress,observeFirebase} from '../progressAssertions';
const roots:Record<string,string>=JSON.parse(process.env.RESULT_PILOT_REPOS??'{}');
test.skip(!process.env.RESULT_PILOT_REPOS&&process.env.RESULT_PILOT_PUBLIC!=='1','Configura candidatos locales o RESULT_PILOT_PUBLIC=1 para URLs publicadas sin mocks.');
test.describe.configure({mode:'parallel'});
const ids=['ahorcado-simplex','ordena-simplex'];
type Surface=Page|FrameLocator;
async function complete(f:Surface,id:string,alreadyStarted=false){
  if(id==='ahorcado-simplex'){
    if(!alreadyStarted){await f.locator('[data-rondas="3"]').click();await f.locator('#btn-empezar').click();}let attempts=0;
    for(let round=0;round<3;round++){
      const clue=await f.locator('#pista-texto').innerText();
      const letters=await f.locator('body').evaluate((_,clue)=>{
        const word=(window as any).AHORCADO_BANCO.find((p:any)=>p.pista===clue).palabra as string;
        return [...new Set([...word].filter(c=>c!==' ').map(c=>c==='Ñ'?'Ñ':c.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))];
      },clue);
      if(!round){const wrong=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(c=>!letters.includes(c))!;await f.locator(`[data-letra="${wrong}"]`).click();await f.locator('#pantalla-juego').press(wrong.toLowerCase());attempts++;await expect(f.locator('#chip-fallos')).toHaveText('1');}
      for(const letter of letters){await f.locator(`[data-letra="${letter}"]`).click();attempts++;}
      await expect(f.locator('#panel-titulo')).toHaveText('Palabra completada');await f.locator('#btn-siguiente').click();
    }
    await expect(f.locator('#pantalla-resultados')).toBeVisible();await expect(f.locator('#st-aciertos')).toHaveText('3 de 3');await expect(f.locator('#st-letras')).toHaveText('1');
    return {correct:3,total:3,attempts,errors:1,time:await f.locator('#st-tiempo').innerText()};
  }
  if(!alreadyStarted)await f.locator('#btn-start').click();await f.locator('#btn-check').click();await expect(f.locator('#feedback')).toContainText('Faltan');let evaluated=0;
  for(let round=0;round<6;round++){
    const count=await f.locator('#slots button').count();
    const fill=async(order:number[])=>{for(let slot=0;slot<order.length;slot++){await f.locator(`#tray [data-card="${order[slot]}"]`).click();await f.locator(`#slots [data-slot="${slot}"]`).click();}};
    if(!round){const wrong=Array.from({length:count},(_,i)=>i);[wrong[0],wrong[1]]=[wrong[1],wrong[0]];await fill(wrong);await f.locator('#btn-check').click();evaluated+=count;await expect(f.locator('#feedback')).toContainText('2 tarjetas');await f.locator('#btn-clear').click();}
    await fill(Array.from({length:count},(_,i)=>i));await f.locator('#btn-check').click();evaluated+=count;await expect(f.locator('#overlay')).toBeVisible();await f.locator('#btn-next').click();
  }
  await expect(f.locator('#screen-end')).toBeVisible();await expect(f.locator('#st-rounds')).toHaveText('6 / 6');await expect(f.locator('#st-errors')).toHaveText('2');
  return {correct:evaluated-2,total:evaluated,attempts:7,errors:2,time:await f.locator('#st-time').innerText()};
}
test.beforeEach(async({context,page})=>{
  if(process.env.RESULT_PILOT_PUBLIC!=='1')for(const id of ids)await context.route(`https://israeltiburcio-ai.github.io/${id}/**`,async r=>{
    const name=new URL(r.request().url()).pathname.slice(id.length+2);
    if(['','index.html','script.js','optilab-results.js'].includes(name))await r.fulfill({path:`${roots[id]}/${name||'index.html'}`,contentType:name.endsWith('.js')?'application/javascript':'text/html'});else await r.continue();
  });
  await page.addInitScript(()=>{if(window!==window.top)return;(window as any).pilotEvents=[];window.addEventListener('message',e=>{if(e.data?.protocol==='optilab-original-results')(window as any).pilotEvents.push({data:e.data,origin:e.origin,direct:e.source===document.querySelector<HTMLIFrameElement>('.original-player iframe')?.contentWindow});});});
});
for(const id of ids)for(const [width,height] of [[390,844],[1440,900]])test.describe(`LOCAL REAL ${id} ${width}`,()=>{
  test.use({hasTouch:width===390});
  test('partida completa real, unidades nativas, dedupe y replay sin guardar progreso',async({page})=>{
    test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const firebase=observeFirebase(page);await page.setViewportSize({width,height});
    await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page);
    const frame=page.frameLocator('.original-player iframe'),node=page.locator('.original-player iframe');await expect(node).toHaveAttribute('sandbox','allow-scripts');const src=await node.getAttribute('src');
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();const expected=await complete(frame,id);
    await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.locator('.original-session-result')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const events=await page.evaluate(()=>(window as any).pilotEvents as {data:any;origin:string;direct:boolean}[]),completed=events.filter(e=>e.data.type==='game:completed');expect(completed).toHaveLength(1);expect(completed[0].origin).toBe('null');expect(completed[0].direct).toBe(true);
    const message=completed[0].data,{reason,correct,total,attempts,errors:reportedErrors,durationMs,score}=message.result;
    expect({reason,correct,total,attempts,errors:reportedErrors}).toEqual({reason:'completed',correct:expected.correct,total:expected.total,attempts:expected.attempts,errors:expected.errors});expect(score).toBeUndefined();
    const [m,s]=expected.time.split(':').map(Number);expect(durationMs).toBeGreaterThanOrEqual((m*60+s)*1000-1);expect(durationMs).toBeLessThan((m*60+s+1)*1000+1);
    const run=message.runId;await expect(page.locator('.original-session-result')).toHaveAttribute('data-run-id',run);
    await frame.locator('body').evaluate((_,data)=>{parent.postMessage(data,'*');parent.postMessage(data,'*');},message);await expect(page.locator('.original-session-result')).toHaveCount(1);expect(await protectedProgress(page)).toEqual(before);
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();expect(await node.getAttribute('src')).toBe(src);await expect(page.locator('.original-session-result')).toHaveAttribute('data-run-id',run);
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await frame.locator('#btn-replay').click();await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.locator('.original-session-result')).toHaveCount(0);
    await frame.locator('body').evaluate((_,data)=>parent.postMessage(data,'*'),message);await expect(page.locator('.original-session-result')).toHaveCount(0);expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();const second=await complete(frame,id,true);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.locator('.original-session-result')).toBeVisible();
    const all=await page.evaluate(()=>(window as any).pilotEvents as {data:any}[]),last=all.filter(e=>e.data.type==='game:completed');expect(last).toHaveLength(5); // two genuine + three explicit duplicate/replay probes
    const next=last.at(-1)!.data;expect(next.runId).not.toBe(run);expect(next.result).toMatchObject({correct:second.correct,total:second.total,attempts:second.attempts,errors:second.errors});expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);expect(errors).toEqual([]);
  });
});
for(const id of ids)test(`LOCAL standalone ${id}: misma mecánica, sin canal ni mensajes de resultados`,async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`https://israeltiburcio-ai.github.io/${id}/`);await complete(page,id);expect(await page.evaluate(()=>(window as any).pilotEvents)).toEqual([]);expect(errors).toEqual([]);
});
for(const id of ids)test(`LOCAL bridge ${id}: rechaza init falsificado y conserva resultado real hasta el handshake válido`,async({page})=>{
  test.setTimeout(120000);await page.goto('#/mapa');const session=crypto.randomUUID(),origin=new URL(page.url()).origin;
  const init={protocol:'optilab-original-results',version:1,gameId:id,session,type:'host:init'};
  const source=new URL(`https://israeltiburcio-ai.github.io/${id}/`);source.searchParams.set('optilabSession',session);source.searchParams.set('optilabOrigin',origin);
  await page.evaluate(src=>{const f=document.createElement('iframe');f.id='manual-bridge';f.src=src;f.sandbox='allow-scripts';f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';document.body.append(f);},source.href);
  const frame=page.frameLocator('#manual-bridge');await frame.locator('body').waitFor();await page.frames().find(f=>f.url()===source.href)!.waitForLoadState('load');
  await frame.locator('body').evaluate((_,{init,origin})=>{for(const event of [{origin:'https://evil.example',source:parent},{origin,source:window}])window.dispatchEvent(new MessageEvent('message',{...event,data:init}));},{init,origin});
  for(const data of [{...init,session:crypto.randomUUID()},{...init,gameId:'memorama-simplex'},{...init,version:2},{...init,extra:true}])await page.locator('#manual-bridge').evaluate((f,data)=>(f as HTMLIFrameElement).contentWindow!.postMessage(data,'*'),data);
  const expected=await complete(frame,id);expect(await page.evaluate(()=>(window as any).pilotEvents)).toEqual([]);
  await page.locator('#manual-bridge').evaluate((f,data)=>(f as HTMLIFrameElement).contentWindow!.postMessage(data,'*'),init);
  await expect.poll(()=>page.evaluate(()=>(window as any).pilotEvents.length)).toBe(3);
  const messages=await page.evaluate(()=>(window as any).pilotEvents);expect(messages.map((e:any)=>e.data.type)).toEqual(['game:ready','game:started','game:completed']);expect(messages.every((e:any)=>e.origin==='null')).toBe(true);
  expect(messages[2].data.result.attempts).toBe(expected.attempts);expect(messages[2].data.result.correct).toBe(expected.correct);
});
test('LOCAL Ordena: salir antes del final comunica interrupción, nunca un resultado',async({page})=>{
  await page.goto('#/jugar-original/ordena-simplex');await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();const before=await protectedProgress(page);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();const frame=page.frameLocator('.original-player iframe');await frame.locator('#btn-start').click();await frame.locator('#btn-home').click();await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
  await expect(page.getByText('Partida interrumpida: no se recibió resultado.',{exact:true})).toBeVisible();await expect(page.locator('.original-session-result')).toHaveCount(0);
  expect((await page.evaluate(()=>(window as any).pilotEvents)).some((e:any)=>e.data.type==='game:completed')).toBe(false);expect(await protectedProgress(page)).toEqual(before);
});
