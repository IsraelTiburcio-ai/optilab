import {test,expect,login,ready,tab,approvePendingStudents,loginExisting,createStudentIdentity,type Fixture} from './fixtures';
import type {Page} from '@playwright/test';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const wordwall={provider:'wordwall',resourceId:'cc167dda64954e3dbb379706dd8348c8',
  sourceUrl:'https://wordwall.net/resource/22610275/metodo-de-m-grande',
  embedUrl:'https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0'};
const learningapps={provider:'learningapps',resourceId:'pznycxd7t21',
  sourceUrl:'https://learningapps.org/watch?v=pznycxd7t21',embedUrl:'https://learningapps.org/show.php?id=pznycxd7t21'};
async function createActivity(page:Page,value:{title:string;gymId:number;provider:'wordwall'|'learningapps';resourceId:string;sourceUrl:string;embedUrl:string|null;description?:string;instructions?:string}){
  await tab(page,'Gimnasios');await page.getByRole('button',{name:'+ Agregar actividad',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('Enlace de la actividad').fill(value.sourceUrl);await dialog.getByLabel('Título').fill(value.title);
  if(value.description||value.instructions){await dialog.getByText('Opciones avanzadas',{exact:true}).click();if(value.description)await dialog.getByLabel('Descripción').fill(value.description);if(value.instructions)await dialog.getByLabel('Instrucciones').fill(value.instructions);}
  await dialog.getByLabel('Gimnasio').selectOption(String(value.gymId));
  await dialog.getByRole('button',{name:'Guardar borrador',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Borrador guardado. Ya puedes publicarlo cuando quieras.',{exact:true})).toBeVisible();
}
async function publish(page:Page,title:string){await tab(page,'Biblioteca');await page.getByRole('button',{name:`Publicar ${title}`,exact:true}).click();await expect(page.getByText('Actividad publicada en este grupo.',{exact:true})).toBeVisible();}
async function openActivities(page:Page,fixture:Fixture){await login(page,fixture,'teacherA');await ready(page);await tab(page,'Gimnasios');await expect(page.getByRole('heading',{name:'Gimnasios',exact:true})).toBeVisible();}
async function workspace(fixture:Fixture){return (await fixture.call('teacherA','activityWorkspace',fixture.scope())).body;}
test('docente crea, previsualiza, publica y el alumno B ve la actividad tras recargar',async({page,fixture,browser})=>{
  await approvePendingStudents(fixture,['studentB']);
  await createStudentIdentity(fixture,'studentB','Alumno B Actividades',`alumno_b_${crypto.randomUUID().slice(0,8)}`);
  await openActivities(page,fixture);
  await createActivity(page,{...wordwall,title:'Wordwall de clase',gymId:3,description:'Actividad de M Grande',instructions:'Practica el método.'});
  await tab(page,'Biblioteca');await page.getByRole('button',{name:'Previsualizar Wordwall de clase',exact:true}).first().click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Vista previa: Wordwall de clase'})).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Esta actividad se abrirá en Wordwall.')).toBeVisible();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveCount(0);
  await page.getByRole('button',{name:'Cerrar vista previa',exact:true}).click();
  const draft=await workspace(fixture);expect(draft.definitions).toHaveLength(1);expect(draft.assignments[0].status).toBe('draft');
  expect((await fixture.call('studentB','publishedGroupActivities',fixture.scope())).body.gyms.flatMap((g:any)=>g.activities)).toHaveLength(0);
  await publish(page,'Wordwall de clase');
  const published=await workspace(fixture);expect(published.assignments[0].status).toBe('published');expect(published.placements.find((p:any)=>p.gymId===3).orderedActivityIds).toHaveLength(1);
  if(process.env.ACTIVITIES_CAPTURE==='1'){fs.mkdirSync('docs/qa/teacher-activities',{recursive:true});await page.locator('.teacher-panel').screenshot({path:'docs/qa/teacher-activities/editor.png'});}
  await page.reload();await ready(page);await tab(page,'Biblioteca');await expect(page.getByText('Wordwall de clase',{exact:true}).first()).toBeVisible();
  const student=await browser.newContext({baseURL:test.info().project.use.baseURL as string});await fixture.attach(student);
  try{const studentPage=await student.newPage();await loginExisting(studentPage,fixture,'studentB');await studentPage.goto('#/gimnasio/3');
    const group=studentPage.locator('.game-grid .group-activity-cartridge');await expect(group).toBeVisible();await expect(group.getByRole('heading',{name:'Wordwall de clase',exact:true})).toBeVisible();
    await group.getByRole('link',{name:/Abrir/}).first().click();await expect(studentPage.getByRole('heading',{name:'Wordwall de clase',exact:true})).toBeVisible();
    await expect(studentPage.getByText('Actividad externa segura')).toBeVisible();
    await studentPage.reload();await expect(studentPage.getByRole('heading',{name:'Wordwall de clase',exact:true})).toBeVisible();
  }finally{await student.close();}
});
test('editor de gimnasio ordena y oculta externas y originales sin perder el orden local',async({page,fixture})=>{
  await approvePendingStudents(fixture,['studentB']);await openActivities(page,fixture);
  await createActivity(page,{...wordwall,title:'Primera',gymId:3});await publish(page,'Primera');
  await createActivity(page,{...wordwall,title:'Segunda',gymId:3});await publish(page,'Segunda');
  await tab(page,'Gimnasios');const manager=page.locator('.gym-manager');await expect(manager).toBeVisible();
  const second=manager.locator('.gym-manager-row').filter({hasText:'Segunda'}),first=manager.locator('.gym-manager-row').filter({hasText:'Primera'});
  await second.getByRole('button',{name:/Subir/}).click();await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar y continuar',exact:true}).click();await expect(page.getByText('Cambios guardados.',{exact:true})).toBeVisible();
  const ws=await fixture.call('teacherA','activityWorkspace',fixture.scope());const layout=ws.body.layouts.find((row:any)=>row.gymId===3);const ids=[...layout.orderedActivityIds];expect(ids.indexOf(ws.body.definitions.find((d:any)=>d.title==='Segunda').activityId)).toBeLessThan(ids.indexOf(ws.body.definitions.find((d:any)=>d.title==='Primera').activityId));
  const student=await fixture.call('studentB','publishedGroupActivities',fixture.scope());expect(student.body.gyms.find((g:any)=>g.gymId===3).activities.map((a:any)=>a.title)).toEqual(['Segunda','Primera']);
  expect(await fixture.call('teacherB','activityWorkspace',fixture.scope())).toMatchObject({status:403});
});
test('editor responsive 390/820/1180/1440 con Axe y captura móvil',async({page,fixture})=>{
  await openActivities(page,fixture);
  for(const width of [390,820,1180,1440]){await page.setViewportSize({width,height:900});await expect(page.locator('.gym-manager')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390||width===1180)await page.locator('.gym-manager').screenshot({path:test.info().outputPath(`gym-manager-${width}.png`)});}
  await page.setViewportSize({width:390,height:844});
  const result=await new AxeBuilder({page}).include('.gym-manager').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
  if(process.env.ACTIVITIES_CAPTURE==='1'){fs.mkdirSync('docs/qa/teacher-activities',{recursive:true});await page.locator('.gym-manager').screenshot({path:'docs/qa/teacher-activities/editor-mobile.png'});}
});

test('drag-and-drop del administrador guarda orden conjunto y persiste',async({page,fixture,browserName})=>{
  test.skip(browserName!=='chromium','El arrastre nativo se valida en Chromium; WebKit usa los botones accesibles.');
  await openActivities(page,fixture);await createActivity(page,{...wordwall,title:'Arrastrada A',gymId:3});await publish(page,'Arrastrada A');await createActivity(page,{...learningapps,title:'Arrastrada B',gymId:3});await publish(page,'Arrastrada B');
  await tab(page,'Gimnasios');const manager=page.locator('.gym-manager'),source=manager.locator('.gym-manager-row').filter({hasText:'Arrastrada B'}),target=manager.locator('.gym-manager-row').filter({hasText:'Arrastrada A'});
  await expect(manager.locator('.gym-manager-row').filter({hasText:/Arrastrada [AB]/}).locator('strong')).toHaveText(['Arrastrada A','Arrastrada B']);
  await source.dragTo(target);await expect(manager.locator('.gym-manager-row').filter({hasText:/Arrastrada [AB]/}).locator('strong')).toHaveText(['Arrastrada B','Arrastrada A']);await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar y continuar',exact:true}).click();await expect(page.getByText('Cambios guardados.',{exact:true})).toBeVisible();
  const ws=await fixture.call('teacherA','activityWorkspace',fixture.scope()),layout=ws.body.layouts.find((row:any)=>row.gymId===3);const ids=[...layout.orderedActivityIds];expect(ids.indexOf(ws.body.definitions.find((d:any)=>d.title==='Arrastrada B').activityId)).toBeLessThan(ids.indexOf(ws.body.definitions.find((d:any)=>d.title==='Arrastrada A').activityId));
});
test('editor visual de gimnasios guarda visibilidad de un juego original y persiste',async({page,fixture})=>{
  await openActivities(page,fixture);await tab(page,'Gimnasios');await expect(page.getByRole('heading',{name:'Gimnasios',exact:true})).toBeVisible();
  const manager=page.locator('.gym-manager');await expect(manager).toBeVisible();
  const first=manager.locator('.gym-manager-row').first();const title=(await first.locator('strong').innerText()).trim();
  await first.getByRole('button',{name:/Ocultar/}).click();
  await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar y continuar',exact:true}).click();
  await expect(page.getByText('Cambios guardados.',{exact:true})).toBeVisible();
  const workspace=await fixture.call('teacherA','activityWorkspace',fixture.scope());const layout=workspace.body.layouts.find((row:any)=>row.gymId===3);
  expect(layout.hiddenOriginalGameIds).toHaveLength(1);
  await page.reload();await ready(page);await tab(page,'Gimnasios');
  await expect(page.locator('.gym-manager-row.is-hidden').filter({hasText:title})).toBeVisible();
});

test('flujo completo: enlace LearningApps, orden mixto, guardado atómico, alumno, recarga y aislamiento',async({page,fixture,browser})=>{
  await approvePendingStudents(fixture,['studentB']);await createStudentIdentity(fixture,'studentB','Alumno Ficticio','ficticio_'+crypto.randomUUID().slice(0,8));
  const otherBefore=(await fixture.call('teacherB','activityWorkspace',fixture.scope('b'))).body;
  await openActivities(page,fixture);const manager=page.locator('.gym-manager');
  await manager.getByRole('button',{name:'+ Agregar actividad',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('Gimnasio')).toHaveValue('3');await expect(dialog.getByLabel('Grupo')).toHaveValue(fixture.f.groups.a);
  await dialog.getByLabel('Enlace de la actividad').fill(learningapps.sourceUrl);
  await dialog.getByRole('button',{name:'Publicar actividad',exact:true}).click();await expect(dialog).toHaveCount(0);
  const row=manager.locator('.gym-manager-row').filter({hasText:'Actividad de LearningApps'});await expect(row).toBeVisible();
  const original=manager.locator('.gym-manager-row').first(),title=await original.locator('strong').innerText();
  await original.getByRole('button',{name:/Ocultar/}).click();await row.getByRole('button',{name:/Subir/}).click();
  const before=await workspace(fixture);expect(before.layouts[2].hiddenOriginalGameIds).toEqual([]);
  await manager.getByRole('button',{name:'Vista previa del alumno',exact:true}).click();await expect(page.getByRole('dialog').getByText(title,{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Cerrar vista previa',exact:true}).click();
  await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar y continuar'}).click();await expect(manager.getByText('Cambios guardados.',{exact:true})).toBeVisible();
  const saved=await workspace(fixture),layout=saved.layouts[2],externalId=saved.definitions[0].activityId;
  expect(layout.orderedActivityIds.indexOf(externalId)).toBe(4);expect(layout.hiddenOriginalGameIds).toHaveLength(1);
  const student=await browser.newContext({baseURL:test.info().project.use.baseURL as string});await fixture.attach(student);
  try{const p=await student.newPage();await loginExisting(p,fixture,'studentB');await p.goto('#/gimnasio/3');
    await expect(p.locator('.game-grid .cartridge')).toHaveCount(5);await expect(p.locator('.external-gym-activities')).toHaveCount(0);await expect(p.locator('.game-grid').getByRole('heading',{name:title,exact:true})).toHaveCount(0);
    await expect(p.locator('.gym-insignia-note')).toContainText('bloqueada');await expect(p.getByText(/El progreso y las insignias conservan los 5/)).toBeVisible();
    const practice=p.getByRole('button',{name:'Marcar como practicado',exact:true}).first();await practice.click();await p.reload();await expect(p.getByRole('button',{name:'Practicado · desmarcar',exact:true})).toHaveCount(1);
    await expect(p.locator('.game-grid').getByRole('heading',{name:'Actividad de LearningApps',exact:true})).toBeVisible();
    const query=new URLSearchParams(fixture.scope()).toString();await p.goto(`#/jugar-original/${layout.hiddenOriginalGameIds[0]}?${query}`);await expect(p.getByRole('heading',{name:'Actividad no disponible para este grupo'})).toBeVisible();await expect(p.locator('.player-frame-shell iframe')).toHaveCount(0);
  }finally{await student.close();}
  expect((await fixture.call('teacherB','activityWorkspace',fixture.scope('b'))).body).toEqual(otherBefore);
});
test('publicación fallida y edición del enlace conservan una sola definición y cambian la clave',async({page,fixture})=>{
  const savedPayloads:any[]=[];page.on('request',request=>{if(request.url().endsWith('/saveActivityDraft'))savedPayloads.push(request.postDataJSON());});
  await openActivities(page,fixture);await page.getByRole('button',{name:'+ Agregar actividad',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Enlace de la actividad').fill(wordwall.sourceUrl);fixture.fault.forbidden='publishActivities';
  await dialog.getByRole('button',{name:'Publicar actividad',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('quedó guardada');
  const first=await workspace(fixture);expect(first.definitions).toHaveLength(1);
  await dialog.getByLabel('Enlace de la actividad').fill(learningapps.sourceUrl);await dialog.getByLabel('Título').fill('Enlace corregido');
  await dialog.getByRole('button',{name:'Publicar actividad',exact:true}).click();await expect(dialog).toHaveCount(0);
  const after=await workspace(fixture);expect(after.definitions).toHaveLength(1);expect(after.definitions[0]).toMatchObject({activityId:first.definitions[0].activityId,revision:2,provider:'learningapps'});expect(after.assignments[0].status).toBe('published');expect(savedPayloads).toHaveLength(2);expect(savedPayloads[1].idempotencyKey).not.toBe(savedPayloads[0].idempotencyKey);expect(savedPayloads[1].activityId).toBe(first.definitions[0].activityId);expect(savedPayloads[1].expectedVersion).toBe(1);
});
test('cambios pendientes: cancelar, guardar antes de navegar, descartar y error visible',async({page,fixture})=>{
  await openActivities(page,fixture);const manager=page.locator('.gym-manager');await expect(manager.locator('.gym-manager-row')).toHaveCount(5);
  await manager.locator('.gym-manager-row').first().getByRole('button',{name:/Ocultar/}).click();
  await tab(page,'Biblioteca');let dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Hay cambios sin guardar'})).toBeVisible();await dialog.getByRole('button',{name:'Seguir editando'}).click();
  await manager.getByRole('combobox',{name:'Gimnasio',exact:true}).selectOption('2');dialog=page.getByRole('dialog');fixture.fault.forbidden='saveGymLayout';
  await dialog.getByRole('button',{name:'Guardar y continuar'}).click();await expect(dialog.getByRole('alert')).toContainText('Tus cambios siguen aquí');
  await expect(manager.getByRole('combobox',{name:'Gimnasio',exact:true})).toHaveValue('3');await dialog.getByRole('button',{name:'Guardar y continuar'}).click();await expect(dialog).toHaveCount(0);await expect(manager.getByRole('combobox',{name:'Gimnasio',exact:true})).toHaveValue('2');
  await expect(manager.locator('.gym-manager-row').first()).toBeVisible();await manager.locator('.gym-manager-row').first().getByRole('button',{name:/Ocultar/}).click();await tab(page,'Biblioteca');await page.getByRole('dialog').getByRole('button',{name:'Descartar cambios'}).click();await expect(page.getByRole('heading',{name:'Biblioteca',exact:true}).first()).toBeVisible();
  expect((await workspace(fixture)).layouts[1].hiddenOriginalGameIds).toEqual([]);expect((await workspace(fixture)).layouts[2].hiddenOriginalGameIds).toHaveLength(1);
});
test('error de configuración del alumno bloquea el catálogo y permite reintento',async({page,fixture})=>{
  await createStudentIdentity(fixture,'studentA','Alumno Error','error_'+crypto.randomUUID().slice(0,8));await loginExisting(page,fixture,'studentA');fixture.fault.forbidden='publishedGroupActivities';await page.goto('#/gimnasio/3');
  await expect(page.getByRole('alert')).toContainText('No pudimos cargar la configuración');await expect(page.locator('.game-grid .cartridge')).toHaveCount(0);await expect(page.locator('.external-gym-activities')).toHaveCount(0);await page.getByRole('button',{name:'Reintentar',exact:true}).click();await expect(page.locator('.game-grid .cartridge')).toHaveCount(5);
});
test('alumno multigrupo selecciona contexto sin mezclar recursos y lo conserva al recargar',async({page,fixture})=>{
  await createStudentIdentity(fixture,'studentA','Alumno Multigrupo','multi_'+crypto.randomUUID().slice(0,8));
  const inv=(await fixture.call('teacherB','createInvitation',{...fixture.scope('b'),idempotencyKey:crypto.randomUUID(),expiresInSeconds:3600,maxUses:10,maxPending:10})).body;
  const request=(await fixture.call('studentA','requestMembership',{...fixture.scope('b'),inviteId:inv.inviteId,token:inv.token,idempotencyKey:crypto.randomUUID()})).body;
  expect((await fixture.call('teacherB','approveMembership',{...fixture.scope('b'),requestId:request.requestId,expectedVersion:1,idempotencyKey:crypto.randomUUID()})).status).toBe(200);
  const ws=(await fixture.call('teacherA','activityWorkspace',fixture.scope())).body;
  await fixture.call('teacherA','saveGymLayout',{...fixture.scope(),gymId:3,orderedActivityIds:ws.layouts[2].orderedActivityIds,hiddenOriginalGameIds:ws.layouts[2].orderedActivityIds,expectedVersion:0,idempotencyKey:crypto.randomUUID()});
  await loginExisting(page,fixture,'studentA');await page.goto('#/gimnasio/3');await expect(page.getByLabel('Contexto académico')).toBeVisible();await expect(page.locator('.game-grid .cartridge')).toHaveCount(0);
  const context=(group:'a'|'b')=>JSON.stringify(Object.values(fixture.scope(group)));
  await page.getByLabel('Contexto académico').selectOption(context('a'));await expect(page.getByText('Este gimnasio no tiene actividades visibles.')).toBeVisible();await expect(page.locator('.gym-insignia-note')).toContainText('bloqueada');
  await page.getByLabel('Contexto académico').selectOption(context('b'));await expect(page.locator('.game-grid .cartridge')).toHaveCount(5);await page.reload();await expect(page.locator('.game-grid .cartridge')).toHaveCount(5);await expect(page.getByLabel('Contexto académico')).toHaveValue(context('b'));
});

test('conflicto docente conserva los cambios y nunca sobrescribe la versión ganadora',async({page,fixture})=>{
  await openActivities(page,fixture);const manager=page.locator('.gym-manager');await expect(manager.locator('.gym-manager-row')).toHaveCount(5);
  await manager.locator('.gym-manager-row').first().getByRole('button',{name:/Ocultar/}).click();
  const ws=await workspace(fixture),layout=ws.layouts[2],winning=[...layout.orderedActivityIds].reverse();
  expect((await fixture.call('teacherBoth','saveGymLayout',{...fixture.scope(),gymId:3,orderedActivityIds:winning,hiddenOriginalGameIds:[],expectedVersion:0,idempotencyKey:crypto.randomUUID()})).status).toBe(200);
  await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar y continuar'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('La información cambió');
  expect((await workspace(fixture)).layouts[2].orderedActivityIds).toEqual(winning);await page.getByRole('dialog').getByRole('button',{name:'Seguir editando'}).click();
  await tab(page,'Biblioteca');await page.getByRole('dialog').getByRole('button',{name:'Descartar cambios'}).click();await tab(page,'Gimnasios');
  const current=await workspace(fixture);await expect(manager.locator('.gym-manager-row')).toHaveCount(current.layouts[2].orderedActivityIds.length);await expect(manager.getByText('No hay cambios pendientes.',{exact:false})).toBeVisible();
});
test('respuesta perdida del guardado se reintenta sin duplicar revisiones',async({page,fixture})=>{
  await openActivities(page,fixture);const manager=page.locator('.gym-manager');await expect(manager.locator('.gym-manager-row')).toHaveCount(5);
  await manager.locator('.gym-manager-row').first().getByRole('button',{name:/Ocultar/}).click();fixture.fault.lost='saveGymLayout';
  await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Guardar y continuar'}).click();await expect(dialog.getByRole('alert')).toContainText('Tus cambios siguen aquí');
  expect((await workspace(fixture)).layouts[2].revision).toBe(1);await dialog.getByRole('button',{name:'Guardar y continuar'}).click();await expect(manager.getByText('Cambios guardados.',{exact:true})).toBeVisible();expect((await workspace(fixture)).layouts[2].revision).toBe(1);
});
test('mover actividad desde Gimnasios conserva la publicación y el grupo',async({page,fixture})=>{
  await openActivities(page,fixture);await createActivity(page,{...learningapps,title:'Se mueve',gymId:3});await publish(page,'Se mueve');await tab(page,'Gimnasios');
  const manager=page.locator('.gym-manager');await manager.getByRole('button',{name:'Cambiar gimnasio de Se mueve',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Gimnasio de destino').selectOption('2');await dialog.getByRole('button',{name:'Confirmar cambio de gimnasio'}).click();await expect(dialog).toHaveCount(0);
  await expect(manager.locator('.gym-manager-row').filter({hasText:'Se mueve'})).toHaveCount(0);await manager.getByRole('combobox',{name:'Gimnasio',exact:true}).selectOption('2');await expect(manager.locator('.gym-manager-row').filter({hasText:'Se mueve'})).toBeVisible();expect((await workspace(fixture)).assignments[0]).toMatchObject({gymId:2,status:'published',groupId:fixture.f.groups.a});
});
test('la lectura posterior al guardado refleja una edición concurrente sin convertirla en cambios propios',async({page,fixture})=>{
  await openActivities(page,fixture);const manager=page.locator('.gym-manager');await expect(manager.locator('.gym-manager-row')).toHaveCount(5);
  const names=await manager.locator('.gym-manager-row strong').allTextContents(),ws=await workspace(fixture),layout=ws.layouts[2];
  await manager.locator('.gym-manager-row').first().getByRole('button',{name:/Ocultar/}).click();
  await page.route('http://127.0.0.1:5200/v1/activityWorkspace',async route=>{
    const winner=await fixture.call('teacherBoth','saveGymLayout',{...fixture.scope(),gymId:3,orderedActivityIds:[...layout.orderedActivityIds].reverse(),hiddenOriginalGameIds:[],expectedVersion:1,idempotencyKey:crypto.randomUUID()});expect(winner.status).toBe(200);
    const current=await workspace(fixture);await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':route.request().headers().origin},json:current});
  });
  await manager.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Guardar y continuar'}).click();
  await expect(manager.getByText('Tus cambios se guardaron. Otro docente actualizó después; se muestra la configuración actual.',{exact:true})).toBeVisible();
  expect(await manager.locator('.gym-manager-row strong').allTextContents()).toEqual([...names].reverse());await expect(manager.getByText('No hay cambios pendientes.',{exact:false})).toBeVisible();await expect(manager.locator('.gym-manager-row.is-hidden')).toHaveCount(0);
  await expect(manager.getByRole('button',{name:'Guardar cambios',exact:true})).toBeDisabled();expect((await workspace(fixture)).layouts[2].revision).toBe(2);
});
test('Atrás del navegador conserva el borrador y permite guardar o descartar antes de salir',async({page,fixture})=>{
  await openActivities(page,fixture);
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Mapa',exact:true}).click();
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Docente',exact:true}).click();await ready(page);await tab(page,'Gimnasios');
  const manager=page.locator('.gym-manager');await expect(manager.locator('.gym-manager-row')).toHaveCount(5);
  await manager.locator('.gym-manager-row').first().getByRole('button',{name:/Ocultar/}).click();
  await page.goBack();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Hay cambios sin guardar'})).toBeVisible();await expect(page).toHaveURL(/#\/docente$/);
  await dialog.getByRole('button',{name:'Seguir editando'}).click();await expect(manager.locator('.gym-manager-row.is-hidden')).toHaveCount(1);
  await page.goBack();await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Guardar y continuar'}).click();await expect(page).toHaveURL(/#\/mapa$/);expect((await workspace(fixture)).layouts[2].hiddenOriginalGameIds).toHaveLength(1);
  await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Docente',exact:true}).click();await ready(page);await tab(page,'Gimnasios');await expect(manager.locator('.gym-manager-row')).toHaveCount(5);
  await manager.locator('.gym-manager-row').nth(1).getByRole('button',{name:/Ocultar/}).click();await page.goBack();await expect(dialog).toBeVisible();await expect(page).toHaveURL(/#\/docente$/);await dialog.getByRole('button',{name:'Descartar cambios'}).click();await expect(page).toHaveURL(/#\/mapa$/);expect((await workspace(fixture)).layouts[2].hiddenOriginalGameIds).toHaveLength(1);
});
