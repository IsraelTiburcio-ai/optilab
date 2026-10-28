import {test,expect} from '@playwright/test';
test.skip(process.env.VERIFY_EXTERNAL_PROVIDERS!=='1','Opt-in de red real: VERIFY_EXTERNAL_PROVIDERS=1. Los fixtures no prueban compatibilidad real.');
for(const [id,provider] of [['learningapps-formulas-simplex','learningapps'],['wordwall-metodo-m-grande','wordwall']] as const)for(const [width,height] of [[390,844],[820,1180],[1180,820],[1440,900]])test(`REAL ${provider} ${width}×${height}: recurso visible con sandbox mínimo`,async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width,height});await page.goto(`#/actividad/${id}`,{waitUntil:'domcontentloaded'});
  const child=page.frameLocator('.external-frame-shell iframe');
  if(provider==='learningapps'){await expect(child.locator('.card')).toHaveCount(14,{timeout:45000});await expect(child.getByRole('button',{name:'OK',exact:true})).toBeVisible();}
  else{await expect(child.locator('canvas')).toBeVisible({timeout:45000});await expect(child.locator('.js-play-preload')).toBeHidden({timeout:45000});}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const element=await page.locator('.external-frame-shell iframe').elementHandle();await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();expect(await element!.evaluate(n=>n.isConnected)).toBe(true);await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
});
test('REAL LearningApps: arrastre automático real produce señal observada, no calificación',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Render WebKit verificado; automatización de arrastre/finalización WebKit no confirmada, pendiente.');test.setTimeout(90000);
  await page.setViewportSize({width:1180,height:820});await page.goto('#/actividad/learningapps-formulas-simplex');const child=page.frameLocator('.external-frame-shell iframe');await expect(child.locator('.card')).toHaveCount(14,{timeout:45000});await page.getByRole('button',{name:'Pantalla grande',exact:true}).click();await child.getByRole('button',{name:'OK',exact:true}).click();
  const pairs=await child.locator('body').evaluate(()=>{const w=window as any;return w.Pair1List.map((a:any,i:number)=>[Array.from(document.querySelectorAll('.card')).indexOf(a.card.htmlElement[0]),Array.from(document.querySelectorAll('.card')).indexOf(w.Pair2List[i].card.htmlElement[0])]) as number[][];});
  // Layout only: prevent randomized overlap. No setSolved, synthetic postMessage,
  // answer mutation or fake completion. Pointer moves trigger provider code.
  await child.locator('.card').evaluateAll(nodes=>nodes.forEach((n,i)=>{(n as HTMLElement).style.left=(10+(i%5)*210)+'px';(n as HTMLElement).style.top=(10+Math.floor(i/5)*210)+'px';}));
  const iframe=await page.locator('.external-frame-shell iframe').boundingBox();
  for(const [a,b] of pairs){const source=await child.locator('.card').nth(a).boundingBox(),target=await child.locator('.card').nth(b).boundingBox();if(!source||!target||!iframe)throw new Error('Proveedor sin geometría accesible');await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:15});await page.mouse.up();await page.waitForTimeout(300);}
  await page.getByRole('button',{name:'Salir de pantalla grande',exact:true}).click();
  await expect(page.getByText('Finalización observada:',{exact:false})).toBeVisible();await expect(page.locator('.external-play-state')).toHaveAttribute('data-observation-count','2');
});
