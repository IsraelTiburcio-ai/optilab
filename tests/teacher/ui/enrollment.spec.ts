import {test,expect,password,type Fixture} from './fixtures';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base='http://127.0.0.1:5195/optilab/';
const uniqueTag=()=>`Piv_${crypto.randomUUID().replaceAll('-','').slice(0,12)}`;
async function invite(f:Fixture,extra:Record<string,unknown>={}){
  const meta=(await f.call('teacherBoth','groupEnrollmentLink',f.scope('b'))).body;
  const r=await f.call('teacherBoth','rotateEnrollmentLink',{...f.scope('b'),expectedVersion:meta.link?.revision??0,idempotencyKey:crypto.randomUUID(),expiresInSeconds:3600,...extra});
  expect(r.status).toBe(200);return {...f.scope('b'),inviteId:r.body.inviteId as string,token:r.body.token as string};
}
async function open(page:Page,input:Awaited<ReturnType<typeof invite>>){
  await page.goto(base+'#/unirse');await page.evaluate(fragment=>{location.hash=fragment;},'#/unirse?'+new URLSearchParams(input).toString());
  await expect.poll(()=>page.url().includes('token=')).toBe(false);
}
async function account(page:Page,f:Fixture,actor:keyof Fixture['f']['actors']='studentB',old=false){
  await page.goto('#/cuenta');await page.getByLabel('Correo electrónico',{exact:true}).fill(f.f.actors[actor].email);await page.locator('#account-password').fill(password);
  await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();
  if(old)await expect(page.getByRole('heading',{name:'¡Bienvenido a OptiLab!'})).toBeVisible();else await expect(page.getByRole('heading',{name:'¿Cómo te llamas?'})).toBeVisible();
}
async function wizard(page:Page,tag=uniqueTag(),share=false,choose=true){
  await page.getByLabel('Nombre completo académico',{exact:true}).fill('Alumno de Prueba');await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByLabel('Gamertag',{exact:true}).fill(tag);await expect(page.getByText('Disponible. Se reservará al confirmar.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  if(choose)await page.getByRole('radio',{name:'Mika',exact:true}).check();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  if(choose)await page.getByRole('radio',{name:'Piv',exact:true}).check();if(share)await page.getByLabel('Compartir mi gamertag y mi equipo con mis docentes autorizados.').check();
  await page.getByRole('button',{name:'Confirmar mi aventura'}).click();await expect(page.getByRole('heading',{name:'¡Bienvenido a OptiLab!'})).toBeVisible();return tag;
}
async function preparePlayer(f:Fixture,actor:keyof Fixture['f']['actors']='studentB',tag=uniqueTag()){
  const p=(await f.call(actor,'getAcademicProfile',{})).body,player=(await f.call(actor,'getPlayerIdentity',{})).body;
  const r=await f.call(actor,'savePlayerIdentity',{expectedVersion:player.identity?.revision??0,expectedProfileVersion:p.revision,idempotencyKey:crypto.randomUUID(),
    fullName:'Alumno Existente',gamertag:tag,avatarId:'avatar-02',companionId:'piv',shareGameIdentity:false});expect(r.status).toBe(200);return tag;
}
test('jugador: invitación anónima conserva memoria durante login, sin secretos HTTP o almacenamiento',async({page,fixture})=>{
  const inv=await invite(fixture),requests:string[]=[],logs:string[]=[];page.on('request',r=>requests.push(r.url()));page.on('console',m=>logs.push(m.text()));
  await open(page,inv);await expect(page.getByRole('link',{name:'Entrar o crear mi cuenta'})).toBeVisible();expect(page.url().includes(inv.token)).toBe(false);
  expect(requests.some(v=>v.includes(inv.token))).toBe(false);expect(logs.some(v=>v.includes(inv.token))).toBe(false);
  await account(page,fixture);await wizard(page);await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
  expect(await page.evaluate(token=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes(token),inv.token)).toBe(false);
});
test('jugador: registro por correo personaliza antes de verificar, pero solo se inscribe tras verificación real',async({page,fixture})=>{
  const inv=await invite(fixture),email=`welcome-${crypto.randomUUID()}@example.test`;await open(page,inv);await page.getByRole('link',{name:'Entrar o crear mi cuenta'}).click();
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.locator('#account-password').fill(password);await page.getByLabel('Repite tu contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Crear mi cuenta',exact:true}).click();await expect(page.getByRole('heading',{name:'¿Cómo te llamas?'})).toBeVisible();await wizard(page);
  await expect(page.getByRole('alert')).toContainText('Verifica tu correo');await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toHaveCount(0);
  let code:string|undefined;await expect.poll(async()=>{const r=await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-optilab-sync/oobCodes');const data=await r.json();code=data.oobCodes.find((x:any)=>x.email===email&&x.requestType==='VERIFY_EMAIL')?.oobCode;return !!code;}).toBe(true);
  const verified=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-emulator-only-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code})});expect(verified.status).toBe(200);
  await page.getByRole('button',{name:'Ya verifiqué mi correo · reintentar inscripción'}).click();await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
});
test('jugador: registro Google emulado entra a bienvenida sin segundo sistema de cuentas',async({page,fixture})=>{
  await page.goto(base+'#/cuenta');const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Continuar con Google'}).click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');
  const add=popup.getByRole('button',{name:/Add new account/i});if(await add.isVisible())await add.click();await popup.getByRole('button',{name:'Auto-generate user information',exact:false}).click();
  await popup.getByLabel('Email',{exact:false}).fill(`google-${crypto.randomUUID()}@example.test`);await popup.getByRole('button',{name:/Sign in with Google/i}).click();
  await expect(page.getByRole('heading',{name:'¿Cómo te llamas?'})).toBeVisible();await wizard(page);await page.getByRole('link',{name:'Comenzar aventura',exact:true}).click();await expect(page.getByRole('heading',{name:'Mi aventura',exact:true})).toBeVisible();
});
test('jugador: usuario existente canjea automáticamente sin repetir bienvenida ni crear solicitud',async({page,fixture})=>{
  await preparePlayer(fixture);const inv=await invite(fixture);await open(page,inv);await account(page,fixture,'studentB',true);
  await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
  expect((await fixture.call('teacherBoth','groupRequests',fixture.scope('b'))).body.items.length).toBe(0);
  expect((await fixture.call('studentB','myScopes',{kind:'student'})).body.items.some((s:any)=>s.groupId===fixture.f.groups.b&&s.status==='active')).toBe(true);
});
for(const state of ['expired','revoked'] as const)test(`jugador: enlace ${state} no crea matrícula`,async({page,fixture})=>{
  await preparePlayer(fixture);const inv=await invite(fixture,{expiresInSeconds:state==='expired'?1:3600});
  if(state==='expired')await new Promise(r=>setTimeout(r,1100));else await fixture.call('teacherBoth','revokeEnrollmentLink',{...fixture.scope('b'),expectedVersion:1,idempotencyKey:crypto.randomUUID()});
  await open(page,inv);await account(page,fixture,'studentB',true);await expect(page.getByRole('alert')).toContainText('Este enlace de invitación ya no está disponible. Pide uno nuevo a tu profesora');
  expect((await fixture.call('studentB','myScopes',{kind:'student'})).body.items.length).toBe(0);
});
test('jugador: el mismo enlace inscribe a distintos alumnos, sin cupos ni aprobaciones',async({page,fixture,browser})=>{
  await preparePlayer(fixture,'studentB');await preparePlayer(fixture,'studentC');const inv=await invite(fixture);
  await open(page,inv);await account(page,fixture,'studentB',true);await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
  const peer=await browser.newContext({baseURL:base});await fixture.attach(peer);
  try{const other=await peer.newPage();await open(other,inv);await account(other,fixture,'studentC',true);await expect(other.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();}finally{await peer.close();}
  expect((await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items.length).toBe(2);
});
test('jugador: enlace abierto dos veces conserva una matrícula y no reingresa después de baja',async({page,fixture})=>{
  await preparePlayer(fixture);const inv=await invite(fixture);await open(page,inv);await account(page,fixture,'studentB',true);await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
  await open(page,inv);await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
  const m=(await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items[0];await fixture.call('teacherBoth','revokeMembership',{...fixture.scope('b'),uid:m.uid,expectedVersion:m.revision,idempotencyKey:crypto.randomUUID()});
  await open(page,inv);await expect(page.getByRole('alert')).toContainText('Este enlace de invitación ya no está disponible. Pide uno nuevo a tu profesora');expect((await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items[0].status).toBe('revoked');
});
test('jugador: gamertag ocupado y variantes de mayúsculas no pasan disponibilidad',async({page,fixture})=>{
  const tag=await preparePlayer(fixture,'studentA');await page.goto(base+'#/cuenta');await account(page,fixture);await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.getByLabel('Gamertag',{exact:true}).fill(tag.toUpperCase());await expect(page.getByText('Ese gamertag ya está ocupado. Elige otro.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled();
});
test('jugador: cambiar gamertag libera anterior y conserva equipo y progreso',async({page,fixture})=>{
  await page.goto(base+'#/cuenta');await account(page,fixture);const beforeTag=await wizard(page);await page.getByRole('link',{name:'Comenzar aventura',exact:true}).click();
  await expect(page.locator('#nickname')).toHaveValue(beforeTag);await expect(page.locator('#nickname')).toHaveAttribute('readonly','');await page.getByRole('link',{name:'Cambiar gamertag y equipo',exact:true}).click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();const next=uniqueTag();await page.getByLabel('Gamertag',{exact:true}).fill(next);await expect(page.getByText('Disponible. Se reservará al confirmar.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Mika',exact:true})).toBeChecked();await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByRole('radio',{name:'Piv',exact:true})).toBeChecked();await page.getByRole('button',{name:'Confirmar mi aventura'}).click();
  await expect.poll(async()=>(await fixture.call('studentB','getPlayerIdentity',{})).body.identity.gamertag===next).toBe(true);
  expect((await fixture.call('studentC','gamertagAvailability',{gamertag:beforeTag})).body.available).toBe(true);
});
test('jugador: elecciones previas de entrenador y criatura se conservan al migrar al onboarding',async({page,fixture})=>{
  const uid=fixture.f.actors.studentA.uid;
  for(const [field,value] of [['avatarId','avatar-06'],['companionId','dua']])await fixture.sdk.db.doc(`users/${uid}/epochs/1/fields/${field}`).set({schemaVersion:2,uid,epoch:1,revision:1,operationId:crypto.randomUUID(),value});
  await page.goto(base+'#/cuenta');await account(page,fixture,'studentA');await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByLabel('Gamertag',{exact:true}).fill(uniqueTag());await expect(page.getByText('Disponible. Se reservará al confirmar.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Nova',exact:true})).toBeChecked();await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByRole('radio',{name:'Dua',exact:true})).toBeChecked();
});
test('jugador: no ve Docente ni botón administrativo; profesor solo con ámbitos autorizados',async({page,fixture})=>{
  await page.goto(base+'#/cuenta');await account(page,fixture);
  await expect(page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Docente',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Abrir panel de la profesora'})).toHaveCount(0);
  await page.goto('#/docente');await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();
});
test('jugador: salida durante canje invalida respuesta y acceso cacheado de la sesión anterior',async({page,fixture})=>{
  await preparePlayer(fixture);const inv=await invite(fixture);fixture.fault.hold='redeemInvitation';await open(page,inv);await account(page,fixture,'studentB',true);await fixture.fault.waiting;
  await page.getByRole('button',{name:'Cerrar sesión de jugador'}).click();fixture.fault.release();await expect(page.getByRole('link',{name:'Entrar o crear mi cuenta'})).toBeVisible();
  await account(page,fixture,'studentC');await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toHaveCount(0);
});
test('jugador: oculta su identidad de juego sin liberar gamertag ni perder matrícula',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);const tag=await wizard(page,uniqueTag(),true);
  await expect(page.getByText('¡Ya estás dentro de tu grupo! Matrícula activa confirmada.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Ocultar mi identidad de juego a la profesora'}).click();
  await expect.poll(async()=>(await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items[0].academicProfile.gameIdentity===null).toBe(true);
  expect((await fixture.call('studentC','gamertagAvailability',{gamertag:tag})).body.available).toBe(false);
});
for(const width of [390,820,1180,1440])test(`jugador: responsive ${width}, personajes reales, teclado y accesibilidad`,async({page,fixture})=>{
  await page.setViewportSize({width,height:900});await page.goto(base+'#/cuenta');await account(page,fixture);await page.getByLabel('Nombre completo académico').focus();await expect(page.getByLabel('Nombre completo académico')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const result=await new AxeBuilder({page}).include('.onboarding').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
  await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByLabel('Gamertag',{exact:true}).fill(uniqueTag());await expect(page.getByText('Disponible. Se reservará al confirmar.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Continuar',exact:true}).click();await expect(page.getByRole('radio')).toHaveCount(6);
});
