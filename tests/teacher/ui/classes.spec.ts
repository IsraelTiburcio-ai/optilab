import {test,expect,password,login,ready,tab,type Fixture} from './fixtures';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base='http://127.0.0.1:5195/optilab/';
async function names(f:Fixture){
  await f.sdk.db.doc(`courses/${f.f.courseId}`).update({title:'Optimización de prueba'});
  await f.sdk.db.doc(`courses/${f.f.courseId}/terms/${f.f.termId}`).update({title:'Semestre de prueba'});
  for(const [key,id] of Object.entries(f.f.groups))await f.sdk.db.doc(`courses/${f.f.courseId}/terms/${f.f.termId}/groups/${id}`).update({title:`Clase ${key.toUpperCase()}`});
}
async function player(f:Fixture,actor='studentB'){
  const p=(await f.call(actor,'getAcademicProfile',{})).body;
  const r=await f.call(actor,'savePlayerIdentity',{idempotencyKey:crypto.randomUUID(),expectedVersion:0,expectedProfileVersion:p.revision,fullName:`Alumno de clases ${actor==='studentA'?'A':'B'}`,
    gamertag:'C_'+crypto.randomUUID().replaceAll('-','').slice(0,16),avatarId:'avatar-02',companionId:'piv',shareGameIdentity:false});expect(r.status).toBe(200);
}
async function enter(page:Page,f:Fixture,actor:'studentA'|'studentB'='studentB'){
  await page.goto(base+'#/cuenta');await page.getByLabel('Correo electrónico',{exact:true}).fill(f.f.actors[actor].email);await page.locator('#account-password').fill(password);
  await page.getByRole('button',{name:'Entrar a mi cuenta',exact:true}).click();await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Volver a mi aventura',exact:true}).click();await expect(page.getByRole('heading',{name:'Mis clases',exact:true})).toBeVisible();
}
async function enroll(f:Fixture,actor:string,group:'a'|'b'){
  const meta=(await f.call('teacherBoth','groupEnrollmentLink',f.scope(group))).body;
  const link=(await f.call('teacherBoth','rotateEnrollmentLink',{...f.scope(group),expectedVersion:meta.link?.revision??0,idempotencyKey:crypto.randomUUID(),expiresInSeconds:3600})).body;
  const result=await f.call(actor,'redeemInvitation',{...f.scope(group),inviteId:link.inviteId,token:link.token,idempotencyKey:crypto.randomUUID()});expect(result.status).toBe(200);
}
test('mis clases: alumno recién inscrito descubre curso, periodo y grupo sin enlace ni IDs',async({page,fixture})=>{
  await names(fixture);await player(fixture);await enroll(fixture,'studentB','b');await enter(page,fixture);
  const section=page.locator('.academic-classes');await expect(section.getByText('Optimización de prueba',{exact:true})).toBeVisible();await expect(section.getByRole('heading',{name:'Clase B',exact:true})).toBeVisible();
  await expect(section.getByText('Periodo: Semestre de prueba',{exact:true})).toBeVisible();await expect(section.getByText('Inscrito',{exact:true})).toBeVisible();
  const text=await section.innerText();expect([fixture.f.courseId,fixture.f.termId,fixture.f.groups.b,fixture.f.actors.studentB.uid].some(id=>text.includes(id))).toBe(false);
  if(process.env.CLASS_CAPTURE==='1')await section.screenshot({path:'docs/qa/final-polish/mis-clases.png'});
});
test('mis clases: cuenta antigua sin matrícula muestra vacío y no ve clases ajenas',async({page,fixture})=>{
  await names(fixture);await player(fixture);await enter(page,fixture);
  await expect(page.getByText('Todavía no perteneces a un grupo de clase',{exact:true})).toBeVisible();await expect(page.locator('.academic-class-list li')).toHaveCount(0);
  await expect(page.locator('.academic-classes').getByText('Clase A',{exact:true})).toHaveCount(0);
});
test('mis clases: varias inscripciones confirmadas se muestran como inscritas',async({page,fixture})=>{
  await names(fixture);await player(fixture,'studentA');await enroll(fixture,'studentA','b');await enter(page,fixture,'studentA');
  await expect(page.locator('.academic-class-list li')).toHaveCount(2);await expect(page.locator('.academic-classes').getByText('Inscrito',{exact:true})).toHaveCount(2);
});
test('mis clases: baja y transferencia actualizan estado sin tocar progreso',async({page,fixture})=>{
  await names(fixture);await player(fixture,'studentA');await enter(page,fixture,'studentA');await expect(page.locator('.academic-classes').getByText('Inscrito',{exact:true})).toBeVisible();
  const m=(await fixture.call('teacherBoth','roster',fixture.scope())).body.items[0];
  const moved=await fixture.call('teacherBoth','transferMembership',{...fixture.scope(),uid:m.uid,destinationGroupId:fixture.f.groups.b,expectedVersion:m.revision,idempotencyKey:crypto.randomUUID()});expect(moved.status).toBe(200);
  await page.getByRole('button',{name:'Actualizar mis clases'}).click();await expect(page.locator('.academic-class-list li').filter({has:page.getByRole('heading',{name:'Clase B',exact:true})})).toContainText('Inscrito');
  await expect(page.locator('.academic-class-list li').filter({has:page.getByRole('heading',{name:'Clase A',exact:true})})).toContainText('Inactivo');
  const destination=(await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items[0];
  expect((await fixture.call('teacherBoth','revokeMembership',{...fixture.scope('b'),uid:destination.uid,expectedVersion:destination.revision,idempotencyKey:crypto.randomUUID()})).status).toBe(200);
  await page.getByRole('button',{name:'Actualizar mis clases'}).click();await expect(page.locator('.academic-classes').getByText('Inscrito',{exact:true})).toHaveCount(0);
});
test('mis clases: logout y cambio de cuenta eliminan listas y callbacks tardíos',async({page,fixture,context})=>{
  await names(fixture);await player(fixture,'studentA');await player(fixture);await enter(page,fixture,'studentA');await expect(page.getByRole('heading',{name:'Clase A',exact:true})).toBeVisible();
  fixture.fault.hold='myScopes';await page.getByRole('button',{name:'Actualizar mis clases'}).click();await fixture.fault.waiting;
  const peer=await context.newPage();await peer.goto(base+'#/cuenta');await peer.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Mis clases',exact:true})).toHaveCount(0);await enter(page,fixture);fixture.fault.release();
  await expect(page.getByText('Todavía no perteneces a un grupo de clase',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Clase A',exact:true})).toHaveCount(0);
});
test('mis clases: paginación real de inscripciones propias',async({page,fixture})=>{
  await names(fixture);await player(fixture,'studentA');const uid=fixture.f.actors.studentA.uid,batch=fixture.sdk.db.batch();
  const {scopeKey}=await import('../../../server/academic/repository');
  for(let i=0;i<21;i++){const scope={...fixture.scope(),groupId:`clase-extra-${i}`},root=`courses/${scope.courseId}/terms/${scope.termId}/groups/${scope.groupId}`;
    batch.set(fixture.sdk.db.doc(root),{schemaVersion:1,...scope,title:`Clase adicional ${i}`,status:'active'});batch.set(fixture.sdk.db.doc(`${root}/members/${uid}`),{schemaVersion:1,...scope,uid,status:'active'});
    batch.set(fixture.sdk.db.doc(`users/${uid}/enrollments/${scopeKey(scope)}`),{schemaVersion:2,...scope,uid,status:'active'});
  }await batch.commit();await enter(page,fixture,'studentA');await expect(page.locator('.academic-class-list li')).toHaveCount(20);
  const nav=page.locator('.academic-classes').getByRole('navigation',{name:'Paginación de la sección'});await nav.getByRole('button',{name:'Siguiente'}).click();await expect(page.locator('.academic-class-list li')).toHaveCount(2);await nav.getByRole('button',{name:'Anterior'}).click();await expect(page.locator('.academic-class-list li')).toHaveCount(20);
});
test('historial: no es tarea principal y un inscrito automático no aparece para aprobación',async({page,fixture})=>{
  await player(fixture);await enroll(fixture,'studentB','a');let historyCalls=0;page.on('request',r=>{if(r.url().endsWith('/groupRequests'))historyCalls++;});
  await login(page,fixture,'teacherA');await ready(page);
  await expect(page.getByRole('navigation',{name:'Secciones del panel'}).getByRole('button',{name:/Solicitud/})).toHaveCount(0);expect(historyCalls).toBe(0);
  const history=page.locator('.teacher-history');await expect(history).not.toHaveAttribute('open','');await history.locator('summary').click();await expect(history).toContainText('Las nuevas matrículas son automáticas');
  const row=history.locator('.teacher-record').filter({has:page.getByText('Alumno de clases B',{exact:true})});await expect(row).toContainText('Ya inscrito');await expect(row.getByRole('button',{name:'Aprobar',exact:true})).toHaveCount(0);
  const records=(await fixture.call('teacherA','groupRequests',{...fixture.scope(),status:'pending'})).body.items;expect(records.some((r:any)=>r.uid===fixture.f.actors.studentB.uid&&r.status==='pending')).toBe(true);
});
for(const count of [2,5,10])test(`roster compacto: ${count} alumnos, detalles discretos y acciones alineadas`,async({page,fixture})=>{
  await page.setViewportSize({width:1440,height:1000});const batch=fixture.sdk.db.batch(),s=fixture.scope(),root=`courses/${s.courseId}/terms/${s.termId}/groups/${s.groupId}`;
  for(let i=1;i<count;i++){const uid=`roster_${s.courseId.slice(-12)}_${i}`;batch.set(fixture.sdk.db.doc(`${root}/members/${uid}`),{schemaVersion:1,...s,uid,status:'active'});
    batch.set(fixture.sdk.db.doc(`${root}/roster/${uid}`),{schemaVersion:2,...s,uid,label:`Alumno compacto ${i}`,labelSource:'self-chosen',status:'active'});
    batch.set(fixture.sdk.db.doc(`${root}/membershipDetails/${uid}`),{schemaVersion:2,...s,uid,revision:1,lastAdmissionId:null,lastInvitationId:null,lastRevokedAt:null,updatedAt:fixture.sdk.timestamp(Date.now())});
    batch.set(fixture.sdk.db.doc(`courses/${s.courseId}/members/${uid}`),{schemaVersion:1,courseId:s.courseId,uid,status:'active'});
    batch.set(fixture.sdk.db.doc(`academicProfiles/${uid}`),{schemaVersion:2,uid,revision:1,fullName:`Alumno compacto ${i}`,email:`compacto-${i}@example.test`,emailVerified:true,shareGameIdentity:i%2===0,
      nickname:i%2===0?`Jugador${i}`:null,avatarId:i%2===0?'avatar-02':null,companionId:i%2===0?'piv':null,updatedAt:fixture.sdk.timestamp(Date.now())});
  }await batch.commit();await login(page,fixture);await ready(page);const rows=page.locator('.teacher-student-row');await expect(rows).toHaveCount(count);
  expect((await rows.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height))).every(h=>h<180)).toBe(true);
  expect((await rows.allInnerTexts()).every(t=>!t.includes('Correo de Auth')&&!t.includes('Identidad actualizada')&&!t.includes('ID:'))).toBe(true);
  if(process.env.CLASS_CAPTURE==='1'&&count===10)await page.locator('.teacher-student-list').screenshot({path:'docs/qa/final-polish/roster-10-desktop.png',style:'.site-header,.skip-link{visibility:hidden}'});
  await expect(rows.first().getByRole('button',{name:'Dar de baja',exact:true})).toBeVisible();await rows.first().locator('summary').click();await expect(rows.first().locator('.teacher-identifier')).toBeVisible();
  await rows.first().locator('summary').click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(process.env.CLASS_CAPTURE==='1'&&count===10)await rows.first().screenshot({path:'docs/qa/final-polish/roster-movil.png',style:'.site-header nav{visibility:hidden}'});
  const audit=await new AxeBuilder({page}).include('.teacher-student-list').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>v.id)).toEqual([]);
});
