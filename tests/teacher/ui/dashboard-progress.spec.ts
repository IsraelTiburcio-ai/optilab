import {test,expect,login,ready,approvePendingStudents,seedDashboardProgress,dashboardProgressEntries,type Fixture} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type {Locator} from '@playwright/test';
const scope=(fixture:Fixture,group:'a'|'b'='a')=>({...fixture.scope(group),periodDays:30});
async function prepared(fixture:Fixture) {
  await approvePendingStudents(fixture,['studentB']);
  await seedDashboardProgress(fixture);
}
const card=(dashboard:Locator,label:string)=>dashboard.locator('.teacher-kpi').filter({hasText:label}).locator('strong');
const openDashboard=async(page:Parameters<typeof login>[0])=>{await ready(page);await page.getByRole('navigation',{name:'Secciones del panel'}).getByRole('button',{name:'Resumen',exact:true}).click();await expect(page.locator('.teacher-dashboard')).toBeVisible();};
test('resumen: teacherA ve dos alumnos y métricas reales del periodo',async({page,fixture})=>{
  await prepared(fixture);
  const progress=(await fixture.call('teacherA','groupProgress',scope(fixture))).body;
  expect(progress.studentsActive).toBe(2);
  expect(progress.activities).toMatchObject({opened:2,declared:2,reported:2,completed:2,validated:0});
  await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard');
  await expect(dashboard.getByRole('heading',{name:'Resumen del grupo',exact:true})).toBeVisible();
  await expect(dashboard.getByText('Datos del Firestore Emulator local.',{exact:false})).toHaveCount(0);
  await expect(dashboard.locator('.teacher-dashboard-note')).toContainText('Registros de participación');
  await expect(card(dashboard,'Alumnos inscritos')).toHaveText('2');
  await expect(card(dashboard,'Alumnos que participaron')).toHaveText('2');
  await expect(card(dashboard,'Prácticas registradas')).toHaveText('2');
  await expect(card(dashboard,'Avance promedio')).toHaveText('4%');
  const students=dashboard.locator('.teacher-student-dashboard-card');await expect(students).toHaveCount(2);
  const studentA=students.filter({hasText:'Synthetic studentA'}),studentB=students.filter({hasText:'Synthetic studentB'});
  await expect(studentA.locator('.teacher-student-stat').filter({hasText:'juegos originales'}).locator('b')).toHaveText('1');
  await expect(studentA.locator('.teacher-student-stat').filter({hasText:'avance'}).locator('b')).toHaveText('4%');
  await expect(studentB.locator('.teacher-student-stat').filter({hasText:'juegos originales'}).locator('b')).toHaveText('1');
  await studentA.getByRole('button').click();await expect(studentA).toContainText('Por gimnasio');await expect(studentA).toContainText('1/5 practicados · 20%');
  const gyms=dashboard.locator('.teacher-gym-card');await expect(gyms).toHaveCount(5);
  const gym1=gyms.filter({hasText:'Bosque de Sistemas'});await expect(gym1).toContainText('10%');await gym1.getByRole('button').click();await expect(gym1).toContainText('1 practicaron · 1 pendientes');if(process.env.UX_CAPTURE_DIR)await dashboard.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-dashboard.png`,fullPage:true});
});
test('resumen: alumno y teacherB quedan fuera del grupo ajeno',async({page,fixture,browser})=>{
  await prepared(fixture);await login(page,fixture,'studentA');
  await expect(page.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();await expect(page.locator('.teacher-dashboard')).toHaveCount(0);
  expect((await fixture.call('teacherB','groupProgress',scope(fixture,'a'))).status).toBe(403);
  const baseURL=test.info().project.use.baseURL as string,contextB=await browser.newContext({baseURL});
  await fixture.attach(contextB);const pageB=await contextB.newPage();
  try{
    await login(pageB,fixture,'teacherB');await openDashboard(pageB);
    const dashboard=pageB.locator('.teacher-dashboard');await expect(dashboard).toBeVisible();
    await expect(pageB.getByText('Synthetic studentA',{exact:true})).toHaveCount(0);
    const own=(await fixture.call('teacherB','groupProgress',scope(fixture,'b'))).body;
    expect(own.scope.groupId).toBe(fixture.f.groups.b);expect(own.studentsActive).toBe(0);
    await expect(dashboard.getByText('Sin alumnos activos',{exact:true})).toBeVisible();
  }finally{await contextB.close();}
});
test('resumen: revocar la matrícula retira al alumno del tablero',async({page,fixture})=>{
  await prepared(fixture);await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard'),studentB=dashboard.locator('.teacher-student-dashboard-card').filter({hasText:'Synthetic studentB'});
  await expect(studentB).toHaveCount(1);
  const member=(await fixture.call('teacherA','roster',fixture.scope())).body.items.find((row:any)=>row.uid===fixture.f.actors.studentB.uid);
  expect(member.status).toBe('active');
  const revoked=await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid:member.uid,expectedVersion:member.revision,idempotencyKey:crypto.randomUUID()});
  expect(revoked.status).toBe(200);
  await page.getByRole('button',{name:'Actualizar resumen',exact:true}).click();
  await expect(studentB).toHaveCount(0);await expect(dashboard.locator('.teacher-student-dashboard-card').filter({hasText:'Synthetic studentA'})).toHaveCount(1);
  await expect(card(dashboard,'Alumnos inscritos')).toHaveText('1');
});
test('resumen: filtra por periodo y muestra estados vacíos',async({page,fixture})=>{
  await approvePendingStudents(fixture,['studentB']);await seedDashboardProgress(fixture,dashboardProgressEntries,{ageDays:20});
  await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard'),select=page.getByLabel('Periodo de actividad'),students=dashboard.locator('.teacher-student-dashboard-card');
  await expect(select).toHaveValue('30');await expect(students).toHaveCount(2);
  await select.selectOption('7');
  await expect(page.getByText('Sin actividad en este periodo',{exact:true})).toBeVisible();
  await select.selectOption('0');await expect(students).toHaveCount(2);
  const roster=(await fixture.call('teacherA','roster',fixture.scope())).body.items.filter((row:any)=>row.status==='active');
  for(const member of roster){const result=await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid:member.uid,expectedVersion:member.revision,idempotencyKey:crypto.randomUUID()});expect(result.status).toBe(200);}
  await page.getByRole('button',{name:'Actualizar resumen',exact:true}).click();
  await expect(page.getByText('Sin alumnos activos',{exact:true})).toBeVisible();await expect(students).toHaveCount(0);
  await expect(card(dashboard,'Alumnos inscritos')).toHaveText('0');
});
test('resumen: responsive 390/820/1180/1440, foco y Axe',async({page,fixture})=>{
  await prepared(fixture);await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard');
  for(const width of [390,820,1180,1440]){
    await page.setViewportSize({width,height:900});await expect(dashboard).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await dashboard.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});await expect(dashboard.locator('.teacher-kpi').first()).toBeVisible();if(process.env.UX_CAPTURE_DIR)await dashboard.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-dashboard-mobile.png`,fullPage:true});
  const select=page.getByLabel('Periodo de actividad');await select.focus();await expect(select).toBeFocused();
  const result=await new AxeBuilder({page}).include('.teacher-dashboard').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(violation=>violation.id)).toEqual([]);
});
test('resumen: las actividades externas se muestran como tarjetas sin alterar los 28 juegos',async({page,fixture})=>{
  const scope=fixture.scope(),stamp=fixture.sdk.timestamp(Date.now());
  const draft=await fixture.call('teacherA','saveActivityDraft',{...scope,groupIds:[scope.groupId],gymId:3,provider:'wordwall',resourceId:'22610275',sourceUrl:'https://wordwall.net/resource/22610275/metodo-de-m-grande',embedUrl:null,title:'Actividad externa visual',description:'',instructions:'',idempotencyKey:crypto.randomUUID()});
  expect(draft.status).toBe(200);expect((await fixture.call('teacherA','publishActivities',{...scope,groupIds:[scope.groupId],activityId:draft.body.activityId,expectedVersion:1,idempotencyKey:crypto.randomUUID()})).status).toBe(200);
  const uid=fixture.f.actors.studentA.uid;
  await fixture.sdk.db.doc(`courses/${scope.courseId}/terms/${scope.termId}/groups/${scope.groupId}/participation/${uid}`).set({schemaVersion:1,...scope,uid,activities:{[draft.body.activityId]:{opened:true,openedAt:stamp,declared:true,declaredAt:stamp,lastActivityAt:stamp}},updatedAt:stamp});
  await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard'),external=dashboard.locator('.teacher-external-card');
  await expect(external).toHaveCount(1);await expect(external).toContainText('Actividad externa visual');await expect(external).toContainText('Wordwall');await expect(external).toContainText('100%');await expect(external).toContainText('Abrieron');await expect(external).toContainText('Marcaron práctica');await expect(external).toContainText('Wordwall no aporta finalizaciones verificables');
  const progress=(await fixture.call('teacherA','groupProgress',scope)).body;expect(progress.summary.availableOriginalGames).toBe(28);expect(progress.externalActivities?.[0]).toMatchObject({title:'Actividad externa visual',gymId:3,opened:1,declared:1,participants:1,participationPercent:100});
});
