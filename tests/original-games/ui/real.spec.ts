import {test,expect} from '@playwright/test';
import {protectedProgress,visitedGyms,observeFirebase} from '../progressAssertions';
test.skip(process.env.VERIFY_ORIGINAL_GAMES!=='1','Red real opt-in: VERIFY_ORIGINAL_GAMES=1; no mocks.');
const ids=['ahorcado-simplex','ordena-simplex','rompecabezas-simplex','caza-el-pivote'];
const startButtons:Record<string,string>={'ahorcado-simplex':'#btn-empezar','ordena-simplex':'#btn-start','rompecabezas-simplex':'#start-game','caza-el-pivote':'#play-button'};
for(const id of ids)for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]])test.describe(`${id} ${width}`,()=>{
  test.use({hasTouch:width===390});
  test('juego real: interacción, aislamiento, misma partida y navegación',async({page,context})=>{
    test.setTimeout(90000);await page.setViewportSize({width,height});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const firebase=observeFirebase(page);
    await page.goto(`#/jugar-original/${id}`);await expect(page.getByRole('status')).toContainText('Visor abierto',{timeout:60000});
    const frame=page.frameLocator('.original-player iframe'),node=page.locator('.original-player iframe');
    const press=async(selector:string)=>{if(width===390)await frame.locator(selector).first().tap();else await frame.locator(selector).first().click();};
    await press(startButtons[id]);await expect(frame.locator(id==='ahorcado-simplex'?'#pantalla-juego':'#screen-game')).toBeVisible();
    if(id==='ahorcado-simplex'){await press('#teclado button');await expect(frame.locator('#teclado button').first()).toBeDisabled();}
    else if(id==='ordena-simplex'){await press('#tray button');await press('#slots button');await expect(frame.locator('#slots button').first()).not.toContainText('Hueco vacío');}
    else if(id==='rompecabezas-simplex'){
      // Real pointer drag on desktop, the game's supported tap-to-place on mobile/tablet.
      const piece=frame.locator('.piece-button').first(),slot=frame.locator('.equation-slot').first();
      if(width>=1180){await piece.dragTo(slot);await page.waitForTimeout(500);/* Game suppresses clicks for 450ms after a drag. */}else{await press('.piece-button');await press('.equation-slot');}
      await expect(slot).not.toHaveAttribute('aria-label',/vacío/);
      const count=await frame.locator('.equation-slot').count();
      for(let i=1;i<count;i++){await press('.piece-button:not(.used)');const target=frame.locator('.equation-slot').nth(i);if(width===390)await target.tap();else await target.click();}
      await expect(frame.locator('#check-button')).toBeEnabled();await press('#check-button');await expect(frame.locator('#feedback')).not.toHaveText('');
    }else{
      // Derive the pivot from the displayed tableau, then use actual game controls.
      const read=(s:string)=>Number(s.replace(/−/g,'-').replace(',','.'));
      const costs=(await frame.locator('[data-kind="zvalue"]').allTextContents()).map(read),col=costs.indexOf(Math.min(...costs));
      await press(`[data-kind="column"][data-c="${col}"]`);await expect(frame.locator('#prompt-kicker')).toContainText('2');
      const ratios=await frame.locator('.constraint-row').evaluateAll((rows,col)=>rows.map(row=>{const coefficient=Number(row.querySelector(`[data-kind="cell"][data-c="${col}"]`)!.textContent!.replace(/−/g,'-'));const rhs=Number(row.querySelector('[data-kind="sol"]')!.textContent!.replace(/−/g,'-'));return coefficient>0?rhs/coefficient:null;}),col);
      const row=ratios.indexOf(Math.min(...ratios.filter((r):r is number=>r!==null)));
      await press(`[data-kind="row"][data-r="${row}"]`);await expect(frame.locator('#prompt-kicker')).toContainText('3');
    }
    expect(await frame.locator('body').evaluate(()=>{try{localStorage.getItem('any');return false;}catch(e){return (e as Error).name==='SecurityError';}})).toBe(true);
    const snapshot=()=>frame.locator('body').evaluate((_,id)=>{
      const text=(s:string)=>document.querySelector(s)!.textContent;
      if(id==='ahorcado-simplex')return {word:text('#palabra'),letters:[...document.querySelectorAll('#teclado button:disabled')].map(e=>e.textContent)};
      if(id==='ordena-simplex')return {slots:text('#slots')};
      if(id==='rompecabezas-simplex')return {slots:text('#equation-board'),round:text('#round-count'),score:text('#score'),hits:text('#hits'),feedback:text('#feedback')};
      return {step:text('#prompt-kicker'),round:text('#round-number'),score:text('#score'),hits:text('#hits'),selected:[...document.querySelectorAll('.is-col,.is-row')].map(e=>e.getAttribute('aria-label'))};
    },id);
    const clock=async()=>{const value=await frame.locator(id==='ahorcado-simplex'?'#txt-tiempo':'#timer').innerText();const [minutes,seconds]=value.split(':').map(Number);return minutes*60+seconds;};
    const timeBefore=await clock();
    const state=await snapshot(),progress=await protectedProgress(page),visits=await visitedGyms(page);
    const marker=await frame.locator('body').evaluate(()=>{(window as any).pilotMarker=crypto.randomUUID();return (window as any).pilotMarker;});
    await node.evaluate(el=>{(el as any).initialWindow=(el as HTMLIFrameElement).contentWindow;});const handle=await node.elementHandle(),src=await node.getAttribute('src');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await frame.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Salir de pantalla grande',exact:true})).toBeFocused();
    const box=await node.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(width-4);expect(box!.height).toBeGreaterThanOrEqual(height-100);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
    expect(await node.evaluate(el=>(el as any).initialWindow===(el as HTMLIFrameElement).contentWindow)).toBe(true);expect(await snapshot()).toEqual(state);
    await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();await expect(page.getByRole('button',{name:'Pantalla grande',exact:true})).toBeFocused();expect(await handle!.evaluate(el=>el.isConnected)).toBe(true);expect(await node.getAttribute('src')).toBe(src);expect(await frame.locator('body').evaluate(()=>(window as any).pilotMarker)).toBe(marker);expect(await snapshot()).toEqual(state);await expect(page.locator('body')).not.toHaveAttribute('data-game-arena','expanded');
    expect(await protectedProgress(page)).toEqual(progress);expect(await visitedGyms(page)).toEqual(visits);expect(context.pages()).toHaveLength(1);
    const timeAfter=await clock();if(id==='ahorcado-simplex'||id==='caza-el-pivote')expect(timeAfter).toBeLessThanOrEqual(timeBefore);else expect(timeAfter).toBeGreaterThanOrEqual(timeBefore);
    if(id==='rompecabezas-simplex')await expect.poll(clock).toBeGreaterThan(timeBefore);
    if(id==='caza-el-pivote')await expect.poll(clock).toBeLessThan(timeBefore);
    const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Abrir juego independiente',exact:false}).click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');expect(popup.url()).toBe(`https://israeltiburcio-ai.github.io/${id}/`);expect(await popup.evaluate(()=>window.opener===null&&document.referrer==='')).toBe(true);await popup.close();
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toHaveText('Fortaleza Simplex');await expect(page.locator('body')).not.toHaveAttribute('data-game-arena','expanded');await expect(page.locator('[inert]')).toHaveCount(0);expect(await page.locator('body').evaluate(el=>getComputedStyle(el).position)).not.toBe('fixed');await expect(page.locator('.original-player iframe')).toHaveCount(0);expect(errors).toEqual([]);
    await expect.poll(()=>visitedGyms(page)).toContain(3);expect(await protectedProgress(page)).toEqual(progress);expect(firebase).toEqual([]);
  });
});
for(const id of ids)test(`origen compartido real: ${id} no puede acceder a OptiLab`,async({page})=>{
  test.setTimeout(90000);await page.goto('https://israeltiburcio-ai.github.io/optilab/');
  // New guest context: no owner session or production account is used.
  await page.evaluate(id=>{localStorage.setItem('pilot-canary','host-only');const frame=document.createElement('iframe');frame.id='sandbox-probe';frame.sandbox='allow-scripts';frame.src=`https://israeltiburcio-ai.github.io/${id}/`;document.body.append(frame);},id);
  const child=page.frameLocator('#sandbox-probe');await child.locator('body').waitFor();await page.frames().find(f=>f.url()===`https://israeltiburcio-ai.github.io/${id}/`)!.waitForLoadState('load');
  expect(await child.locator('body').evaluate(()=>{const denied=(f:()=>unknown)=>{try{f();return false;}catch(e){return (e as Error).name==='SecurityError';}};return {parentDOM:denied(()=>parent.document.body),parentStorage:denied(()=>parent.localStorage.getItem('pilot-canary')),ownStorage:denied(()=>localStorage.getItem('pilot-canary'))};})).toEqual({parentDOM:true,parentStorage:true,ownStorage:true});
  expect(await page.evaluate(()=>localStorage.getItem('pilot-canary'))).toBe('host-only');
});
