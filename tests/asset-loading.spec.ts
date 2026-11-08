import {test,expect} from '@playwright/test';

const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');

test('las imágenes críticas son eager, prioritarias y usan tamaños Cloudinary',async({page})=>{
 const requests:string[]=[];
 await page.route('https://res.cloudinary.com/**',async route=>{requests.push(route.request().url());await route.fulfill({status:200,contentType:'image/png',body:pixel});});
 await page.goto('#/');
 const hero=page.locator('.hero-world-ensemble img');await expect(hero).toHaveCount(3);
 for(const image of await hero.all()){
  await expect(image).toHaveAttribute('loading','eager');await expect(image).toHaveAttribute('srcset',/w_160/);
  expect(await image.evaluate((node:HTMLImageElement)=>node.fetchPriority)).toBe('high');
  expect(await image.evaluate((node:HTMLImageElement)=>node.currentSrc)).toMatch(/\/w_\d+,c_limit,q_auto:good,f_auto\//);
 }
 await expect.poll(()=>requests.length).toBeGreaterThan(0);
 expect(requests.every(url=>/\/w_\d+,c_limit,q_auto:good,f_auto\//.test(url))).toBe(true);

 await page.goto('#/mapa');
 const nodes=page.locator('.node-island > .companion-portrait img');await expect(nodes).toHaveCount(5);
 await expect(nodes.nth(0)).toHaveAttribute('loading','eager');await expect(nodes.nth(1)).toHaveAttribute('loading','eager');await expect(nodes.nth(4)).toHaveAttribute('loading','lazy');
 for(const image of await nodes.all())await expect(image).toHaveAttribute('srcset',/w_160/);
 expect(await page.locator('.map-panel > .companion-portrait img').first().evaluate((node:HTMLImageElement)=>node.fetchPriority)).toBe('high');
});
