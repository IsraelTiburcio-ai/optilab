import {test,expect} from '@playwright/test';

test('custom root assets and HashRouter load at the owner origin; game paths and sandbox remain fixed',async({page,context})=>{
  const failed:string[]=[];page.on('requestfailed',r=>failed.push(r.url()));
  await context.route('https://optilab.club/**',async route=>{
    const url=new URL(route.request().url()),response=await page.request.get(`http://127.0.0.1:5198${url.pathname}${url.search}`);
    await route.fulfill({response});
  });
  const response=await page.goto('https://optilab.club/');expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('OptiLab · Tu aventura comienza aquí');
  expect(await page.evaluate(async()=>({cname:(await(await fetch('/CNAME')).text()).trim(),sync:!!document.querySelector('.sync-panel')}))).toEqual({cname:'optilab.club',sync:false});
  await page.goto('https://optilab.club/#/optidex');await expect(page.locator('.cartridge')).toHaveCount(28);
  const models=page.locator('.cartridge').filter({hasText:'Model Match'});await models.getByRole('button',{name:'Detalles',exact:true}).click();
  await models.getByRole('link',{name:'Abrir juego independiente'}).waitFor();
  await page.goto('https://optilab.club/#/jugar-original/system-lab');
  const frame=page.locator('.original-player iframe');await expect(frame).toHaveAttribute('sandbox','allow-scripts');
  const source=new URL((await frame.getAttribute('src'))!);expect(source.origin).toBe('https://israeltiburcio-ai.github.io');expect(source.searchParams.get('optilabOrigin')).toBe('https://optilab.club');
  expect(new URL(page.url()).origin).toBe('https://optilab.club');expect(new URL(page.url()).pathname).toBe('/');
  expect(failed.filter(url=>url.startsWith('https://optilab.club/'))).toEqual([]);
});
