import {test,expect,login,ready,approvePendingStudents,seedDashboardProgress,dashboardProgressEntries,type Fixture} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import type {Locator} from '@playwright/test';
const scope=(fixture:Fixture,group:'a'|'b'='a')=>({...fixture.scope(group),periodDays:30});
async function prepared(fixture:Fixture) {
  await approvePendingStudents(fixture,['studentB']);
  await seedDashboardProgress(fixture);
}
const card=(dashboard:Locator,label:string)=>dashboard.locator('.teacher-summary .paper').filter({hasText:label}).locator('strong');
const openDashboard=async(page:Parameters<typeof login>[0])=>{await ready(page);await page.getByRole('navigation',{name:'Secciones del panel'}).getByRole('button',{name:'Resumen',exact:true}).click();await expect(page.locator('.teacher-dashboard')).toBeVisible();};
test('resumen: teacherA ve dos alumnos y conteos reales del periodo',async({page,fixture})=>{
  await prepared(fixture);
  const progress=(await fixture.call('teacherA','groupProgress',scope(fixture))).body;
  expect(progress.studentsActive).toBe(2);
  expect(progress.activities).toMatchObject({opened:2,declared:2,reported:2,validated:0});
  await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard');
  await expect(dashboard).toBeVisible();await expect(dashboard.getByRole('heading',{name:'Resumen',exact:true})).toBeVisible();
  await expect(dashboard.getByText('Consultando el progreso del grupo…')).toHaveCount(0);
  await expect(dashboard.getByText('Datos del Firestore Emulator local.',{exact:false})).toBeVisible();
  await expect(dashboard.getByText('no están validados',{exact:false})).toBeVisible();
  await expect(card(dashboard,'Alumnos inscritos')).toHaveText('2');
  await expect(card(dashboard,'Alumnos con actividad')).toHaveText('2');
  await expect(card(dashboard,'Actividades abiertas')).toHaveText('2');
  await expect(card(dashboard,'Actividades practicadas')).toHaveText('2');
  await expect(card(dashboard,'Actividades completadas')).toHaveText('2');
  await expect(card(dashboard,'Validación')).toHaveText('0');await expect(card(dashboard,'Validación').locator('..')).toContainText('sin evidencia validada');
  const rows=dashboard.locator('tbody tr');await expect(rows).toHaveCount(2);
  const studentA=rows.filter({hasText:'Synthetic studentA'});await expect(studentA).toHaveCount(1);
  for(const [label,value] of [['Actividad abierta','1'],['Actividad practicada (declarada)','1'],['Actividad completada (informe del cliente)','1'],['Juegos practicados','1'],['Juegos completados','1']] as const)await expect(studentA.locator(`td[data-label="${label}"]`)).toHaveText(value);
  await expect(studentA.locator('td[data-label="Validado: sin evidencia"]')).toHaveText('0');
  await expect(studentA.getByText('system-lab',{exact:false})).toHaveCount(0);
  const studentB=rows.filter({hasText:'Synthetic studentB'});await expect(studentB).toHaveCount(1);
  await expect(studentB.locator('td[data-label="Actividad practicada (declarada)"]')).toHaveText('1');
  for(const gym of progress.gyms){const row=dashboard.locator('.teacher-gym-progress li').filter({hasText:gym.title});await expect(row).toHaveCount(1);await expect(row).toContainText(`${gym.practiced}/${gym.totalGames}`);await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(gym.practiced));}
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
  const dashboard=page.locator('.teacher-dashboard'),studentB=dashboard.locator('tbody tr').filter({hasText:'Synthetic studentB'});
  await expect(studentB).toHaveCount(1);
  const member=(await fixture.call('teacherA','roster',fixture.scope())).body.items.find((row:any)=>row.uid===fixture.f.actors.studentB.uid);
  expect(member.status).toBe('active');
  const revoked=await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid:member.uid,expectedVersion:member.revision,idempotencyKey:crypto.randomUUID()});
  expect(revoked.status).toBe(200);
  await page.getByRole('button',{name:'Actualizar grupos y datos'}).click();
  await expect(studentB).toHaveCount(0);await expect(dashboard.locator('tbody tr').filter({hasText:'Synthetic studentA'})).toHaveCount(1);
  await expect(card(dashboard,'Alumnos inscritos')).toHaveText('1');
});
test('resumen: filtra por periodo y muestra estados vacíos',async({page,fixture})=>{
  await approvePendingStudents(fixture,['studentB']);await seedDashboardProgress(fixture,dashboardProgressEntries,{ageDays:20});
  await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard'),select=page.getByLabel('Periodo de actividad'),rows=dashboard.locator('tbody tr');
  await expect(select).toHaveValue('30');await expect(rows).toHaveCount(2);
  await select.selectOption('7');
  await expect(page.getByText('Sin actividad registrada en este periodo',{exact:true})).toBeVisible();
  await expect(page.getByText('Consultando el progreso del grupo…')).toHaveCount(0);
  await select.selectOption('0');await expect(rows).toHaveCount(2);
  const roster=(await fixture.call('teacherA','roster',fixture.scope())).body.items.filter((row:any)=>row.status==='active');
  for(const member of roster){const result=await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid:member.uid,expectedVersion:member.revision,idempotencyKey:crypto.randomUUID()});expect(result.status).toBe(200);}
  await page.getByRole('button',{name:'Actualizar grupos y datos'}).click();
  await expect(page.getByText('Sin alumnos activos',{exact:true})).toBeVisible();await expect(rows).toHaveCount(0);
  await expect(card(dashboard,'Alumnos inscritos')).toHaveText('0');
});
test('resumen: responsive 390/820/1180/1440, foco y Axe',async({page,fixture})=>{
  await prepared(fixture);await login(page,fixture,'teacherA');await openDashboard(page);
  const dashboard=page.locator('.teacher-dashboard');
  for(const width of [390,820,1180,1440]){
    await page.setViewportSize({width,height:900});await expect(dashboard).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  const select=page.getByLabel('Periodo de actividad');await select.focus();await expect(select).toBeFocused();
  const result=await new AxeBuilder({page}).include('.teacher-dashboard').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(violation=>violation.id)).toEqual([]);
});
