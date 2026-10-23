import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const emptyProgress=()=>({practiced:{},visited:[],badges:[],results:[],gameResults:[],nickname:'Entrenador OptiLab',
  route:[],avatarId:null,companionId:null,evolutionMilestones:[],evolutionCelebratedStage:1});
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')
  throw new Error('UI sync tests require BOTH local emulators, never production.');
const password='fixture-password';
const panel=(p:Page)=>p.getByRole('region',{name:'Sincronización de progreso'});
async function register(page:Page,email:string) {
  await page.goto('#/cuenta');await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  await page.getByLabel('Correo electrónico',{exact:true}).fill(email);
  await page.locator('#account-password').fill(password);await page.getByLabel('Repite tu contraseña').fill(password);
  await page.getByRole('button',{name:'Crear mi cuenta',exact:true}).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('button',{name:'Conservar progreso remoto',exact:true})).toBeEnabled();
}
async function login(page:Page,email:string) {
  await page.goto('#/cuenta');await page.getByLabel('Correo electrónico',{exact:true}).fill(email);
  await page.locator('#account-password').fill(password);await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();
  await expect(panel(page)).toBeVisible();
  const choice=panel(page).getByRole('button',{name:'Conservar progreso remoto',exact:true});
  if(await choice.isVisible()){await expect(choice).toBeEnabled();await choice.click();}
  else await synced(page);
}
const synced=async(page:Page)=>expect(panel(page).getByRole('status')).toContainText('Sincronizado',{timeout:20000});
test.beforeEach(async({context})=>{
  await context.route(/https:\/\/[^/]*(firestore|identitytoolkit|securetoken)[^/]*googleapis\.com/,route=>route.abort());
});
test('consent, cancel, import, recoverable backup, reload, and A logout B isolation',async({page,context})=>{
  const raw=JSON.stringify({...emptyProgress(),nickname:'Invitado fixture',avatarId:'avatar-02',companionId:'piv',
    practiced:{'memorama-simplex':'2026-01-01T00:00:00.000Z'},visited:[3],route:['memorama-simplex']});
  await page.addInitScript(raw=>{if(!localStorage.getItem('optilab-v1'))localStorage.setItem('optilab-v1',raw);},raw);
  const emailA=`a-${crypto.randomUUID()}@example.test`;
  await register(page,emailA);
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(raw);
  await panel(page).getByRole('button',{name:'Cancelar importación',exact:true}).click();
  await expect(panel(page).getByRole('status')).toContainText('Progreso local');
  await panel(page).getByRole('button',{name:'Importar progreso del navegador',exact:true}).click();await synced(page);
  for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]]) {
    await page.setViewportSize({width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  const audit=await new AxeBuilder({page}).include('.sync-panel').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations.map(v=>v.id)).toEqual([]);
  await page.goto('#/aventura');await expect(page.locator('#nickname')).toHaveValue('Invitado fixture');
  await page.reload();await synced(page);await expect(page.locator('#nickname')).toHaveValue('Invitado fixture');
  await page.locator('#nickname').fill('Privado A');await page.locator('#nickname').press('Tab');await synced(page);
  await expect(panel(page).getByText(/Respaldos de esta cuenta/)).toBeVisible();
  const secondTab=await context.newPage();await secondTab.goto('#/aventura');await synced(secondTab);
  await expect(secondTab.locator('#nickname')).toHaveValue('Privado A');
  await page.goto('#/cuenta');await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(panel(secondTab)).toHaveCount(0);await expect(secondTab.locator('#nickname')).toHaveValue('Invitado fixture');
  await register(page,`b-${crypto.randomUUID()}@example.test`);
  await expect(page.locator('body')).not.toContainText('Privado A');
  await expect(panel(page).getByText(/Respaldos de esta cuenta/)).toHaveCount(0);
  await expect(secondTab.locator('body')).not.toContainText('Privado A');
  await secondTab.reload();await expect(secondTab.locator('#nickname')).toHaveValue('Entrenador OptiLab');
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(raw);
  await page.goto('#/cuenta');await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(panel(secondTab)).toHaveCount(0);
  await login(page,emailA);await page.goto('#/aventura');await synced(page);
  await expect(page.locator('#nickname')).toHaveValue('Privado A');
  await secondTab.reload();
  await expect(secondTab.locator('#nickname')).toHaveValue('Privado A');
});
test('two browser clients converge; offline preference conflicts require review and survive reload',async({browser})=>{
  const ca=await browser.newContext({baseURL:'http://127.0.0.1:5195/optilab/'}),cb=await browser.newContext({baseURL:'http://127.0.0.1:5195/optilab/'});
  try {
    const a=await ca.newPage(),b=await cb.newPage(),email=`devices-${crypto.randomUUID()}@example.test`;
    await register(a,email);await panel(a).getByRole('button',{name:'Conservar progreso remoto',exact:true}).click();
    await a.goto('#/aventura');await a.locator('#nickname').fill('Base');await a.locator('#nickname').press('Tab');await synced(a);
    await login(b,email);await b.goto('#/aventura');await expect(b.locator('#nickname')).toHaveValue('Base');
    await ca.setOffline(true);await cb.setOffline(true);
    await a.locator('#nickname').fill('Offline A');await a.locator('#nickname').press('Tab');
    await b.locator('#nickname').fill('Offline B');await b.locator('#nickname').press('Tab');
    await expect(panel(a).getByRole('status')).toContainText('Sin conexión');
    await ca.setOffline(false);await synced(a);
    await cb.setOffline(false);await expect(panel(b).getByRole('status')).toContainText('Conflicto',{timeout:20000});
    await b.reload();await expect(panel(b).getByRole('status')).toContainText('Conflicto');
    await panel(b).getByRole('button',{name:'Aplicar mis cambios revisados',exact:true}).click();await synced(b);
    await expect(a.locator('#nickname')).toHaveValue('Offline B',{timeout:20000});
    await a.locator('#nickname').fill('Online A draft');
    await b.locator('#nickname').fill('Online B saved');await b.locator('#nickname').press('Tab');await synced(b);
    await a.locator('#nickname').press('Tab');
    await expect(panel(a).getByRole('status')).toContainText('Conflicto',{timeout:20000});
    await expect(panel(a)).toContainText('Online B saved');await expect(panel(a)).toContainText('Online A draft');
    await panel(a).getByRole('button',{name:'Usar remoto y guardar copia de mis cambios',exact:true}).click();await synced(a);
    await expect(a.locator('#nickname')).toHaveValue('Online B saved');
  } finally {await ca.close();await cb.close();}
});
test('offline practice unmark persists; reset prevents an old device from resurrecting the adventure',async({browser})=>{
  const ca=await browser.newContext({baseURL:'http://127.0.0.1:5195/optilab/'}),cb=await browser.newContext({baseURL:'http://127.0.0.1:5195/optilab/'});
  try {
    const a=await ca.newPage(),b=await cb.newPage(),email=`reset-${crypto.randomUUID()}@example.test`;
    await register(a,email);await panel(a).getByRole('button',{name:'Conservar progreso remoto',exact:true}).click();
    await a.goto('#/gimnasio/1');await a.locator('.practice-toggle').first().click();await synced(a);
    await login(b,email);await b.goto('#/gimnasio/1');await expect(b.locator('.practice-toggle').first()).toHaveAttribute('aria-pressed','true');
    await cb.setOffline(true);await b.locator('.practice-toggle').first().click();
    await cb.setOffline(false);await synced(b);
    await expect(a.locator('.practice-toggle').first()).toHaveAttribute('aria-pressed','false',{timeout:20000});
    await b.reload();await synced(b);await expect(b.locator('.practice-toggle').first()).toHaveAttribute('aria-pressed','false');
    await cb.setOffline(true);await b.locator('.practice-toggle').first().click();
    await a.goto('#/aventura');await a.getByRole('button',{name:'Reiniciar aventura de cuenta',exact:true}).click();
    await a.getByRole('button',{name:'Sí, reiniciar aventura',exact:true}).click();await synced(a);
    await cb.setOffline(false);await expect(panel(b).getByRole('status')).toContainText('Conflicto',{timeout:20000});
    await expect(panel(b)).toContainText('reiniciada en otro dispositivo');
    await panel(b).getByRole('button',{name:'Usar remoto y guardar copia de mis cambios',exact:true}).click();await synced(b);
    await b.goto('#/gimnasio/1');await expect(b.locator('.practice-toggle').first()).toHaveAttribute('aria-pressed','false');
    await expect(a.locator('#nickname')).toHaveValue('Entrenador OptiLab');
  } finally {await ca.close();await cb.close();}
});
test('backup export and explicit restore work in the UI without changing guest legacy',async({page})=>{
  await register(page,`backup-${crypto.randomUUID()}@example.test`);
  await panel(page).getByRole('button',{name:'Conservar progreso remoto',exact:true}).click();
  await page.goto('#/aventura');await page.locator('#nickname').fill('Recuperable');await page.locator('#nickname').press('Tab');await synced(page);
  const downloaded=page.waitForEvent('download');
  await panel(page).getByRole('button',{name:'Crear y exportar respaldo',exact:true}).click();
  expect((await downloaded).suggestedFilename()).toBe('optilab-respaldo.json');
  await page.locator('#nickname').fill('Posterior');await page.locator('#nickname').press('Tab');await synced(page);
  await panel(page).getByText(/Respaldos de esta cuenta/).click();
  await panel(page).getByRole('button',{name:'Revisar restauración',exact:true}).first().click();
  await panel(page).getByRole('button',{name:'Confirmar restauración en mi cuenta',exact:true}).click();await synced(page);
  await expect(page.locator('#nickname')).toHaveValue('Recuperable');
});
test('real local Memorama survives remote profile updates and arena; result syncs once to another client',async({browser})=>{
  test.skip(!process.env.MEMORAMA_DIR,'Set MEMORAMA_DIR to pinned game fixture 7a58545; CI supplies it.');
  const ca=await browser.newContext({baseURL:'http://127.0.0.1:5195/optilab/'}),cb=await browser.newContext({baseURL:'http://127.0.0.1:5195/optilab/'});
  try {
    const a=await ca.newPage(),b=await cb.newPage(),email=`game-${crypto.randomUUID()}@example.test`;
    await a.route('https://israeltiburcio-ai.github.io/memorama-simplex/**',async route=>{
      const url=new URL(route.request().url());
      const response=await a.request.get('http://127.0.0.1:5190/'+url.pathname.replace('/memorama-simplex/','')+url.search);
      await route.fulfill({response});
    });
    await register(a,email);await panel(a).getByRole('button',{name:'Conservar progreso remoto',exact:true}).click();
    await login(b,email);
    await a.goto('#/jugar/memorama-simplex');await expect(a.locator('.player-status')).toContainText('Conectado');
    const frame=a.frameLocator('.player-frame-shell iframe'),element=await a.locator('.player-frame-shell iframe').elementHandle();
    await frame.locator('#btn-play').click();
    const pairs=await frame.locator('#board').evaluate(board=>{
      const data=(window as any).MEMORAMA_DATA.pairs;
      const text=(html:string)=>{const el=document.createElement('div');el.innerHTML=html;return el.textContent!.replace(/\s+/g,' ').trim();};
      const groups:Record<string,number[]>={};
      board.querySelectorAll('.card-text').forEach((el,i)=>{
        const content=el.textContent!.replace(/\s+/g,' ').trim();
        const pair=data.find((p:any)=>text(p.a)===content||text(p.b)===content);
        if(!pair)throw new Error('Unknown academic card');(groups[pair.id]??=[]).push(i);
      });return Object.values(groups);
    });
    await frame.locator('.card').nth(pairs[0][0]).click();await frame.locator('.card').nth(pairs[0][1]).click();
    await b.goto('#/aventura');await b.locator('#nickname').fill('Durante partida');await b.locator('#nickname').press('Tab');await synced(b);
    await expect.poll(()=>a.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.startsWith('optilab-sync:v2:')&&k.endsWith(':cache'));
      return key?JSON.parse(localStorage.getItem(key)!).snapshot.fields.nickname?.value:null;
    })).toBe('Durante partida');
    await a.getByRole('button',{name:'Pantalla grande',exact:true}).click();
    await a.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
    expect(await element!.evaluate(el=>el.isConnected&&el===document.querySelector('.player-frame-shell iframe'))).toBe(true);
    for(const pair of pairs.slice(1)){await frame.locator('.card').nth(pair[0]).click();await frame.locator('.card').nth(pair[1]).click();}
    await expect(a.getByRole('heading',{name:'Memorama Simplex completado',exact:true})).toBeVisible();await synced(a);
    await expect(b.locator('.game-result-panel')).toContainText('100%',{timeout:20000});
    await b.reload();await synced(b);await expect(b.locator('.game-result-panel')).toContainText('100%');
    await expect(b.locator('.game-history')).toContainText('1 finalizaciones guardadas');
  } finally {await ca.close();await cb.close();}
});
