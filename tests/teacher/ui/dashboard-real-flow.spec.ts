import {test,expect,login,loginExisting,ready,approvePendingStudents,createStudentIdentity,acceptCloud,type Fixture} from './fixtures';
import fs from 'node:fs';
import path from 'node:path';
import type {Page, BrowserContext} from '@playwright/test';

const progress=(page:Page)=>page.getByRole('region',{name:'Sincronización de progreso'});
const attempts=(page:Page)=>page.getByRole('region',{name:'Sincronización de intentos'});
const card=(page:Page,label:string)=>page.locator('.teacher-summary .paper').filter({has:page.getByText(label,{exact:true})}).locator('strong');
import {serveMemorama,playMemorama} from './gameHelpers';
async function markPractice(page:Page,fixture:Fixture) {
  await page.goto('#/optidex?'+new URLSearchParams(fixture.scope()));
  const game=page.locator('.cartridge').filter({hasText:'System Catch'});
  await game.getByRole('button',{name:'Marcar como practicado',exact:true}).click();
  await expect(progress(page).getByRole('status')).toContainText('Sincronizado',{timeout:20000});
  await page.goto('#/cuenta');await expect(attempts(page).getByRole('status')).toContainText('synced',{timeout:20000});
}
async function revoke(page:Page,fixture:Fixture,uid:string) {
  const member=(await fixture.call('teacherA','roster',fixture.scope())).body.items.find((row:any)=>row.uid===uid);
  const response=await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid,expectedVersion:member.revision,idempotencyKey:crypto.randomUUID()});
  expect(response.status).toBe(200);await page.getByRole('button',{name:'Actualizar grupos y datos'}).click();
}
test('flujo real: B completa Memorama, C practica y A ve el tablero sin datos inventados',async({page,fixture,browser})=>{
  test.setTimeout(180000);
  const baseURL=test.info().project.use.baseURL as string;
  await approvePendingStudents(fixture,['studentB','studentC']);
  const studentA=(await fixture.call('teacherA','roster',fixture.scope())).body.items.find((row:any)=>row.uid===fixture.f.actors.studentA.uid);
  const revokedA=await fixture.call('teacherA','revokeMembership',{...fixture.scope(),uid:studentA.uid,expectedVersion:studentA.revision,idempotencyKey:crypto.randomUUID()});
  expect(revokedA.status).toBe(200);
  await createStudentIdentity(fixture,'studentB','Alumno B MVP',`mvp_b_${crypto.randomUUID().slice(0,8)}`);
  await createStudentIdentity(fixture,'studentC','Alumno C MVP',`mvp_c_${crypto.randomUUID().slice(0,8)}`);
  const b=(await browser.newContext({baseURL}));await fixture.attach(b);await serveMemorama(b);
  const c=(await browser.newContext({baseURL}));await fixture.attach(c);
  try {
    const bp=await b.newPage(),cp=await c.newPage();
    await loginExisting(bp,fixture,'studentB');await acceptCloud(bp);await playMemorama(bp,'#/jugar/memorama-simplex?'+new URLSearchParams(fixture.scope()));
    await bp.goto('#/cuenta');await expect(attempts(bp).getByRole('status')).toContainText('synced',{timeout:20000});
    await loginExisting(cp,fixture,'studentC');await acceptCloud(cp);await markPractice(cp,fixture);
    await login(page,fixture,'teacherA');await ready(page);
    await page.getByRole('navigation',{name:'Secciones del panel'}).getByRole('button',{name:'Resumen',exact:true}).click();
    const dashboard=page.locator('.teacher-dashboard');await expect(dashboard).toBeVisible();
    await expect(card(page,'Alumnos inscritos')).toHaveText('2');
    await expect(card(page,'Alumnos con actividad')).toHaveText('2');
    await expect(card(page,'Actividades abiertas')).toHaveText('1');
    await expect(card(page,'Actividades practicadas')).toHaveText('1');
    await expect(card(page,'Resultados informados')).toHaveText('1');
    await expect(card(page,'Finalizaciones reportadas')).toHaveText('1');
    await expect(card(page,'Validación')).toHaveText('0');
    const rows=dashboard.locator('tbody tr');await expect(rows).toHaveCount(2);
    const rowB=rows.filter({hasText:'Alumno B MVP'}),rowC=rows.filter({hasText:'Alumno C MVP'});
    await expect(rowB).toHaveCount(1);await expect(rowC).toHaveCount(1);
    await expect(rowB.locator('td[data-label="Actividad abierta"]')).toHaveText('1');
    await expect(rowB.locator('td[data-label="Actividad practicada (declarada)"]')).toHaveText('0');
    await expect(rowB.locator('td[data-label="Resultado informado (cliente)"]')).toHaveText('1');
    await expect(rowB.locator('td[data-label="Finalización reportada (cliente)"]')).toHaveText('1');
    await expect(rowC.locator('td[data-label="Actividad abierta"]')).toHaveText('0');
    await expect(rowC.locator('td[data-label="Actividad practicada (declarada)"]')).toHaveText('1');
    await expect(rowC.locator('td[data-label="Resultado informado (cliente)"]')).toHaveText('0');
    await expect(rowC.locator('td[data-label="Finalización reportada (cliente)"]')).toHaveText('0');
    if(process.env.TEACHER_CAPTURE==='1'){fs.mkdirSync('docs/qa/teacher-mvp',{recursive:true});await dashboard.screenshot({path:'docs/qa/teacher-mvp/dashboard.png'});}
    await page.reload();await expect(page.locator('.teacher-group-card')).toBeVisible();await ready(page);await page.getByRole('navigation',{name:'Secciones del panel'}).getByRole('button',{name:'Resumen',exact:true}).click();
    await expect(card(page,'Alumnos con actividad')).toHaveText('2');
    await bp.goto('#/docente');await expect(bp.getByRole('heading',{name:'Sin acceso docente autorizado'})).toBeVisible();
    const t=await browser.newContext({baseURL});await fixture.attach(t);
    try {const tp=await t.newPage();await login(tp,fixture,'teacherB');await ready(tp);await expect(tp.getByText('Alumno B MVP',{exact:true})).toHaveCount(0);} finally {await t.close();}
    await revoke(page,fixture,fixture.f.actors.studentB.uid);
    await expect(rows.filter({hasText:'Alumno B MVP'})).toHaveCount(0);await expect(rows.filter({hasText:'Alumno C MVP'})).toHaveCount(1);
    await expect(card(page,'Alumnos inscritos')).toHaveText('1');
  } finally {await b.close();await c.close();}
});
