import {test,expect} from '@playwright/test';
import {remainingGames,interact,snapshot} from '../remainingCases';
import {protectedProgress,visitedGyms,observeFirebase} from '../progressAssertions';
test.skip(process.env.VERIFY_ORIGINAL_GAMES!=='1','23 juegos reales opt-in, sin mocks: VERIFY_ORIGINAL_GAMES=1.');
test.describe.configure({mode:'parallel'});

for(const game of remainingGames)for(const [width,height] of [[390,844],[1440,900]])test.describe(`${game.repo} ${width}`,()=>{
  test.use({hasTouch:width===390});
  test('REAL: interacción, arena sin reinicio, aislamiento, regreso y fallback',async({page,context})=>{
    test.setTimeout(60000);page.setDefaultTimeout(10000);await page.setViewportSize({width,height});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(`${e.name}: ${e.message}`));
    const firebase=observeFirebase(page);
    await page.goto(`#/gimnasio/${game.gimnasio}`);
    await expect(page.locator('.gym-banner h1')).toBeVisible();
    await expect.poll(()=>visitedGyms(page)).toContain(game.gimnasio);
    const visits=await visitedGyms(page);
    const card=page.locator('.cartridge').filter({has:page.getByRole('heading',{name:game.nombre,exact:true})}),play=card.locator('.play');
    const progress=await protectedProgress(page);
    await play.press('Enter');await expect(page).toHaveURL(new RegExp(`#/jugar-original/${game.repo}$`));await expect(page.locator('.original-player h1')).toHaveText(game.nombre);await expect(page.getByRole('status')).toContainText('Visor abierto',{timeout:45000});
    const frame=page.frameLocator('.original-player iframe'),node=page.locator('.original-player iframe');
    if(game.repo==='OptiQuest1')await page.frames().find(f=>f.url()===game.juego_url)!.waitForLoadState('networkidle');
    await interact(frame,page,game.repo,width===390);
    await expect(node).toHaveAttribute('sandbox','allow-scripts');
    await page.evaluate(()=>localStorage.setItem('remaining-canary','host-only'));
    expect(await frame.locator('body').evaluate(()=>{const denied=(fn:()=>unknown)=>{try{fn();return false;}catch(e){return (e as Error).name==='SecurityError';}};return {dom:denied(()=>parent.document.body),storage:denied(()=>parent.localStorage.getItem('remaining-canary')),own:denied(()=>localStorage.getItem('remaining-canary'))};})).toEqual({dom:true,storage:true,own:true});
    const state=await snapshot(frame,game.repo),marker=await frame.locator('body').evaluate(()=>{(window as any).remainingMarker=crypto.randomUUID();return (window as any).remainingMarker;});
    const handle=await node.elementHandle();await node.evaluate(el=>(el as any).initialWindow=(el as HTMLIFrameElement).contentWindow);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(await snapshot(frame,game.repo)).toEqual(state);
    const box=await node.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(width-4);expect(box!.height).toBeGreaterThanOrEqual(height-100);
    await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
    expect(await handle!.evaluate(el=>el.isConnected&&(el as any).initialWindow===(el as HTMLIFrameElement).contentWindow)).toBe(true);expect(await frame.locator('body').evaluate(()=>(window as any).remainingMarker)).toBe(marker);expect(await snapshot(frame,game.repo)).toEqual(state);
    expect(await protectedProgress(page)).toEqual(progress);expect(await visitedGyms(page)).toEqual(visits);expect(await page.evaluate(()=>localStorage.getItem('remaining-canary'))).toBe('host-only');expect(context.pages()).toHaveLength(1);
    const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Abrir juego independiente',exact:false}).click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');expect(popup.url()).toBe(game.juego_url);expect(await popup.evaluate(()=>window.opener===null&&document.referrer==='')).toBe(true);await popup.close();
    await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await page.getByRole('link',{name:'Regresar al gimnasio desde pantalla grande'}).click();await expect(page.locator('.gym-banner h1')).toBeVisible();await expect(page.locator('body')).not.toHaveAttribute('data-game-arena','expanded');await expect(page.locator('[inert]')).toHaveCount(0);expect(await page.locator('body').evaluate(el=>getComputedStyle(el).position)).not.toBe('fixed');expect(errors).toEqual([]);
    expect(await protectedProgress(page)).toEqual(progress);expect(await visitedGyms(page)).toEqual(visits);expect(firebase).toEqual([]);
  });
});
