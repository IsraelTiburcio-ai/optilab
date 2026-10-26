import {test,expect} from '@playwright/test';
test('production build stays guest/local with zero Firebase requests even when all emulator flags were supplied',async({page,context})=>{
  const firebase:string[]=[],chunks:string[]=[];
  await context.route('**/*',async route=>{
    const url=route.request().url();
    if(/firestore|identitytoolkit|securetoken|:8085|:9099|:5200/.test(url)){firebase.push(new URL(url).hostname);await route.abort();}
    else {if(/(?:CloudProgress|SyncPanel|TeacherPanel|EnrollmentPage|MyClasses|teacher)-.*\.js/.test(url))chunks.push(url);await route.continue();}
  });
  await page.goto('#/cuenta',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Tu cuenta OptiLab',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeDisabled();
  await expect(page.locator('.sync-panel')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('optilab-v1')!==null)).toBe(true);
  const before=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  await page.getByRole('link',{name:'Continuar como invitado'}).click();await expect(page.locator('.map-node')).toHaveCount(5);
  await page.goto('#/optidex',{waitUntil:'domcontentloaded'});await expect(page.locator('.cartridge')).toHaveCount(28);
  await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.cartridge')).toHaveCount(28);
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);
  await page.goto('#/docente',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Te saliste del sendero'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Docente',exact:true})).toHaveCount(0);
  await page.goto('#/unirse?courseId=demo&termId=demo&groupId=demo&inviteId=demo&token='+('A'.repeat(43)),{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Te saliste del sendero'})).toBeVisible();
  expect(page.url().includes('token=')).toBe(false);
  await page.goto('#/bienvenida',{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Te saliste del sendero'})).toBeVisible();
  expect(firebase).toEqual([]);expect(chunks).toEqual([]);
});
