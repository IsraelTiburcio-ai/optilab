import {test, expect} from '@playwright/test';
import {avatars} from '../src/data/avatars';
import {badges} from '../src/data/badges';

test('inspección visual y disponibilidad de los 15 assets originales', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width: 1200, height: 1100});
  const assets = [...avatars, ...badges];
  await page.setContent(`<html lang="es"><head><title>Assets OptiLab</title><style>body{background:#dce4d2;font-family:system-ui;padding:20px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}figure{margin:0;padding:12px;text-align:center;background:#eae6d6;border:1px solid #65785c;border-radius:12px}img{width:100%;height:245px;object-fit:contain}figcaption{color:#243b40;font-weight:700}</style></head><body><h1>Inspección de originales Cloudinary</h1><main>${assets.map(a=>`<figure><img src="${a.image}" alt="${a.id}"><figcaption>${a.id} · ${a.name}</figcaption></figure>`).join('')}</main></body></html>`);
  for (const image of await page.locator('img').all()) await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  console.log(await page.locator('img').evaluateAll(images=>images.map(el=>({id:el.alt,width:el.naturalWidth,height:el.naturalHeight}))));
  await page.screenshot({path:'test-results/cloudinary-originals.png', fullPage:true});
});
