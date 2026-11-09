import {test,expect,loginExisting,createStudentIdentity} from './fixtures';

test('catálogo académico por grupo y vista docente sin registrar práctica',async({page,fixture})=>{
  const scope=fixture.scope(),key=()=>crypto.randomUUID();
  const draft=await fixture.call('teacherA','saveActivityDraft',{...scope,groupIds:[scope.groupId],gymId:3,provider:'wordwall',resourceId:'22610275',sourceUrl:'https://wordwall.net/resource/22610275/metodo-de-m-grande',embedUrl:null,title:'Actividad de clase ficticia',description:'Reto de prueba',instructions:'',idempotencyKey:key()});
  expect(draft.status).toBe(200);
  expect((await fixture.call('teacherA','publishActivities',{...scope,groupIds:[scope.groupId],activityId:draft.body.activityId,expectedVersion:1,idempotencyKey:key()})).status).toBe(200);
  await loginExisting(page,fixture,'teacherA');
  await page.goto('#/gimnasio/3');
  const teacherCard=page.locator('.group-activity-cartridge').filter({hasText:'Actividad de clase ficticia'});
  await expect(teacherCard).toBeVisible();await expect(teacherCard.getByText('ACTIVIDAD DE CLASE',{exact:true})).toBeVisible();
  if(process.env.UX_CAPTURE_DIR)await page.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-teacher-gym.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  if(process.env.UX_CAPTURE_DIR)await page.screenshot({path:`${process.env.UX_CAPTURE_DIR}/${test.info().project.use.browserName}-teacher-gym-mobile.png`,fullPage:true});
  await expect(page.getByRole('button',{name:'Marcar como practicado'})).toHaveCount(0);
  await teacherCard.getByRole('link',{name:/Vista previa/}).click();await expect(page.getByText('Vista previa docente: no se registra progreso ni participación.')).toBeVisible();await expect(page.getByText('Este recurso se abre en la página del proveedor.',{exact:false})).toBeVisible();await page.getByRole('link',{name:'← Regresar al gimnasio'}).click();await expect(teacherCard).toBeVisible();
  let scopeReads=0;page.on('request',request=>{if(request.url().endsWith('/myScopes'))scopeReads++;});
  await page.goto('#/optidex');await expect(teacherCard).toBeVisible();expect(scopeReads).toBe(0);
  await page.getByLabel('Buscar por nombre o tema').fill('Actividad de clase ficticia');await expect(page.locator('.cartridge')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('ranking automático del grupo y conservación de sesión al navegar',async({page,fixture})=>{
 test.skip(!['pilot-v1','general-v1'].includes(process.env.VITE_INTEGRATED_PROGRESS??''),'Requiere la compilación integrada local.');
 await createStudentIdentity(fixture,'studentA','Persona ficticia',`ux_${crypto.randomUUID().slice(0,8)}`);await loginExisting(page,fixture,'studentA');await page.goto('#/aventura');
 await page.getByText('Ranking de mi grupo',{exact:true}).click();
 await expect(page.locator('.ranking-mini-cards li')).toHaveCount(1);
 await expect(page.locator('.ranking-mini-cards li')).toContainText('Persona ficticia');await expect(page.locator('.ranking-mini-cards li')).toContainText('ux_');
 await expect(page.locator('.group-ranking input[type=checkbox]')).toHaveCount(0);
 await page.goto('#/optidex');await expect(page.locator('.cartridge')).toHaveCount(28);
 await page.goto('#/cuenta');await expect(page.getByText('SESIÓN INICIADA',{exact:true})).toBeVisible();
});
test('el modo de vista previa docente no se activa con una URL manipulada por un alumno',async({page,fixture})=>{
 await createStudentIdentity(fixture,'studentA','Alumno Sin Preview',`nopreview_${crypto.randomUUID().slice(0,8)}`);await loginExisting(page,fixture,'studentA');await page.goto('#/jugar/memorama-simplex?preview=1');await expect(page.getByRole('heading',{name:'Acceso docente requerido'})).toBeVisible();await expect(page.getByText('Vista previa docente: no se registran intentos, progreso, estadísticas ni recompensas.')).toHaveCount(0);await expect(page.locator('.game-player')).toHaveCount(0);
});
for(const [kind,path] of [['Memorama','#/jugar/memorama-simplex?preview=1'],['juego original','#/jugar-original/system-lab?preview=1']] as const){
test(`el preview docente espera la verificación sin registrar actividad (${kind})`,async({page,fixture})=>{
 const uid=fixture.f.actors.teacherA.uid;
 const attempts=async()=>(await fixture.sdk.db.collection(`users/${uid}/reportedAttempts`).get()).docs.map(doc=>doc.data()).sort((a:any,b:any)=>String(a.activityId).localeCompare(String(b.activityId)));
 const progress=async()=>{const snapshot=await fixture.sdk.db.doc(`users/${uid}/progress/current`).get();return snapshot.data()??null;};
 await loginExisting(page,fixture,'teacherA');const before={attempts:await attempts(),progress:await progress()};
 fixture.fault.hold='myScopes';const baseURL=test.info().project.use.baseURL as string;
 await page.goto(`${baseURL}?preview-delay=${Date.now()}${path}`);await fixture.fault.waiting;
 await expect(page.getByRole('heading',{name:'Verificando acceso docente…'})).toBeVisible();
 await expect(page.locator('.game-player,.original-player')).toHaveCount(0);
 await page.waitForTimeout(750);
 expect(await attempts()).toEqual(before.attempts);expect(await progress()).toEqual(before.progress);
 fixture.fault.release();await expect(page.locator('.notice').filter({hasText:'Vista previa docente: no se registran intentos, progreso, estadísticas ni recompensas.'})).toBeVisible({timeout:10000});
 await expect(page.locator('.game-player,.original-player')).toBeVisible();await page.waitForTimeout(1000);
 expect(await attempts()).toEqual(before.attempts);expect(await progress()).toEqual(before.progress);
});
}
test('la profesora juega dentro de OptiLab sin registrar intentos ni recompensas',async({page,fixture})=>{
 const uid=fixture.f.actors.teacherA.uid,before=(await fixture.sdk.db.collection(`users/${uid}/reportedAttempts`).get()).size;
 await loginExisting(page,fixture,'teacherA');await page.goto('#/gimnasio/1');const card=page.locator('.game-grid .cartridge').filter({hasText:'System Catch'});await expect(card).toBeVisible();await card.getByRole('link',{name:/Jugar como docente/}).click();
 await expect(page.locator('.game-player')).toBeVisible();await expect(page.locator('.notice').filter({hasText:'Vista previa docente: no se registran intentos, progreso, estadísticas ni recompensas.'})).toBeVisible();await expect(page.getByRole('heading',{name:'Actividad finalizada'})).toHaveCount(0);
 expect((await fixture.sdk.db.collection(`users/${uid}/reportedAttempts`).get()).size).toBe(before);
});
