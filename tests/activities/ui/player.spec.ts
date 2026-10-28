import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const activities=[{id:'learningapps-formulas-simplex',title:'Fórmulas para el Simplex',provider:'LearningApps'}, {id:'wordwall-metodo-m-grande',title:'Método de M Grande',provider:'Wordwall'}] as const;
const fixture=`<!doctype html><html lang="es"><title>Fixture controlado, NO proveedor real</title><body><h1>Actividad de prueba</h1><button id="move" onclick="document.querySelector('#count').textContent=String(++window.moves)">Continuar partida</button><p id="count">0</p><script>window.marker=crypto.randomUUID();window.moves=0;</script></body></html>`;
test.beforeEach(async({context})=>{
  // Controlled same-provider-origin fixtures test the host protocol/security, not
  // compatibility or academic results. Separate opt-in tests use real providers.
  await context.route('https://learningapps.org/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
  await context.route('https://wordwall.net/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
});
for(const a of activities)for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]])test(`${a.provider} ${width}: mismo iframe, documento y partida al ampliar/restaurar`,async({page})=>{
  await page.setViewportSize({width,height});await page.goto(`#/actividad/${a.id}`);await expect(page.getByRole('heading',{name:a.title,exact:true})).toBeVisible();
  const iframe=page.locator('.external-frame-shell iframe'),child=page.frameLocator('.external-frame-shell iframe');await child.getByRole('button',{name:'Continuar partida'}).click();
  const node=await iframe.elementHandle(),marker=await child.locator('body').evaluate(()=>(window as any).marker),src=await iframe.getAttribute('src');
  await iframe.evaluate(n=>{(window as any).originalActivityFrame=n;(window as any).originalActivityWindow=(n as HTMLIFrameElement).contentWindow;});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await expect(page.getByRole('dialog',{name:a.title,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Salir de pantalla grande',exact:true})).toBeFocused();
  expect(await iframe.evaluate(n=>n===(window as any).originalActivityFrame&&(n as HTMLIFrameElement).contentWindow===(window as any).originalActivityWindow)).toBe(true);
  expect(await child.locator('body').evaluate(()=>(window as any).marker)===marker).toBe(true);await expect(child.locator('#count')).toHaveText('1');
  await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();expect(await iframe.getAttribute('src')===src).toBe(true);expect(await node!.evaluate(n=>n.isConnected)).toBe(true);await expect(child.locator('#count')).toHaveText('1');
  expect(await page.locator('.external-play-state').getAttribute('data-observation-count')).toBe('1');
  const audit=await new AxeBuilder({page}).include('.external-player').disableRules(['frame-tested']).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>v.id)).toEqual([]);
});
test('catalog additional: ambos en gimnasio3, los28 originales intactos',async({page})=>{
  await page.goto('#/gimnasio/3');await expect(page.locator('.external-activity-card')).toHaveCount(2);
  await page.getByRole('link',{name:'Abrir actividad',exact:false}).first().click();await expect(page.getByRole('heading',{name:activities[0].title,exact:true})).toBeVisible();
  await page.getByRole('link',{name:'← Regresar al gimnasio',exact:true}).click();await expect(page.getByRole('heading',{name:'Fortaleza Simplex',exact:true})).toBeVisible();
  await page.goto('#/optidex');await expect(page.locator('.cartridge')).toHaveCount(28);await page.goto('#/mapa');await expect(page.locator('.map-node')).toHaveCount(5);
});
test('reload, navegación y pantalla grande: no se simula restauración de partida al salir',async({page})=>{
  await page.goto(`#/actividad/${activities[0].id}`);const child=page.frameLocator('.external-frame-shell iframe');await child.getByRole('button',{name:'Continuar partida'}).click();
  const before=await child.locator('body').evaluate(()=>(window as any).marker);await page.reload();await expect(child.locator('#count')).toHaveText('0');expect(await child.locator('body').evaluate(()=>(window as any).marker)!==before).toBe(true);
  await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.external-frame-shell iframe')).toHaveCount(0);await expect(page.locator('body')).not.toHaveAttribute('data-game-arena','expanded');
});
test('apertura externa sin opener/referrer, política mínima y URL sin identidad personal',async({page,context})=>{
  let referrer:string|undefined;context.on('request',r=>{if(r.isNavigationRequest()&&r.url()==='https://learningapps.org/watch?v=pznycxd7t21')referrer=r.headers().referer;});
  await page.goto(`#/actividad/${activities[0].id}`);const iframe=page.locator('.external-frame-shell iframe');await expect(iframe).toHaveAttribute('sandbox','allow-scripts allow-same-origin allow-forms');await expect(iframe).toHaveAttribute('referrerpolicy','no-referrer');
  expect(new URL((await iframe.getAttribute('src'))!).searchParams.size).toBe(1);
  const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Abrir externamente',exact:false}).click();const external=await popup;await external.waitForLoadState();expect(await external.evaluate(()=>window.opener===null)).toBe(true);expect(referrer===undefined).toBe(true);await external.close();
});
test('LearningApps: origen/source/esquema/instancia falsos no completan; fixture compatible se deduplica sin recompensas',async({page})=>{
  await page.goto(`#/actividad/${activities[0].id}`);const frame=page.frameLocator('.external-frame-shell iframe');await frame.getByRole('button',{name:'Continuar partida'}).waitFor();
  const original=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  await page.evaluate(()=>{
    const source=document.querySelector<HTMLIFrameElement>('.external-frame-shell iframe')!.contentWindow;
    for(const event of [{origin:'https://evil.example',source,data:'AppSolved|pznycxd7t21|100|4|0'},
      {origin:'https://learningapps.org',source:window,data:'AppSolved|pznycxd7t21|100|4|0'},
      {origin:'https://learningapps.org',source,data:{type:'AppCompleted'}},
      {origin:'https://learningapps.org',source,data:'AppSolved|anotherresource|100|4|0'}])window.dispatchEvent(new MessageEvent('message',event));
  });
  await frame.locator('body').evaluate(()=>{parent.postMessage('UnknownResult|pznycxd7t21|100','*');parent.postMessage({protocol:'optilab-game',type:'game:completed'},'*');});
  expect(await page.locator('.external-play-state').getAttribute('data-observation-count')).toBe('1');
  await frame.locator('body').evaluate(()=>{parent.postMessage('AppCompleted|pznycxd7t21|4|0','*');parent.postMessage('AppSolved|pznycxd7t21|100|4|0','*');});
  await expect(page.getByText('Finalización observada:',{exact:false})).toBeVisible();await expect(page.locator('.external-play-state')).toHaveAttribute('data-observation-count','2');
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))===original).toBe(true);await expect(page.getByRole('link',{name:'0 / 28'})).toBeVisible();
  await page.goto(`#/actividad/${activities[1].id}`);const wordwall=page.frameLocator('.external-frame-shell iframe');await wordwall.locator('body').evaluate(()=>parent.postMessage('AppSolved|pznycxd7t21|100|4|0','*'));
  await expect(page.locator('.external-play-state')).toHaveAttribute('data-observation-count','1');await expect(page.getByText('Finalización observada:',{exact:false})).toHaveCount(0);
});
test('mensajes de otro iframe del mismo proveedor no son de la actividad activa',async({page})=>{
  await page.goto(`#/actividad/${activities[0].id}`);await page.evaluate(()=>{const other=document.createElement('iframe');other.id='unrelated';other.src='https://learningapps.org/show.php?id=unrelated';document.body.append(other);});
  await page.frameLocator('#unrelated').locator('body').evaluate(()=>parent.postMessage('AppSolved|pznycxd7t21|100|4|0','*'));
  await expect(page.locator('.external-play-state')).toHaveAttribute('data-observation-count','1');
});
test('proveedor bloqueado: fallback siempre accesible sin declarar detección infalible',async({page})=>{
  await page.route('https://wordwall.net/**',r=>r.abort());await page.goto(`#/actividad/${activities[1].id}`);
  await expect(page.getByRole('heading',{name:'¿No aparece o no responde?',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Abrir en otra pestaña',exact:false})).toBeVisible();
  await expect(page.getByText('No podemos detectarlo siempre',{exact:false})).toBeVisible();await expect(page.locator('.external-frame-shell iframe')).toHaveCount(1);await expect(page.locator('.external-play-state')).toHaveAttribute('data-observation-count','1');
});
test('rutas no son un proxy de URL ni conceden acceso docente o actividades privadas',async({page})=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes(':5200'))requests.push(r.url());});
  await page.goto('#/actividad/private-group-activity?courseId=other&role=teacher&url=https://evil.example');await expect(page.getByRole('heading',{name:'Esta actividad no está disponible'})).toBeVisible();await expect(page.locator('.external-frame-shell iframe')).toHaveCount(0);
  await page.goto('#/docente');await expect(page.getByRole('heading',{name:'Te saliste del sendero'})).toBeVisible();expect(requests.length).toBe(0);
});
test.skip('asignación privada/revocada por grupo: pendiente de contrato confiable #5/#6, no implementado en este catálogo público',()=>{});
