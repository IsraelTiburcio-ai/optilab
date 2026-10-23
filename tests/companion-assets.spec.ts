import {test,expect} from '@playwright/test';
import {companions} from '../src/data/companions';

test('quince ilustraciones oficiales disponibles y visibles sin recortes',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1400,height:1000});
  await page.setContent(`<html lang="es"><head><title>OptiCriaturas originales</title><style>body{background:#e1e7d6;font-family:system-ui;color:#243b40}main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:20px}figure{margin:0;text-align:center;border:1px solid #b5c4a5;border-radius:12px;padding:10px}img{width:100%;height:210px;object-fit:contain}figcaption{font-weight:700}</style></head><body><h1>Familias y formas originales de OptiLab</h1><main>${[1,2,3].flatMap(stage=>companions.map(c=>{const f=c.evolutions.find(f=>f.stage===stage)!;return `<figure><img src="${f.image}" alt="${f.name}"><figcaption>${f.name} · Etapa ${stage}</figcaption></figure>`})).join('')}</main></body></html>`);
  for(const img of await page.locator('img').all())await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0),{timeout:20000}).toBe(true);
  console.log(await page.locator('img').evaluateAll(images=>images.map(i=>({name:i.alt,width:i.naturalWidth,height:i.naturalHeight}))));
  await page.screenshot({path:'test-results/companions-originals.png',fullPage:true});
});
