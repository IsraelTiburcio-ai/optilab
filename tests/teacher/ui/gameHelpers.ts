import {expect,type Page,type BrowserContext} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
export async function serveMemorama(context:BrowserContext) {
  const root=process.env.MEMORAMA_DIR;
  if(!root)throw Error('MEMORAMA_DIR required for the real student flow');
  await context.route('https://israeltiburcio-ai.github.io/memorama-simplex/**',async route=>{
    const url=new URL(route.request().url());let rel=decodeURIComponent(url.pathname.replace('/memorama-simplex/',''));
    if(!rel||rel.endsWith('/'))rel+='index.html';
    const file=path.resolve(root,rel),base=path.resolve(root);
    if(!(file===base||file.startsWith(base+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.continue();
    await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream'});
  });
}
export async function playMemorama(page:Page,route='#/jugar/memorama-simplex') {
  await page.goto(route);
  await expect(page.locator('.player-status')).toContainText('Conectado',{timeout:20000});
  const frame=page.frameLocator('.player-frame-shell iframe');await frame.locator('#btn-play').click();
  const pairs=await frame.locator('#board').evaluate(board=>{
    const text=(html:string)=>{const el=document.createElement('div');el.innerHTML=html;return el.textContent!.replace(/\s+/g,' ').trim();};
    const groups:Record<string,number[]>={};board.querySelectorAll('.card-text').forEach((el,i)=>{const content=el.textContent!.replace(/\s+/g,' ').trim(),pair=(window as any).MEMORAMA_DATA.pairs.find((p:any)=>text(p.a)===content||text(p.b)===content);if(!pair)throw Error('Unknown pair');(groups[pair.id]??=[]).push(i);});return Object.values(groups);
  });
  expect(pairs).toHaveLength(8);for(const pair of pairs){await frame.locator('.card').nth(pair[0]).click();await frame.locator('.card').nth(pair[1]).click();}
  await expect(page.getByRole('heading',{name:'Memorama Simplex completado',exact:true})).toBeVisible({timeout:20000});
  await expect(page.locator('.sync-indicator')).toContainText('Sincronizado',{timeout:20000});
}
