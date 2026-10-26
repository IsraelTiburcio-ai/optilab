import {test,expect,login,ready,manage,tab,confirm,type Fixture} from './fixtures';
import type {Page} from '@playwright/test';
import {scopeKey} from '../../../server/academic/repository';
import AxeBuilder from '@axe-core/playwright';
async function friendly(f:Fixture){
  await f.sdk.db.doc(`courses/${f.f.courseId}`).update({title:'Optimización de prueba'});await f.sdk.db.doc(`courses/${f.f.courseId}/terms/${f.f.termId}`).update({title:'Semestre de prueba'});
  for(const [name,id] of Object.entries(f.f.groups))await f.sdk.db.doc(`courses/${f.f.courseId}/terms/${f.f.termId}/groups/${id}`).update({title:`Grupo ${name.toUpperCase()}`});
}
async function openMove(page:Page){await page.getByRole('button',{name:'Mover de grupo',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();}
test('dashboard: Mis grupos se organiza por curso/periodo sin IDs ni contadores inventados',async({page,fixture})=>{
  await friendly(fixture);await login(page,fixture,'teacherBoth');const directory=page.locator('.teacher-directory');await expect(directory.getByRole('heading',{name:'Mis grupos',exact:true})).toBeVisible();
  await expect(directory.getByRole('heading',{name:'Optimización de prueba',exact:true})).toBeVisible();await expect(directory.getByRole('heading',{name:'Semestre de prueba',exact:true})).toBeVisible();await expect(directory.locator('.teacher-group-card')).toHaveCount(2);
  const text=await directory.innerText();expect([fixture.f.courseId,fixture.f.termId,fixture.f.groups.a,fixture.f.groups.b,fixture.f.actors.teacherBoth.uid].some(id=>text.includes(id))).toBe(false);
  const button=directory.getByRole('button',{name:'Administrar grupo Grupo A'});await button.focus();await page.keyboard.press('Enter');await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← Mis grupos',exact:true}).click();
  if(process.env.DASHBOARD_CAPTURE==='1')await directory.screenshot({path:'docs/qa/teacher-dashboard-ux/mis-grupos.png'});
});
test('dashboard: cancelar y Escape no trasladan y restauran foco al alumno',async({page,fixture})=>{
  await friendly(fixture);await login(page,fixture,'teacherBoth');await manage(page,fixture.f.groups.a);const opener=page.getByRole('button',{name:'Mover de grupo',exact:true});
  await openMove(page);await expect(page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true})).toBeFocused();await page.getByRole('radio',{name:'Grupo B',exact:true}).check();await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused();expect(fixture.commands.filter(c=>c==='transferMembership').length).toBe(0);
  expect((await fixture.call('teacherBoth','roster',fixture.scope())).body.items[0].status).toBe('active');expect((await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items.length).toBe(0);
});
test('dashboard: destino ajeno no se ofrece y el backend también lo rechaza',async({page,fixture})=>{
  await friendly(fixture);await login(page,fixture,'teacherA');await ready(page);await openMove(page);await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(0);await expect(page.getByRole('button',{name:'Confirmar traslado',exact:true})).toBeDisabled();
  const m=(await fixture.call('teacherA','roster',fixture.scope())).body.items[0];expect((await fixture.call('teacherA','transferMembership',{...fixture.scope(),uid:m.uid,destinationGroupId:fixture.f.groups.b,expectedVersion:m.revision,idempotencyKey:crypto.randomUUID()})).status).toBe(403);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
});
test('dashboard: 409 real bloquea traslado hasta refrescar matrícula',async({page,fixture})=>{
  await friendly(fixture);await login(page,fixture,'teacherBoth');await manage(page,fixture.f.groups.a);await expect(page.getByRole('button',{name:'Mover de grupo',exact:true})).toBeVisible();
  const m=(await fixture.call('teacherBoth','roster',fixture.scope())).body.items[0];await fixture.call('teacherBoth','revokeMembership',{...fixture.scope(),uid:m.uid,expectedVersion:m.revision,idempotencyKey:crypto.randomUUID()});
  await openMove(page);await page.getByRole('radio',{name:'Grupo B',exact:true}).check();await page.getByRole('button',{name:'Confirmar traslado',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('La matrícula cambió');await expect(page.getByRole('button',{name:'Confirmar traslado',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Actualizar alumnos y cerrar'}).click();await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();expect((await fixture.call('teacherBoth','roster',fixture.scope('b'))).body.items.length).toBe(0);
});
test('dashboard: traslado con ACK perdido reintenta la misma intención sin duplicar historia',async({page,fixture})=>{
  await friendly(fixture);await login(page,fixture,'teacherBoth');await manage(page,fixture.f.groups.a);await openMove(page);await page.getByRole('radio',{name:'Grupo B',exact:true}).check();fixture.fault.lost='transferMembership';
  if(process.env.DASHBOARD_CAPTURE==='1')await page.getByRole('dialog').screenshot({path:'docs/qa/teacher-dashboard-ux/mover-grupo.png'});
  await page.getByRole('button',{name:'Confirmar traslado',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('No pudimos confirmar');await page.getByRole('button',{name:'Reintentar traslado'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();const events=await fixture.call('teacherBoth','membershipEvents',fixture.scope());expect(events.body.items.filter((e:any)=>e.action==='transfer-out').length).toBe(1);
});
async function additionalGroups(f:Fixture){
  const uid=f.f.actors.teacherBoth.uid,batch=f.sdk.db.batch();const all=[{...f.scope(),title:'Grupo A'},{...f.scope('b'),title:'Grupo B'}];
  for(let i=0;i<25;i++){const s={...f.scope(),groupId:`grupo-extra-${i}`},root=`courses/${s.courseId}/terms/${s.termId}/groups/${s.groupId}`;all.push({...s,title:`Grupo adicional ${i}`});
    batch.set(f.sdk.db.doc(root),{schemaVersion:1,...s,title:`Grupo adicional ${i}`,status:'active'});batch.set(f.sdk.db.doc(`${root}/settings/current`),{schemaVersion:2,...s,revision:0});
    batch.set(f.sdk.db.doc(`${root}/staff/${uid}`),{schemaVersion:1,...s,uid,status:'active'});batch.set(f.sdk.db.doc(`${root}/administration/${uid}`),{schemaVersion:2,...s,uid,status:'active',manageMembers:true,manageInvitations:true,readHistory:true});
    batch.set(f.sdk.db.doc(`users/${uid}/teachingScopes/${scopeKey(s)}`),{schemaVersion:2,...s,uid,status:'active'});
  }await batch.commit();return all.sort((a,b)=>scopeKey(a).localeCompare(scopeKey(b)));
}
test('dashboard: descubrimiento y destinos paginados no se limitan a los primeros20 grupos',async({page,fixture})=>{
  await friendly(fixture);const all=await additionalGroups(fixture),source=all[0],target=all.at(-1)!;
  if(source.groupId!==fixture.f.groups.a){const m=(await fixture.call('teacherBoth','roster',fixture.scope())).body.items[0];expect((await fixture.call('teacherBoth','transferMembership',{...fixture.scope(),uid:m.uid,destinationGroupId:source.groupId,expectedVersion:m.revision,idempotencyKey:crypto.randomUUID()})).status).toBe(200);}
  await login(page,fixture,'teacherBoth');await expect(page.locator('.teacher-group-card')).toHaveCount(20);await expect(page.getByRole('button',{name:'Cargar más grupos',exact:true})).toBeVisible();await manage(page,source.groupId);await openMove(page);
  await expect(page.getByRole('dialog').getByRole('radio',{name:target.title,exact:true})).toHaveCount(0);
  fixture.fault.offline=true;await page.getByRole('button',{name:'Cargar más grupos destino'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('API local');fixture.fault.offline=false;
  await page.getByRole('button',{name:'Cargar más grupos destino'}).click();await expect(page.getByRole('dialog').getByRole('radio',{name:target.title,exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('radio',{name:target.title,exact:true}).check();await page.getByRole('button',{name:'Confirmar traslado',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('Inactivo',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← Mis grupos',exact:true}).click();await expect(page.locator('.teacher-group-card')).toHaveCount(27);await manage(page,target.groupId);await expect(page.getByText('Synthetic studentA',{exact:true})).toBeVisible();
});
test('dashboard: crea periodo/grupo guiados, recupera por API y conserva tras recarga',async({page,fixture})=>{
  await friendly(fixture);await login(page,fixture);await tab(page,'Periodos y grupos');await expect(page.getByLabel('Curso autorizado')).toBeVisible();
  await page.getByRole('button',{name:'Crear un periodo nuevo'}).click();await page.getByLabel('Nombre del periodo',{exact:true}).fill('Ciclo de demostración');
  if(process.env.DASHBOARD_CAPTURE==='1')await page.locator('.teacher-creation').screenshot({path:'docs/qa/teacher-dashboard-ux/crear-periodo.png'});
  await page.getByRole('button',{name:'Confirmar nuevo periodo'}).click();await confirm(page);await expect(page.getByLabel('Periodo existente').locator('option').filter({hasText:'Ciclo de demostración'})).toHaveCount(1);
  await page.getByLabel('Nombre del grupo',{exact:true}).fill('Grupo de demostración');
  if(process.env.DASHBOARD_CAPTURE==='1')await page.locator('.teacher-creation').screenshot({path:'docs/qa/teacher-dashboard-ux/crear-grupo.png'});
  await page.getByRole('button',{name:'Revisar nuevo grupo'}).click();await expect(page.getByRole('dialog')).toContainText('Ciclo de demostración');await confirm(page);await expect(page.locator('.teacher-group-card').filter({hasText:'Grupo de demostración'})).toBeVisible();await page.reload();await expect(page.locator('.teacher-group-card').filter({hasText:'Grupo de demostración'})).toBeVisible();
});
for(const width of [390,820,1180,1440])test(`dashboard: Mis grupos y modal responsive ${width}, foco y Axe`,async({page,fixture})=>{
  await friendly(fixture);await page.setViewportSize({width,height:900});await login(page,fixture,'teacherBoth');await expect(page.locator('.teacher-group-card')).toHaveCount(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const directory=await new AxeBuilder({page}).include('.teacher-directory').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(directory.violations.map(v=>v.id)).toEqual([]);
  await manage(page,fixture.f.groups.a);await openMove(page);const dialog=await new AxeBuilder({page}).include('.teacher-transfer-dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(dialog.violations.map(v=>v.id)).toEqual([]);expect(await page.getByRole('dialog').evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Mover de grupo',exact:true})).toBeFocused();
});
