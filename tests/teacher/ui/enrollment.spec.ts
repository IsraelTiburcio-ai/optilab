import {test,expect,password,login,ready,tab,confirm,type Fixture} from './fixtures';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base='http://127.0.0.1:5195/optilab/';
async function invite(f:Fixture,group:'a'|'b'='b',extra:Record<string,unknown>={}){
  const response=await f.call('teacherBoth','createInvitation',{...f.scope(group),idempotencyKey:crypto.randomUUID(),expiresInSeconds:3600,maxUses:20,maxPending:20,...extra});
  expect(response.status).toBe(200);return {...f.scope(group),inviteId:response.body.inviteId as string,token:response.body.token as string};
}
function link(input:Awaited<ReturnType<typeof invite>>){return base+'#/unirse?'+new URLSearchParams(input).toString();}
async function open(page:Page,input:Awaited<ReturnType<typeof invite>>){
  await page.goto(base+'#/unirse');await page.evaluate(fragment=>{location.hash=fragment;},new URL(link(input)).hash);
  await expect.poll(()=>page.url().includes('token=')).toBe(false);
}
async function account(page:Page,f:Fixture,actor:keyof Fixture['f']['actors']='studentB'){
  await page.goto('#/cuenta');await page.getByLabel('Correo electrónico',{exact:true}).fill(f.f.actors[actor].email);await page.locator('#account-password').fill(password);
  await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Mi perfil académico e inscripción'}).click();await expect(page.getByRole('heading',{name:'Mi perfil académico',exact:true})).toBeVisible();
}
async function profile(page:Page,name='Alumna de inscripción',share=false){
  await page.getByLabel('Nombre completo declarado',{exact:true}).fill(name);
  if(share)await page.getByLabel('Quiero compartir mi gamertag, entrenador y OptiCriatura con mis docentes autorizados.').check();
  await page.getByLabel('Entiendo que mi nombre declarado y correo de Auth serán visibles únicamente a docentes autorizados de los ámbitos indicados.').check();
  await page.getByRole('button',{name:'Guardar perfil académico',exact:true}).click();await confirm(page);
  await expect(page.getByText('Correo del último perfil:',{exact:false})).toBeVisible();
}
async function submit(page:Page){await page.getByRole('button',{name:'Solicitar inscripción',exact:true}).click();await confirm(page);await expect(page.getByText('Solicitud enviada. Esperando aprobación de tu profesora.',{exact:true})).toBeVisible();}
test('inscripción: enlace inicial anónimo se consume antes de mostrar la pantalla y nunca sale por HTTP',async({page,fixture})=>{
  const inv=await invite(fixture),seen:string[]=[],logs:string[]=[];page.on('request',r=>seen.push(r.url()));page.on('console',m=>logs.push(m.text()));
  await page.addInitScript(fragment=>history.replaceState(history.state,'',fragment),new URL(link(inv)).hash);
  await page.goto(base);await expect(page.getByRole('heading',{name:'Inscripción académica',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Iniciar sesión o registrarme'})).toBeVisible();
  expect(page.url().includes(inv.token)).toBe(false);expect(seen.some(url=>url.includes(inv.token))).toBe(false);expect(logs.some(line=>line.includes(inv.token))).toBe(false);
  expect(await page.evaluate(secret=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes(secret),inv.token)).toBe(false);
  expect((await page.locator('body').innerText()).includes(inv.token)).toBe(false);
});
test('inscripción: fragmento malformado se limpia y no provoca consultas académicas anónimas',async({page,fixture})=>{
  const inv=await invite(fixture);inv.courseId='../users';let calls=0;page.on('request',r=>{if(r.url().includes(':5200'))calls++;});
  await open(page,inv);await expect(page.getByText('El enlace de invitación no tiene un formato válido.',{exact:false})).toBeVisible();expect(calls).toBe(0);
  expect(page.url().includes('token=')).toBe(false);
});
test('inscripción: login conserva invitación, perfil mínimo, aprobación docente visual y myScopes activo',async({page,fixture,browser})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);await submit(page);
  await expect(page.getByText('No hay grupos en esta página.',{exact:true})).toBeVisible();
  const teacherContext=await browser.newContext({baseURL:base});await fixture.attach(teacherContext);
  try{const teacher=await teacherContext.newPage();await login(teacher,fixture,'teacherBoth');await ready(teacher);await teacher.getByLabel('Grupo',{exact:true}).selectOption(fixture.f.groups.b);await tab(teacher,'Solicitudes');
    const row=teacher.locator('.teacher-record').filter({has:teacher.getByText('Alumna de inscripción',{exact:true})});await expect(row).toBeVisible();
    await expect(row.getByText('Correo de Auth:',{exact:false})).toBeVisible();await row.getByRole('button',{name:'Aprobar',exact:true}).click();await confirm(teacher);
    await page.getByRole('button',{name:'Actualizar perfil y estado'}).click();await expect(page.getByText('Inscripción activa confirmada por el API.',{exact:true})).toBeVisible();
    await expect(page.locator('section[aria-labelledby="academic-my-groups"] li')).toContainText('Activo');
  }finally{await teacherContext.close();}
});
test('inscripción: registro nuevo, verificación de correo existente y perfil con correo autenticado',async({page,fixture})=>{
  const inv=await invite(fixture),email=`enrollment-${crypto.randomUUID()}@example.test`;await open(page,inv);await page.getByRole('link',{name:'Iniciar sesión o registrarme'}).click();
  await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();await page.getByLabel('Correo electrónico',{exact:true}).fill(email);await page.locator('#account-password').fill(password);await page.getByLabel('Repite tu contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Crear mi cuenta',exact:true}).click();await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  let code:string|undefined;
  await expect.poll(async()=>{const response=await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-optilab-sync/oobCodes');const data=await response.json();code=data.oobCodes.find((r:any)=>r.email===email&&r.requestType==='VERIFY_EMAIL')?.oobCode;return !!code;}).toBe(true);
  const verified=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-emulator-only-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code})});expect(verified.status).toBe(200);
  await page.getByRole('button',{name:'Ya verifiqué mi correo'}).click();await expect(page.getByText('Correo verificado',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'Mi perfil académico e inscripción'}).click();await profile(page,'Registro Sintético');await expect(page.getByText('Correo del último perfil:',{exact:false})).toContainText('verificado al guardar');await submit(page);
});
test('inscripción: rechazada no se presenta como matrícula activa',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);await submit(page);
  const state=(await fixture.call('studentB','requestStatus',{...fixture.scope('b'),inviteId:inv.inviteId})).body;
  await fixture.call('teacherBoth','rejectMembership',{...fixture.scope('b'),requestId:state.requestId,expectedVersion:state.revision,idempotencyKey:crypto.randomUUID()});
  await page.getByRole('button',{name:'Actualizar perfil y estado'}).click();await expect(page.getByText('Solicitud rechazada. No se concedió membresía.',{exact:true})).toBeVisible();await expect(page.getByText('No hay grupos en esta página.',{exact:true})).toBeVisible();
});
for(const condition of ['expired','revoked','exhausted','forged'] as const)test(`inscripción: invitación ${condition} no concede acceso y no revela secretos`,async({page,fixture})=>{
  const inv=await invite(fixture,'b',{expiresInSeconds:condition==='expired'?1:3600,maxUses:condition==='exhausted'?1:20});
  if(condition==='expired')await new Promise(r=>setTimeout(r,1100));
  if(condition==='revoked')await fixture.call('teacherBoth','revokeInvitation',{...fixture.scope('b'),inviteId:inv.inviteId,expectedVersion:1,idempotencyKey:crypto.randomUUID()});
  if(condition==='exhausted'){const req=(await fixture.call('studentC','requestMembership',{...inv,idempotencyKey:crypto.randomUUID()})).body;await fixture.call('teacherBoth','approveMembership',{...fixture.scope('b'),requestId:req.requestId,expectedVersion:1,idempotencyKey:crypto.randomUUID()});}
  if(condition==='forged')inv.token='A'.repeat(43);
  await open(page,inv);await account(page,fixture);await profile(page);await page.getByRole('button',{name:'Solicitar inscripción',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Invitación no disponible');
  expect((await fixture.call('studentB','myScopes',{kind:'student'})).body.items.length).toBe(0);
  expect((await page.locator('body').innerText()).includes(inv.token)).toBe(false);
});
test('inscripción: estado privado distingue invitación revocada y vencida después de solicitar',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);await submit(page);
  const meta=(await fixture.call('teacherBoth','groupInvitations',fixture.scope('b'))).body.items.find((r:any)=>r.inviteId===inv.inviteId);
  await fixture.call('teacherBoth','revokeInvitation',{...fixture.scope('b'),inviteId:inv.inviteId,expectedVersion:meta.revision,idempotencyKey:crypto.randomUUID()});
  await page.getByRole('button',{name:'Actualizar perfil y estado'}).click();await expect(page.getByText('La invitación fue revocada.',{exact:false})).toBeVisible();
  const short=await invite(fixture,'b',{expiresInSeconds:1});const requested=(await fixture.call('studentB','requestMembership',{...short,idempotencyKey:crypto.randomUUID()}));expect(requested.status).toBe(200);
  await new Promise(r=>setTimeout(r,1100));await open(page,short);await expect(page.getByText('La invitación venció.',{exact:false})).toBeVisible();
});
test('inscripción: abrir dos veces y dos solicitudes simultáneas no duplican pendientes',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);
  const pair=await Promise.all([1,2].map(()=>fixture.call('studentB','requestMembership',{...inv,idempotencyKey:crypto.randomUUID()})));expect(pair.every(r=>r.status===200)).toBe(true);expect(pair[0].body.requestId===pair[1].body.requestId).toBe(true);
  await open(page,inv);await expect(page.getByText('Solicitud enviada. Esperando aprobación de tu profesora.',{exact:true})).toBeVisible();await open(page,inv);await expect(page.getByText('Solicitud enviada. Esperando aprobación de tu profesora.',{exact:true})).toBeVisible();
  const meta=(await fixture.call('teacherBoth','groupInvitations',fixture.scope('b'))).body.items.find((r:any)=>r.inviteId===inv.inviteId);expect(meta.pendingCount).toBe(1);
});
test('inscripción: ACK perdido conserva intención y reintento HTTP no duplica',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);fixture.fault.lost='requestMembership';
  await page.getByRole('button',{name:'Solicitar inscripción',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('No pudimos confirmar');await page.getByRole('button',{name:'Reintentar misma operación'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Solicitud enviada. Esperando aprobación de tu profesora.',{exact:true})).toBeVisible();
  const meta=(await fixture.call('teacherBoth','groupInvitations',fixture.scope('b'))).body.items.find((r:any)=>r.inviteId===inv.inviteId);expect(meta.pendingCount).toBe(1);
});
test('inscripción: recarga pierde memoria y reabrir original recupera solicitud privada sin crear otra',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);await submit(page);await page.reload();
  await expect(page.getByText('No hay una invitación en memoria.',{exact:false})).toBeVisible();await open(page,inv);await expect(page.getByText('Solicitud enviada. Esperando aprobación de tu profesora.',{exact:true})).toBeVisible();
});
test('inscripción: cambio de cuenta durante solicitud descarta respuesta y secreto anteriores',async({page,fixture})=>{
  const inv=await invite(fixture);await open(page,inv);await account(page,fixture);await profile(page);fixture.fault.hold='requestMembership';
  await page.getByRole('button',{name:'Solicitar inscripción',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();await fixture.fault.waiting;
  await page.getByRole('dialog').getByRole('button',{name:'Cerrar sesión de estudiante'}).click();await expect(page.getByRole('link',{name:'Iniciar sesión o registrarme'})).toBeVisible();
  await account(page,fixture,'studentC');fixture.fault.release();await expect(page.getByLabel('Nombre completo declarado',{exact:true})).toHaveValue('');
  await expect(page.getByRole('heading',{name:'Tu invitación',exact:true})).toHaveCount(0);await expect(page.getByText('Solicitud enviada. Esperando aprobación de tu profesora.',{exact:true})).toHaveCount(0);
});
test('inscripción: consentimiento optativo, perfil incompleto y retirada visible en próxima consulta docente',async({page,fixture})=>{
  const inv=await invite(fixture,'a');await open(page,inv);await account(page,fixture,'studentA');
  await expect(page.getByRole('button',{name:'Guardar perfil académico',exact:true})).toBeDisabled();await profile(page,'Nombre Declarado',true);
  const shared=(await fixture.call('studentA','getAcademicProfile',{})).body.profile;expect(shared.shareGameIdentity).toBe(true);
  await page.getByRole('button',{name:'Retirar identidad de juego'}).click();await confirm(page);
  await expect.poll(async()=>{const data=(await fixture.call('teacherA','roster',fixture.scope())).body.items[0];return data.academicProfile?.gameIdentity===null;}).toBe(true);
  expect((await fixture.call('teacherB','roster',fixture.scope())).status).toBe(403);
});
test('inscripción: docente copia enlace HashRouter correcto con duración en horas/días',async({page,fixture})=>{
  let copied='';await page.exposeFunction('qaInvitationCopy',(text:string)=>{copied=text;});
  await login(page,fixture,'teacherBoth');await ready(page);await tab(page,'Invitaciones');
  await page.getByLabel('Unidad de duración').selectOption('3600');await page.getByLabel('Duración de la invitación').fill('12');
  await page.getByRole('button',{name:'Generar invitación',exact:true}).click();await confirm(page);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{await (window as any).qaInvitationCopy(text);}}}));
  await page.getByRole('button',{name:'Copiar enlace de invitación'}).click();await expect.poll(()=>!!copied).toBe(true);
  const url=new URL(copied);expect(url.pathname).toBe('/optilab/');expect(url.search==='').toBe(true);expect(url.hash.startsWith('#/unirse?')).toBe(true);
  expect(new URLSearchParams(url.hash.split('?')[1]).get('token')?.length===43).toBe(true);
});
for(const width of [390,820,1180,1440])test(`inscripción: responsive ${width}, teclado y accesibilidad`,async({page,fixture})=>{
  await page.setViewportSize({width,height:900});await open(page,await invite(fixture));await account(page,fixture);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('Nombre completo declarado',{exact:true}).focus();await expect(page.getByLabel('Nombre completo declarado',{exact:true})).toBeFocused();
  const result=await new AxeBuilder({page}).include('.academic-enrollment').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
});
