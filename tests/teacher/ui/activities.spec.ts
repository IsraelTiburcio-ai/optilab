import {test,expect,login,ready,tab,approvePendingStudents,loginExisting,createStudentIdentity,type Fixture} from './fixtures';
import type {Page} from '@playwright/test';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
const wordwall={provider:'wordwall',resourceId:'cc167dda64954e3dbb379706dd8348c8',
  sourceUrl:'https://wordwall.net/resource/22610275/metodo-de-m-grande',
  embedUrl:'https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0'};
const learningapps={provider:'learningapps',resourceId:'pznycxd7t21',
  sourceUrl:'https://learningapps.org/watch?v=pznycxd7t21',embedUrl:'https://learningapps.org/show.php?id=pznycxd7t21'};
async function createActivity(page:Page,value:{title:string;gymId:number;provider:'wordwall'|'learningapps';resourceId:string;sourceUrl:string;embedUrl:string;description?:string;instructions?:string}){
  await page.getByRole('button',{name:'Nueva actividad',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('Título').fill(value.title);await dialog.getByLabel('Proveedor').selectOption(value.provider);
  await dialog.getByLabel('ID del recurso').fill(value.resourceId);await dialog.getByLabel('URL de origen').fill(value.sourceUrl);await dialog.getByLabel('URL de embed').fill(value.embedUrl);
  if(value.description)await dialog.getByLabel('Descripción').fill(value.description);if(value.instructions)await dialog.getByLabel('Instrucciones').fill(value.instructions);
  await dialog.getByLabel('Gimnasio').selectOption(String(value.gymId));
  await dialog.getByRole('button',{name:'Guardar borrador',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Borrador guardado. Ya puedes previsualizarlo o publicarlo.',{exact:true})).toBeVisible();
}
async function publish(page:Page,title:string){await page.getByRole('button',{name:`Publicar ${title}`,exact:true}).click();await expect(page.getByText('Actividad publicada en este grupo.',{exact:true})).toBeVisible();}
async function openActivities(page:Page,fixture:Fixture){await login(page,fixture,'teacherA');await ready(page);await tab(page,'Actividades');await expect(page.getByRole('heading',{name:'Actividades',exact:true})).toBeVisible();}
async function workspace(fixture:Fixture){return (await fixture.call('teacherA','activityWorkspace',fixture.scope())).body;}
test('docente crea, previsualiza, publica y el alumno B ve la actividad tras recargar',async({page,fixture,browser})=>{
  await approvePendingStudents(fixture,['studentB']);
  await createStudentIdentity(fixture,'studentB','Alumno B Actividades',`alumno_b_${crypto.randomUUID().slice(0,8)}`);
  await openActivities(page,fixture);
  await createActivity(page,{...wordwall,title:'Wordwall de clase',gymId:3,description:'Actividad de M Grande',instructions:'Practica el método.'});
  await page.getByRole('button',{name:'Previsualizar Wordwall de clase',exact:true}).first().click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Vista previa: Wordwall de clase'})).toBeVisible();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute('sandbox','allow-scripts allow-same-origin allow-forms');
  await page.getByRole('button',{name:'Cerrar vista previa',exact:true}).click();
  const draft=await workspace(fixture);expect(draft.definitions).toHaveLength(1);expect(draft.assignments[0].status).toBe('draft');
  expect((await fixture.call('studentB','publishedGroupActivities',fixture.scope())).body.gyms.flatMap((g:any)=>g.activities)).toHaveLength(0);
  await publish(page,'Wordwall de clase');
  const published=await workspace(fixture);expect(published.assignments[0].status).toBe('published');expect(published.placements.find((p:any)=>p.gymId===3).orderedActivityIds).toHaveLength(1);
  if(process.env.ACTIVITIES_CAPTURE==='1'){fs.mkdirSync('docs/qa/teacher-activities',{recursive:true});await page.locator('.teacher-panel').screenshot({path:'docs/qa/teacher-activities/editor.png'});}
  await page.reload();await ready(page);await tab(page,'Actividades');await expect(page.getByText('Wordwall de clase',{exact:true}).first()).toBeVisible();
  const student=await browser.newContext({baseURL:test.info().project.use.baseURL as string});await fixture.attach(student);
  try{const studentPage=await student.newPage();await loginExisting(studentPage,fixture,'studentB');await studentPage.goto('#/gimnasio/3');
    const group=studentPage.locator('.group-external-activities');await expect(group).toBeVisible();await expect(group.getByRole('heading',{name:'Wordwall de clase',exact:true})).toBeVisible();
    await group.getByRole('link',{name:/Abrir actividad/}).click();await expect(studentPage.getByRole('heading',{name:'Wordwall de clase',exact:true})).toBeVisible();
    await expect(studentPage.locator('.published-activity-player iframe')).toHaveAttribute('sandbox','allow-scripts allow-same-origin allow-forms');
    await studentPage.reload();await expect(studentPage.getByRole('heading',{name:'Wordwall de clase',exact:true})).toBeVisible();
  }finally{await student.close();}
});
test('ordena, mueve, oculta y archiva; docente ajeno no modifica ni lee borradores',async({page,fixture})=>{
  await approvePendingStudents(fixture,['studentB']);await openActivities(page,fixture);
  await createActivity(page,{...wordwall,title:'Primera',gymId:3});await publish(page,'Primera');
  await createActivity(page,{...learningapps,title:'LearningApps uno',gymId:1});await publish(page,'LearningApps uno');
  await createActivity(page,{...wordwall,title:'Segunda',gymId:3});await publish(page,'Segunda');
  let beforeOrder=await fixture.call('studentB','publishedGroupActivities',fixture.scope());expect(beforeOrder.body.gyms.find((g:any)=>g.gymId===1).activities.map((a:any)=>a.title)).toEqual(['LearningApps uno']);
  await page.getByRole('button',{name:'Subir Segunda',exact:true}).click();await expect(page.getByText('Actividad movida arriba en Gimnasio 3.',{exact:true})).toBeVisible();
  let ws=await workspace(fixture);let placement=ws.placements.find((p:any)=>p.gymId===3);
  expect(placement.orderedActivityIds).toHaveLength(2);expect(placement.orderedActivityIds[0]).not.toBe(placement.orderedActivityIds[1]);
  await page.getByLabel('Mover LearningApps uno a gimnasio').selectOption('3');await expect(page.getByText('Actividad movida a Gimnasio 3.',{exact:true})).toBeVisible();
  ws=await workspace(fixture);expect(ws.assignments.find((a:any)=>a.activityId===ws.definitions.find((d:any)=>d.title==='LearningApps uno').activityId).gymId).toBe(3);
  const studentOrder=await fixture.call('studentB','publishedGroupActivities',fixture.scope());expect(studentOrder.body.gyms.find((g:any)=>g.gymId===3).activities.map((a:any)=>a.title)).toEqual(['Segunda','Primera','LearningApps uno']);
  await page.reload();await ready(page);await tab(page,'Actividades');const gymThree=page.locator('.activity-gym-column').filter({has:page.getByRole('heading',{name:'Gimnasio 3',exact:true})});await expect(gymThree.locator('.activity-sort-item strong')).toHaveText(['Segunda','Primera','LearningApps uno']);
  await page.getByRole('button',{name:'Ocultar Primera',exact:true}).click();await expect(page.getByText('Actividad oculta para alumnos.',{exact:true})).toBeVisible();
  await publish(page,'Primera');await page.getByRole('button',{name:'Ocultar Primera',exact:true}).click();await expect(page.getByText('Actividad oculta para alumnos.',{exact:true})).toBeVisible();
  expect(await fixture.call('teacherB','activityWorkspace',fixture.scope())).toMatchObject({status:403});
  await page.getByRole('button',{name:'Archivar Segunda',exact:true}).click();await expect(page.getByText('Actividad archivada; su historial permanece.',{exact:true})).toBeVisible();
  const archived=await workspace(fixture);expect(archived.assignments.some((a:any)=>a.status==='archived')).toBe(true);
  const visible=await fixture.call('studentB','publishedGroupActivities',fixture.scope());expect(visible.status).toBe(200);const visibleActivities=visible.body.gyms.flatMap((g:any)=>g.activities);expect(visibleActivities).toHaveLength(1);expect(visibleActivities[0].title).toBe('LearningApps uno');
});
test('editor responsive 390/820/1180/1440 con Axe y captura móvil',async({page,fixture})=>{
  await openActivities(page,fixture);
  for(const width of [390,820,1180,1440]){await page.setViewportSize({width,height:900});await expect(page.locator('.activity-editor')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.setViewportSize({width:390,height:844});
  const result=await new AxeBuilder({page}).include('.activity-editor').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
  if(process.env.ACTIVITIES_CAPTURE==='1'){fs.mkdirSync('docs/qa/teacher-activities',{recursive:true});await page.locator('.activity-editor').screenshot({path:'docs/qa/teacher-activities/editor-mobile.png'});}
});

test('drag-and-drop mueve una actividad antes de otra y persiste el orden',async({page,fixture,browserName})=>{
  test.skip(browserName!=='chromium','El arrastre nativo se valida en Chromium; WebKit usa los botones accesibles.');
  await openActivities(page,fixture);
  await createActivity(page,{...wordwall,title:'Arrastrada A',gymId:3});await publish(page,'Arrastrada A');
  await createActivity(page,{...learningapps,title:'Arrastrada B',gymId:3});await publish(page,'Arrastrada B');
  const source=page.locator('.activity-sort-item').filter({hasText:'Arrastrada B'}),target=page.locator('.activity-sort-item').filter({hasText:'Arrastrada A'});
  await source.dragTo(target);await expect(page.getByText('Actividad movida en Gimnasio 3.',{exact:true})).toBeVisible();
  const ws=await workspace(fixture),placement=ws.placements.find((p:any)=>p.gymId===3);
  const titles=placement.orderedActivityIds.map((id:string)=>ws.definitions.find((d:any)=>d.activityId===id)?.title);
  expect(titles).toEqual(['Arrastrada B','Arrastrada A']);
});
