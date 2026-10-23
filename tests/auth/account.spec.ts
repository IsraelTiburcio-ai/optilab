import {test, expect, type Page, type APIRequestContext} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const emulator='http://127.0.0.1:9099';
const project='demo-optilab-auth';
const email='entrenador-qa@example.test';
const password='Solo-Pruebas-42!';
const baseline={nickname:'Equipo preservado',avatarId:'avatar-06',companionId:'piv',practiced:{'memorama-simplex':'2026-10-20T12:00:00Z'},visited:[3],route:['memorama-simplex'],results:[{date:'2026-10-20T12:00:00Z',answers:[1,0,2,1,0],score:5}],gameResults:[]};
async function account(page:Page){
  await page.addInitScript(p=>{try{if(!localStorage.getItem('optilab-v1'))localStorage.setItem('optilab-v1',JSON.stringify(p))}catch{/* restricted-storage scenario has no seed */}},baseline);
  await page.goto('#/cuenta');await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();
}
async function register(page:Page){
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
  await page.getByLabel('Correo electrónico',{exact:true}).fill(email);
  await page.getByLabel('Contraseña',{exact:false}).first().fill(password);
  await page.getByLabel('Repite tu contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Crear mi cuenta'}).click();
  await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cerrar sesión'})).toBeEnabled();
}
async function codes(request:APIRequestContext){const result=await request.get(`${emulator}/emulator/v1/projects/${project}/oobCodes`);expect(result.ok()).toBe(true);return (await result.json()).oobCodes as {email:string;requestType:string;oobCode:string}[];}
test.beforeEach(async({request})=>{const response=await request.delete(`${emulator}/emulator/v1/projects/${project}/accounts`);expect(response.ok()).toBe(true)});

test('SDK: registro, verificación, sesión persistente, logout y recuperación; progreso intacto',async({page,request})=>{
  const firestore:string[]=[];page.on('request',r=>{if(r.url().includes('firestore.googleapis.com'))firestore.push(r.url())});
  await account(page);const before=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  await register(page);await expect(page.getByText('Verificación pendiente',{exact:false})).toBeVisible();
  await expect.poll(async()=> (await codes(request)).some(c=>c.email===email&&c.requestType==='VERIFY_EMAIL')).toBe(true);
  const verification=(await codes(request)).find(c=>c.email===email&&c.requestType==='VERIFY_EMAIL')!;
  const verified=await request.post(`${emulator}/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-emulator-only-key`,{data:{oobCode:verification.oobCode}});expect(verified.ok()).toBe(true);
  await page.getByRole('button',{name:'Ya verifiqué mi correo'}).click();await expect(page.getByText('Correo verificado',{exact:false})).toBeVisible();
  await page.reload();await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);
  await page.getByRole('button',{name:'Cerrar sesión'}).click();await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();
  await page.getByRole('button',{name:'Recuperar',exact:true}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByRole('button',{name:'Enviar enlace de recuperación'}).click();
  await expect(page.getByText('Si este correo tiene una cuenta',{exact:false})).toBeVisible();
  await expect.poll(async()=> (await codes(request)).some(c=>c.email===email&&c.requestType==='PASSWORD_RESET')).toBe(true);
  const recovery=(await codes(request)).filter(c=>c.email===email&&c.requestType==='PASSWORD_RESET').at(-1)!;
  const reset=await request.post(`${emulator}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=demo-emulator-only-key`,{data:{oobCode:recovery.oobCode,newPassword:password+'Nuevo'}});expect(reset.ok()).toBe(true);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password+'Nuevo');await page.getByRole('button',{name:'Entrar a mi cuenta'}).click();
  await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);expect(firestore).toEqual([]);
});

test('errores de credenciales y confirmación en español; contraseña no se refleja ni persiste manualmente',async({page})=>{
  await account(page);await page.getByLabel('Correo electrónico',{exact:true}).fill('ausente@example.test');await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar a mi cuenta'}).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos iniciar sesión');await expect(page.getByLabel('Contraseña',{exact:true})).toHaveValue('');
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();await page.getByLabel('Contraseña',{exact:false}).first().fill(password);await page.getByLabel('Repite tu contraseña',{exact:true}).fill('Diferente-42!');await page.getByRole('button',{name:'Crear mi cuenta'}).click();
  await expect(page.getByRole('alert')).toContainText('Las contraseñas no coinciden');expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).not.toContain(password);
});

test('popup bloqueado deja alternativa de invitado sin redirigir ni borrar progreso',async({page})=>{
  await page.addInitScript(()=>{window.open=()=>null});await account(page);const before=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  await page.getByRole('button',{name:'Continuar con Google'}).click();await expect(page.getByRole('alert')).toContainText('El navegador bloqueó la ventana');
  await page.getByRole('link',{name:'Continuar como invitado'}).click();await expect(page.locator('.map-node')).toHaveCount(5);expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);
});

test('Google OAuth simulado por Auth Emulator conserva sesión y aventura local',async({page})=>{
  await account(page);const before=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Continuar con Google'}).click();
  const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
  const add=popup.getByRole('button',{name:/Add new account/i});if(await add.isVisible())await add.click();
  await popup.getByRole('button',{name:'Auto-generate user information',exact:false}).click();
  await popup.getByLabel('Email',{exact:false}).fill('google-qa@example.test',{timeout:5000});
  await popup.getByRole('button',{name:/Sign in with Google/i}).click();
  await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  await expect(page.locator('.account-email')).toHaveText('google-qa@example.test');
  await page.reload();await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar sesión'}).click();
  await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);
});

test('error de red y almacenamiento restringido mantienen el modo invitado',async({page})=>{
  await account(page);const before=await page.evaluate(()=>localStorage.getItem('optilab-v1'));
  await page.route('http://127.0.0.1:9099/identitytoolkit.googleapis.com/**',route=>route.abort());
  await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar a mi cuenta'}).click();
  await expect(page.getByRole('alert')).toContainText('Revisa tu conexión');
  expect(await page.evaluate(()=>localStorage.getItem('optilab-v1'))).toBe(before);
  await page.unroute('http://127.0.0.1:9099/identitytoolkit.googleapis.com/**');
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}}));
  await page.reload();
  await expect(page.getByText('Este acceso es temporal',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'Continuar como invitado'}).click();await expect(page.locator('.map-node')).toHaveCount(5);
});

for(const [width,height]of [[390,844],[820,1180],[1180,820],[1440,900]])test(`cuenta ${width}×${height}: formularios legibles y accesibles`,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});await account(page);
  for(const [label,view]of [['Entrar','login'],['Crear cuenta','register'],['Recuperar','reset']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.screenshot({path:`auth-qa-results/screenshots/auth-${width}-${view}.png`,fullPage:true});
    if(process.env.UPDATE_AUTH_SCREENSHOTS==='1' && view==='login')await page.screenshot({path:`docs/screenshots/auth/auth-${width}-login.png`,fullPage:true});
  }
});
