import {test, expect, type Page, type FrameLocator} from '@playwright/test';

test.skip(process.env.VERIFY_PUBLIC !== '1', 'Opt-in: verifica sitios publicados, sin interceptar sus recursos.');
const host = 'https://israeltiburcio-ai.github.io/optilab/';
const game = 'https://israeltiburcio-ai.github.io/memorama-simplex/';

async function pairs(surface: Page | FrameLocator) {
  return surface.locator('#board').evaluate(board => {
    const bank = (window as any).MEMORAMA_DATA.pairs;
    const clean = (html: string) => {const el=document.createElement('div');el.innerHTML=html;return el.textContent!.replace(/\s+/g,' ').trim();};
    const grouped: Record<string, number[]> = {};
    board.querySelectorAll('.card-text').forEach((el,i)=>{
      const text=clean(el.innerHTML);
      const pair=bank.find((p:any)=>clean(p.a)===text||clean(p.b)===text);
      if(!pair)throw new Error('Carta fuera del banco');
      (grouped[pair.id] ||= []).push(i);
    });
    return Object.values(grouped);
  });
}

for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]]) {
  test(`producción real ${width}×${height}: integrado e independiente`,async({page,context})=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(host+'#/gimnasio/3');
    expect(response!.status()).toBe(200);
    await page.locator('.cartridge').filter({hasText:'Memorama Simplex'}).locator('.play').click();
    await expect(page.locator('.player-status')).toContainText('Conectado',{timeout:20000});
    expect(context.pages()).toHaveLength(1);
    const frame=page.frameLocator('.player-frame-shell iframe');
    await frame.locator('#btn-play').click();
    const solution=await pairs(frame);
    // Make one genuine mismatch, then solve the unchanged academic bank.
    await frame.locator('.card').nth(solution[0][0]).click();
    await frame.locator('.card').nth(solution[1][0]).click();
    await expect(frame.locator('.card.is-miss')).toHaveCount(0);
    for(const pair of solution){await frame.locator('.card').nth(pair[0]).click();await frame.locator('.card').nth(pair[1]).click();}
    await expect(frame.locator('#end')).toBeVisible();
    await expect(page.locator('.game-result-panel')).toContainText('89%');
    const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('optilab-v1')!));
    expect(progress.gameResults).toHaveLength(1);
    expect(progress.gameResults[0]).toMatchObject({accuracy:89,attempts:9,errors:1,matchedPairs:8,completed:true});
    expect(progress.practiced).toEqual({});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await frame.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/public-${width}-completed.png`,fullPage:true});
    await page.getByRole('link',{name:'Regresar a Fortaleza Simplex',exact:true}).click();
    await expect(page.locator('.completion-label')).toContainText('89%');
    await page.reload();
    await expect(page.locator('.completion-label')).toContainText('89%');
    await page.goto(host+'#/aventura');
    await expect(page.locator('.game-result-panel')).toContainText('89%');
    await page.goto(game);
    await expect(page.locator('html')).not.toHaveClass('optilab-embedded');
    await page.locator('#btn-play').click();
    for(const pair of await pairs(page)){await page.locator('.card').nth(pair[0]).click();await page.locator('.card').nth(pair[1]).click();}
    await expect(page.locator('#end')).toBeVisible();
    await expect(page.locator('#end-accuracy')).toHaveText('100%');
    await expect(page.locator('#end-attempts')).toHaveText('8');
    await page.screenshot({path:`test-results/public-${width}-standalone.png`,fullPage:true});
    expect(errors).toEqual([]);
  });
}
