import {test,expect,login,ready,tab,confirm} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import {revokeFixtureTeacher} from '../../../server/academic/bootstrap';
test('invitado: ruta directa pide la sesión existente sin pedir contraseña dentro del panel',async({page,fixture})=>{
  const calls:string[]=[];page.on('request',r=>{if(r.url().includes(':5200'))calls.push(r.url());});
  await page.goto('#/docente');await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);expect(calls.length).toBe(0);
});
test('alumno: sin scopes docentes ni datos privados',async({page,fixture})=>{
  await login(page,fixture,'studentA');await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();
  await expect(page.getByLabel('Grupo',{exact:true})).toHaveCount(0);await expect(page.getByText('Synthetic studentB',{exact:true})).toHaveCount(0);
});
for(const actor of ['teacherA','teacherB','teacherBoth'] as const)test(`${actor}: solo descubre grupos autorizados y capacidades verificadas`,async({page,fixture})=>{
  await login(page,fixture,actor);await ready(page);
  const options=await page.getByLabel('Grupo',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>(n as HTMLOptionElement).value).sort());
  expect(options).toEqual(actor==='teacherBoth'?[fixture.f.groups.a,fixture.f.groups.b].sort():[fixture.f.groups[actor==='teacherA'?'a':'b']]);
  await tab(page,'Periodos y grupos');
  if(actor==='teacherB'){await expect(page.getByText('No tienes capacidad para crear periodos en este curso.')).toBeVisible();await expect(page.getByRole('button',{name:'Crear periodo',exact:true})).toHaveCount(0);}
});
test('roster y solicitudes: nombres elegidos y resúmenes limitados a la página',async({page,fixture})=>{
  await login(page,fixture);await ready(page);
  await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();await expect(page.getByText('Nombre elegido · identidad académica no verificada')).not.toBeVisible();
  await page.locator('.teacher-student-row summary').first().click();await expect(page.getByText('Nombre elegido · identidad académica no verificada')).toBeVisible();
  await expect(page.getByText('Cifras de las páginas consultadas, no totales globales.',{exact:false})).toBeVisible();
  await tab(page,'Solicitudes');await expect(page.getByText('Synthetic studentB',{exact:true})).toBeVisible();await expect(page.getByText('Synthetic studentC',{exact:true})).toBeVisible();
});
test('crear enlace: sin claves técnicas, doble clic no duplica y copia explícita',async({page,fixture})=>{
  let copied='';await page.exposeFunction('qaCopyLink',(value:string)=>{copied=value;});
  await login(page,fixture);await ready(page);await tab(page,'Invitaciones');
  await page.getByRole('button',{name:'Crear enlace de invitación',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(fixture.commands.filter(c=>c==='rotateEnrollmentLink').length).toBe(1);
  await expect(page.getByLabel('Token de invitación',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Admisiones máximas')).toHaveCount(0);await expect(page.getByLabel('Pendientes máximos')).toHaveCount(0);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{await (window as any).qaCopyLink(value);}}}));
  await page.getByRole('button',{name:'Copiar enlace',exact:true}).click();await expect.poll(()=>!!copied).toBe(true);
  const url=new URL(copied),secret=new URLSearchParams(url.hash.split('?')[1]).get('token')!;expect(secret.length===43).toBe(true);expect(url.search==='').toBe(true);
  expect(await page.evaluate(token=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]).includes(token),secret)).toBe(false);
  expect(page.url().includes(secret)).toBe(false);
  await tab(page,'Alumnos');await tab(page,'Invitaciones');await expect(page.getByRole('button',{name:'Copiar enlace',exact:true})).toHaveCount(0);
  await page.reload();await ready(page);await tab(page,'Invitaciones');await expect(page.getByRole('button',{name:'Copiar enlace',exact:true})).toHaveCount(0);
});
test('reemitir y revocar invitaciones con revisión actual',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await tab(page,'Invitaciones');
  await page.getByRole('button',{name:'Crear enlace de invitación',exact:true}).click();await confirm(page);
  await page.getByRole('button',{name:'Generar nuevo enlace',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('El enlace anterior dejará de funcionar');await confirm(page);
  await page.getByRole('button',{name:'Revocar enlace',exact:true}).click();await confirm(page);
  await expect.poll(async()=>(await fixture.call('teacherA','groupEnrollmentLink',fixture.scope())).body.link.status).toBe('revoked');
});
test('aprobar solicitud y refrescar roster solo tras confirmación',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await tab(page,'Solicitudes');
  const row=page.locator('.teacher-record').filter({has:page.getByText('Synthetic studentB',{exact:true})});
  await row.getByRole('button',{name:'Aprobar',exact:true}).click();
  expect((await fixture.call('teacherA','roster',fixture.scope())).body.items.length).toBe(1);
  await confirm(page);await tab(page,'Alumnos');await expect(page.getByText('Synthetic studentB',{exact:true})).toBeVisible();
});
test('rechazar solicitud requiere confirmación y muestra el estado actualizado',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await tab(page,'Solicitudes');
  await page.locator('.teacher-record').filter({has:page.getByText('Synthetic studentC',{exact:true})}).getByRole('button',{name:'Rechazar',exact:true}).click();await confirm(page);
  await page.getByLabel('Estado de las solicitudes').selectOption('rejected');await expect(page.getByText('Synthetic studentC',{exact:true})).toBeVisible();await expect(page.getByText('Rechazada',{exact:true})).toBeVisible();
});
test('dar de baja usa la revisión del roster y conserva Auth',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await page.getByRole('button',{name:'Dar de baja',exact:true}).click();await confirm(page);
  await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();
  const roster=(await fixture.call('teacherA','roster',fixture.scope())).body.items[0];expect(roster.status).toBe('revoked');expect(roster.revision).toBe(2);
  expect((await fixture.sdk.auth.getUser(fixture.f.actors.studentA.uid)).disabled).toBe(false);
});
test('transferir solo entre ámbitos autorizados y actualizar ambas listas',async({page,fixture})=>{
  await login(page,fixture,'teacherBoth');await ready(page);await page.getByLabel('Grupo',{exact:true}).selectOption(fixture.f.groups.a);
  await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();await page.getByLabel('Destino de transferencia').selectOption(fixture.f.groups.b);
  await page.getByRole('button',{name:'Transferir',exact:true}).click();await confirm(page);await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();
  await page.getByLabel('Grupo',{exact:true}).selectOption(fixture.f.groups.b);await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();await expect(page.getByText('Activo',{exact:true})).toBeVisible();
});
test('staff revocado: el backend real rechaza sin éxito optimista ni fuga de datos al actualizar',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await revokeFixtureTeacher(fixture.sdk,fixture.f,fixture.f.actors.teacherA.uid);
  await page.getByRole('button',{name:'Dar de baja',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('No tienes permiso');await page.getByRole('button',{name:'Cerrar y actualizar'}).click();
  await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();
  expect((await fixture.call('teacherBoth','roster',fixture.scope())).body.items[0].status).toBe('active');
});
test('409 real: versión obsoleta no sobrescribe y obliga a actualizar',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();
  const m=(await fixture.call('teacherA','roster',fixture.scope())).body.items[0];
  await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid:m.uid,expectedVersion:m.revision,idempotencyKey:crypto.randomUUID()});
  await page.getByRole('button',{name:'Dar de baja',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('La información cambió');await expect(page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Cerrar y actualizar'}).click();await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();
  expect((await fixture.call('teacherA','roster',fixture.scope())).body.items[0].revision).toBe(2);
});
test('respuesta perdida: reintento con misma intención no duplica ni recupera el secreto',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await tab(page,'Invitaciones');fixture.fault.lost='rotateEnrollmentLink';
  await page.getByRole('button',{name:'Crear enlace de invitación',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('No pudimos confirmar');await page.getByRole('button',{name:'Reintentar misma operación'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('el enlace no se puede recuperar',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Copiar enlace',exact:true})).toHaveCount(0);
  expect((await fixture.call('teacherA','groupEnrollmentLink',fixture.scope())).body.link.revision).toBe(1);
});
test('429 muestra espera y permite reintentar sin éxito anticipado',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await tab(page,'Invitaciones');fixture.fault.rate='rotateEnrollmentLink';
  await page.getByRole('button',{name:'Crear enlace de invitación',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Espera un minuto');await page.getByRole('button',{name:'Reintentar misma operación'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('API apagada: error recuperable sin listas privadas anteriores',async({page,fixture})=>{
  await login(page,fixture);await ready(page);fixture.fault.offline=true;await page.getByRole('button',{name:'Actualizar grupos y datos'}).click();
  await expect(page.getByRole('alert')).toContainText('API local');await expect(page.getByText('Synthetic studentA',{exact:true})).toHaveCount(0);
  fixture.fault.offline=false;await page.getByRole('button',{name:'Actualizar grupos y datos'}).click();await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();
});
test('API anterior sin contrato visual muestra actualización requerida, no rompe la aplicación',async({page,fixture})=>{
  fixture.fault.legacy=true;await login(page,fixture);await expect(page.getByRole('alert')).toContainText('contrato incompatible');
  await expect(page.getByLabel('Grupo',{exact:true})).toHaveCount(0);fixture.fault.legacy=false;
  await page.getByRole('button',{name:'Actualizar acceso',exact:true}).click();await ready(page);
});
test('logout y A→B descartan respuesta tardía, errores y secretos de A',async({page,fixture})=>{
  fixture.fault.hold='roster';await login(page,fixture);await ready(page);await fixture.fault.waiting;
  await page.getByRole('button',{name:'Cerrar sesión docente'}).click();await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();
  await login(page,fixture,'teacherB');await ready(page);fixture.fault.release();
  await expect(page.getByLabel('Grupo',{exact:true})).toHaveValue(fixture.f.groups.b);
  await expect(page.getByText('Synthetic studentA',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Token de invitación',{exact:true})).toHaveCount(0);
});
test('crear periodo y grupo autorizado con descubrimiento del periodo vacío tras recarga',async({page,fixture})=>{
  await login(page,fixture);await ready(page);await tab(page,'Periodos y grupos');await page.getByLabel('Nombre del periodo',{exact:true}).fill('Periodo de prueba visual');
  await page.getByRole('button',{name:'Crear periodo',exact:true}).click();await confirm(page);await page.reload();await ready(page);await tab(page,'Periodos y grupos');
  await expect(page.getByLabel('Periodo del nuevo grupo').locator('option').filter({hasText:'Periodo de prueba visual'})).toHaveCount(1);
  await page.getByLabel('Periodo del nuevo grupo').selectOption({label:(await page.getByLabel('Periodo del nuevo grupo').locator('option').filter({hasText:'Periodo de prueba visual'}).textContent())!});
  await page.getByLabel('Nombre del grupo',{exact:true}).fill('Grupo de prueba visual');await page.getByRole('button',{name:'Crear grupo',exact:true}).click();await confirm(page);
  const discovery=(await fixture.call('teacherA','myScopes',{kind:'teacher'})).body.items;expect(discovery.some((s:any)=>s.title==='Grupo de prueba visual')).toBe(true);
  await page.getByLabel('Periodo',{exact:true}).selectOption(discovery.find((s:any)=>s.title==='Grupo de prueba visual').termId);await expect(page.getByLabel('Grupo',{exact:true}).locator('option').filter({hasText:'Grupo de prueba visual'})).toHaveCount(1);
});
test('paginación real de roster sin totales globales inventados',async({page,fixture})=>{
  // Additional synthetic members are prepared only at the fixture/operator boundary.
  const root=`courses/${fixture.f.courseId}/terms/${fixture.f.termId}/groups/${fixture.f.groups.a}`;
  const batch=fixture.sdk.db.batch();
  for(let i=0;i<22;i++){
    const uid=`synthetic-page-${i}`;batch.set(fixture.sdk.db.doc(`${root}/members/${uid}`),{schemaVersion:1,...fixture.scope(),uid,status:'active'});
    batch.set(fixture.sdk.db.doc(`${root}/roster/${uid}`),{schemaVersion:2,...fixture.scope(),uid,label:`Alumno sintético ${i}`,labelSource:'self-chosen',status:'active'});
    batch.set(fixture.sdk.db.doc(`${root}/membershipDetails/${uid}`),{schemaVersion:2,...fixture.scope(),uid,revision:1,lastAdmissionId:null,lastInvitationId:null,lastRevokedAt:null,updatedAt:fixture.sdk.timestamp(Date.now())});
  }
  await batch.commit();await login(page,fixture);await ready(page);await expect(page.locator('.teacher-record')).toHaveCount(20);
  await page.getByRole('navigation',{name:'Paginación de la sección'}).getByRole('button',{name:'Siguiente'}).click();await expect(page.locator('.teacher-record')).toHaveCount(3);await expect(page.getByText('Página 2 · hasta 20 registros')).toBeVisible();
});
test('logout desde otra pestaña descarta código privado y sesión anterior',async({page,fixture,context})=>{
  await login(page,fixture);await ready(page);await tab(page,'Invitaciones');
  await page.getByRole('button',{name:'Crear enlace de invitación',exact:true}).click();await confirm(page);await expect(page.getByRole('button',{name:'Copiar enlace',exact:true})).toBeVisible();
  const peer=await context.newPage();await peer.goto('#/cuenta');await peer.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();await expect(page.getByRole('button',{name:'Copiar enlace',exact:true})).toHaveCount(0);
  await login(page,fixture,'teacherB');await ready(page);await expect(page.getByLabel('Grupo',{exact:true})).toHaveValue(fixture.f.groups.b);await expect(page.getByText('Synthetic studentA',{exact:true})).toHaveCount(0);
});
for(const width of [390,820,1180,1440])test(`responsive ${width}, teclado y accesibilidad`,async({page,fixture,browserName})=>{
  await page.setViewportSize({width,height:900});await login(page,fixture);await ready(page);await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('Grupo',{exact:true}).focus();await expect(page.getByLabel('Grupo',{exact:true})).toBeFocused();
  const result=await new AxeBuilder({page}).include('.teacher-panel').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
  if(width===1440&&browserName==='chromium'&&process.env.TEACHER_CAPTURE==='1'){
    for(const [name,file] of [['Alumnos','alumnos'],['Solicitudes','solicitudes'],['Invitaciones','invitaciones'],['Periodos y grupos','periodos']] as const){
      await tab(page,name);await expect(page.getByText('Consultando el archivo del grupo…')).toHaveCount(0);
      if(name==='Periodos y grupos')await expect(page.locator('.teacher-section li').first()).toBeVisible();
      await page.evaluate(()=>{document.querySelectorAll('.teacher-identifier').forEach(n=>n.textContent='[identificador sintético oculto]');
        document.querySelectorAll('.teacher-panel option').forEach(n=>{n.textContent=n.textContent!.split(' · ')[0];});});
      await page.locator('.teacher-panel').screenshot({path:`docs/qa/teacher-panel/${file}.png`});
    }
    await tab(page,'Alumnos');await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{document.querySelectorAll('.teacher-identifier').forEach(n=>n.textContent='[identificador sintético oculto]');document.querySelectorAll('.teacher-panel option').forEach(n=>n.textContent=n.textContent!.split(' · ')[0]);});
    await page.locator('.teacher-panel').screenshot({path:'docs/qa/teacher-panel/movil.png',style:'.site-header nav{visibility:hidden}'});
  }
});
