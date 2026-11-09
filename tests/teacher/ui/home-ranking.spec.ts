import {test,expect,loginExisting,createStudentIdentity,approvePendingStudents,type Fixture} from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const id=()=>crypto.randomUUID();
const games=['system-lab','model-match','ruta-de-metas','lp-factory','ahorcado-simplex','ordena-simplex','rompecabezas-simplex'];
async function seedParticipation(fixture:Fixture,actor:keyof Fixture['f']['actors'],count:number,scope=fixture.scope()){
 const uid=fixture.f.actors[actor].uid,stamp=fixture.sdk.timestamp(Date.now());
 const activities=Object.fromEntries(games.slice(0,count).map(gameId=>[gameId,{opened:true,openedAt:stamp,lastActivityAt:stamp}]));
 await fixture.sdk.db.doc(`courses/${scope.courseId}/terms/${scope.termId}/groups/${scope.groupId}/participation/${uid}`).set({schemaVersion:1,...scope,uid,activities,updatedAt:stamp});
}
test('invitado no recibe datos privados ni consulta el ranking',async({page})=>{
 const calls:string[]=[];page.on('request',request=>{if(request.url().includes('/groupRanking'))calls.push(request.url());});
 await page.goto('#/');await expect(page.locator('.home-ranking')).toContainText('Inicia sesión');await expect(page.locator('.home-ranking')).not.toContainText('Explorador');expect(calls).toEqual([]);
});
test('Inicio muestra dos participantes y abre el ranking completo del grupo correcto',async({page,fixture})=>{
 await approvePendingStudents(fixture,['studentB']);await seedParticipation(fixture,'studentA',7);await seedParticipation(fixture,'studentB',0);
 await createStudentIdentity(fixture,'studentA','Alumno Inicio','inicio_'+id().slice(0,8));await loginExisting(page,fixture,'studentA');await page.goto('#/');
 const home=page.locator('.home-ranking');await expect(home).toContainText('Ranking de mi grupo');await expect(home.locator('.home-ranking-list li')).toHaveCount(2);if(process.env.UX_CAPTURE_DIR)await home.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-home-ranking-2.png`});await expect(home).toContainText('7 actividades');await expect(home).toContainText('0 actividades');
 const link=home.getByRole('link',{name:'Ver ranking completo'});const href=await link.getAttribute('href');await link.click();await expect(page.getByRole('heading',{name:'Ranking de mi grupo',exact:true})).toBeVisible();await expect(page.locator('.ranking-mini-cards li')).toHaveCount(2);if(process.env.UX_CAPTURE_DIR)await page.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-ranking-full-2.png`,fullPage:true});await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 await expect(page.locator('.ranking-mini-cards')).toContainText('Alumno Inicio');
});
test('Inicio muestra nombre académico y gamertag sin exponer datos privados',async({page,fixture})=>{
 await approvePendingStudents(fixture,['studentB']);await seedParticipation(fixture,'studentA',2);await seedParticipation(fixture,'studentB',0);
 await createStudentIdentity(fixture,'studentA','Nombre Visible A','vis_a_'+id().slice(0,6));await createStudentIdentity(fixture,'studentB','Nombre Visible B','vis_b_'+id().slice(0,6));
 const scope=fixture.scope(),board=(await fixture.call('studentB','groupRanking',scope)).body;expect(JSON.stringify(board)).not.toContain(fixture.f.actors.studentA.email);expect(JSON.stringify(board)).not.toContain(fixture.f.actors.studentA.uid);await loginExisting(page,fixture,'studentA');await page.goto('#/');await expect(page.locator('.home-ranking')).toContainText('Nombre Visible A');await expect(page.locator('.home-ranking')).toContainText('vis_a_');
});
test('el cambio de cuenta no muestra el ranking anterior',async({page,fixture})=>{
 const scopeB=fixture.scope('b');
 const invitation=(await fixture.call('teacherB','createInvitation',{...scopeB,idempotencyKey:id(),expiresInSeconds:3600,maxUses:10,maxPending:10})).body;
 const request=(await fixture.call('studentB','requestMembership',{...scopeB,inviteId:invitation.inviteId,token:invitation.token,idempotencyKey:id()})).body;
 expect((await fixture.call('teacherB','approveMembership',{...scopeB,requestId:request.requestId,expectedVersion:1,idempotencyKey:id()})).status).toBe(200);
 await seedParticipation(fixture,'studentA',2);await seedParticipation(fixture,'studentB',1,scopeB);
 await createStudentIdentity(fixture,'studentA','Alumno Cambio A',`ca_${id().slice(0,7)}`);await createStudentIdentity(fixture,'studentB','Alumno Cambio B',`cb_${id().slice(0,7)}`);
 await loginExisting(page,fixture,'studentA');await page.goto('#/');await expect(page.locator('.home-ranking')).toContainText('Alumno Cambio A');
 await page.goto('#/cuenta');await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await loginExisting(page,fixture,'studentB');await page.goto('#/');const home=page.locator('.home-ranking');await expect(home).toContainText('Alumno Cambio B');await expect(home).not.toContainText('Alumno Cambio A');
});
test('el ranking pausado se respeta en Inicio y en la vista completa',async({page,fixture})=>{
 await approvePendingStudents(fixture,['studentB']);await seedParticipation(fixture,'studentA',1);await createStudentIdentity(fixture,'studentA','Alumno Pausa',`pausa_${id().slice(0,7)}`);
 await fixture.call('teacherA','configureParticipation',{...fixture.scope(),enabled:false,expectedVersion:0,idempotencyKey:id()});
 await loginExisting(page,fixture,'studentA');await page.goto('#/');const home=page.locator('.home-ranking');await expect(home).toContainText('El ranking de tu grupo está pausado');await expect(home.locator('.home-ranking-list li')).toHaveCount(0);
 const link=home.getByRole('link',{name:'Ver ranking completo'});await link.click();await expect(page.locator('.ranking-paused')).toContainText('El ranking de tu grupo está pausado');
});
test('Inicio y ranking completo son responsive y accesibles',async({page,fixture})=>{
 await approvePendingStudents(fixture,['studentB']);await seedParticipation(fixture,'studentA',3);await seedParticipation(fixture,'studentB',0);await createStudentIdentity(fixture,'studentA','Alumno Responsive',`resp_${id().slice(0,7)}`);await loginExisting(page,fixture,'studentA');await page.goto('#/');
 for(const width of [320,390,820,1180,1440]){await page.setViewportSize({width,height:900});await expect(page.locator('.home-ranking')).toBeVisible();await expect(page.locator('.home-ranking-list li')).toHaveCount(2);if(process.env.UX_CAPTURE_DIR&&(width===390||width===1180))await page.locator('.home-ranking').screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-home-ranking-${width}.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.home-ranking').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
 await page.getByRole('link',{name:'Ver ranking completo'}).click();for(const width of [320,390,820,1180,1440]){await page.setViewportSize({width,height:900});await expect(page.locator('.ranking-dashboard')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 const audit=await new AxeBuilder({page}).include('.ranking-dashboard').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>v.id)).toEqual([]);
});
test('el ranking completo funciona con un solo participante',async({page,fixture})=>{
 await seedParticipation(fixture,'studentA',7);await createStudentIdentity(fixture,'studentA','Alumno Único',`uno_${id().slice(0,7)}`);await loginExisting(page,fixture,'studentA');await page.goto('#/');const home=page.locator('.home-ranking');await expect(home.locator('.home-ranking-list li')).toHaveCount(1);await expect(home).toContainText('7 actividades');await home.getByRole('link',{name:'Ver ranking completo'}).click();await expect(page.locator('.ranking-mini-cards li')).toHaveCount(1);if(process.env.UX_CAPTURE_DIR)await page.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-ranking-full-1.png`,fullPage:true});
});
