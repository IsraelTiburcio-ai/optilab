import {test,expect,type Page} from '@playwright/test';
import {protectedProgress,observeFirebase} from '../progressAssertions';
import {ORIGINAL_RESULTS_PROTOCOL as protocol} from '../../../src/integration/originalResults';
const ids=['ahorcado-simplex','ordena-simplex'];
const fixture=(gameId:string)=>`<!doctype html><html lang="es"><title>Fixture de contrato; NO juego real</title><body><button>Fixture controlado</button><script>
const p=new URLSearchParams(location.search);window.base={protocol:'${protocol}',version:1,gameId:'${gameId}',session:p.get('optilabSession')};
window.addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='host:init'&&e.data.session===window.base.session)parent.postMessage({...window.base,type:'game:ready'},p.get('optilabOrigin'));});
</script></body></html>`;
test.beforeEach(async({context})=>{for(const id of [...ids,'lp-factory'])await context.route(`https://israeltiburcio-ai.github.io/${id}/*`,r=>r.fulfill({contentType:'text/html',body:fixture(id)}));});
const metrics=(id:string)=>id==='ahorcado-simplex'?{reason:'completed',correct:3,total:3,attempts:20,errors:1,durationMs:1200}:{reason:'completed',correct:30,total:32,attempts:7,errors:2,durationMs:1200};
async function channel(page:Page,id:string){
  await page.goto(`#/jugar-original/${id}`);await expect(page.getByText('Resultados de sesión: conector disponible.',{exact:true})).toBeVisible();
  const src=(await page.locator('.original-player iframe').getAttribute('src'))!,session=new URL(src).searchParams.get('optilabSession')!;
  return {src,base:{protocol,version:1,gameId:id,session}};
}
async function post(page:Page,data:unknown,selector='.original-player iframe'){
  await page.frameLocator(selector).locator('body').evaluate((_,data)=>parent.postMessage(data,'*'),data);
}
for(const id of ids)test(`fixture ${id}: fuente/origen/sesión/esquema falsos no cuentan; duplicados y replay se ignoran`,async({page})=>{
  const firebase=observeFirebase(page),{src,base}=await channel(page,id),before=await protectedProgress(page),run=crypto.randomUUID();
  const start={...base,type:'game:started',runId:run},end={...start,type:'game:completed',result:metrics(id)};
  await post(page,end);await expect(page.locator('.original-session-result')).toHaveCount(0);
  await page.evaluate(data=>{const source=document.querySelector<HTMLIFrameElement>('iframe')!.contentWindow;for(const e of [{origin:'https://evil.example',source},{origin:'https://israeltiburcio-ai.github.io',source},{origin:'null',source:window}])window.dispatchEvent(new MessageEvent('message',{...e,data}));},start);
  await page.evaluate(src=>{const other=document.createElement('iframe');other.id='sibling';other.sandbox='allow-scripts';other.src=src;document.body.append(other);},src);
  await page.frameLocator('#sibling').getByRole('button').waitFor();await post(page,start,'#sibling');await post(page,end,'#sibling');await expect(page.locator('.original-session-result')).toHaveCount(0);
  await post(page,start);
  for(const bad of [{...end,session:crypto.randomUUID()},{...end,gameId:'memorama-simplex'},{...end,version:2},{...end,result:{...metrics(id),durationMs:-1}},{...end,extra:'teacher'},{...end,result:{...metrics(id),correct:1000000}},{...end,runId:crypto.randomUUID()}])await post(page,bad);
  await expect(page.locator('.original-session-result')).toHaveCount(0);
  await post(page,end);await post(page,end);await expect(page.locator('.original-session-result')).toHaveCount(1);await expect(page.locator('.original-session-result')).toHaveAttribute('data-run-id',run);
  const node=await page.locator('.original-player iframe').elementHandle();await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();expect(await node!.evaluate(e=>e.isConnected)).toBe(true);await expect(page.locator('.original-session-result')).toBeVisible();expect(await page.locator('.original-player iframe').getAttribute('src')).toBe(src);
  const next=crypto.randomUUID();await post(page,{...start,runId:next});await expect(page.locator('.original-session-result')).toHaveCount(0);await post(page,end);await expect(page.locator('.original-session-result')).toHaveCount(0);
  await post(page,{...end,runId:next});await expect(page.locator('.original-session-result')).toHaveAttribute('data-run-id',next);
  expect(await protectedProgress(page)).toEqual(before);expect(firebase).toEqual([]);
});
test('documento recargado y sesión anterior quedan retirados; nueva sesión no hereda informes',async({page})=>{
  const id=ids[0],{src,base}=await channel(page,id),runId=crypto.randomUUID(),start={...base,type:'game:started',runId},end={...start,type:'game:completed',result:metrics(id)};
  await post(page,start);await post(page,end);await expect(page.locator('.original-session-result')).toHaveCount(1);
  await page.frames().find(f=>f.url()===src)!.goto(src);
  await expect(page.getByText('El visor cambió de documento.',{exact:false})).toBeVisible();
  await post(page,{...base,type:'game:ready'});await post(page,start);await post(page,end);await expect(page.locator('.original-session-result')).toHaveCount(0);
  await page.goto('#/mapa');const current=await channel(page,id);expect(current.base.session).not.toBe(base.session);await post(page,start);await post(page,end);await expect(page.locator('.original-session-result')).toHaveCount(0);
});
test('los otros25 no reciben sesión ni interpretan el contrato piloto',async({page})=>{
  await page.goto('#/jugar-original/lp-factory');const node=page.locator('.original-player iframe');await expect(node).toHaveAttribute('src','https://israeltiburcio-ai.github.io/lp-factory/');await page.frameLocator('iframe').getByRole('button').waitFor();
  const base={protocol,version:1,gameId:'ahorcado-simplex',session:crypto.randomUUID()},runId=crypto.randomUUID();for(const data of [{...base,type:'game:ready'},{...base,type:'game:started',runId},{...base,type:'game:completed',runId,result:metrics(ids[0])}])await post(page,data);
  await expect(page.locator('.original-session-result')).toHaveCount(0);await expect(page.getByText('Resultados de sesión:',{exact:false})).toHaveCount(0);
});
