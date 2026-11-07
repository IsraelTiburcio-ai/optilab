import {test,expect,loginExisting,createStudentIdentity,acceptCloud} from './fixtures';
import {serveMemorama,playMemorama} from './gameHelpers';
test.use({actionTimeout:15000});
test.skip(process.env.INTEGRATED_QA!=='1','La suite ordinaria verifica Sync integrado OFF; esta suite requiere activación demo explícita.');
test('flujo integral: Memorama, siguiente visible, dos clientes, docente, participación y deduplicación',async({page,fixture,browser})=>{
 test.setTimeout(180000);await page.setViewportSize({width:390,height:844});const id=()=>crypto.randomUUID(),scope=fixture.scope(),uid=fixture.f.actors.studentA.uid;
 const gamertag='demo_'+id().slice(0,8);await createStudentIdentity(fixture,'studentA','Adulto ficticio integral',gamertag);
 const expiry=fixture.sdk.timestamp(Date.now()+3600000);await fixture.sdk.db.doc('syncPilotControl/current').set({version:1,readsEnabled:true,writesEnabled:true,expiresAt:expiry});await fixture.sdk.db.doc(`syncPilotMembers/${uid}`).set({version:1,uid,status:'active',expiresAt:expiry});
 const config=await fixture.call('teacherA','configureParticipation',{...scope,enabled:true,expectedVersion:0,idempotencyKey:id()});expect(config.status).toBe(200);
 const draft=await fixture.call('teacherA','saveActivityDraft',{...scope,groupIds:[scope.groupId],gymId:3,provider:'learningapps',resourceId:'pznycxd7t21',sourceUrl:'https://learningapps.org/watch?v=pznycxd7t21',embedUrl:'https://learningapps.org/show.php?id=pznycxd7t21',title:'Actividad siguiente ficticia',description:'',instructions:'',idempotencyKey:id()});expect(draft.status).toBe(200);
 expect((await fixture.call('teacherA','publishActivities',{...scope,groupIds:[scope.groupId],activityId:draft.body.activityId,expectedVersion:1,idempotencyKey:id()})).status).toBe(200);
 const workspace=(await fixture.call('teacherA','activityWorkspace',scope)).body,layout=workspace.layouts.find((l:any)=>l.gymId===3);const ordered=['memorama-simplex',draft.body.activityId,...layout.orderedActivityIds.filter((id:string)=>id!=='memorama-simplex'&&id!==draft.body.activityId)];expect((await fixture.call('teacherA','saveGymLayout',{...scope,gymId:3,orderedActivityIds:ordered,hiddenOriginalGameIds:[],expectedVersion:layout.revision,externalVisibility:[],idempotencyKey:id()})).status).toBe(200);
 await serveMemorama(page.context());await loginExisting(page,fixture,'studentA');await acceptCloud(page);
 await expect(page.getByRole('region',{name:'Sincronización de intentos'})).toContainText('synced');
 await playMemorama(page,'#/jugar/memorama-simplex?'+new URLSearchParams(scope));
 await expect(page.getByRole('heading',{name:'¡Actividad finalizada!'})).toBeVisible();await expect(page.getByRole('link',{name:'Siguiente actividad',exact:true})).toHaveAttribute('href',`#/grupo/${scope.courseId}/${scope.termId}/${scope.groupId}/actividad/${draft.body.activityId}`);
 // Resolve the currently authorized order, never guess a public fallback for a group.
 const published=(await fixture.call('studentA','publishedGroupActivities',scope)).body;const gym=published.gyms.find((g:any)=>g.gymId===3);expect(gym).toBeTruthy();
 await expect.poll(async()=>{const rows=await fixture.sdk.db.collection(`users/${uid}/reportedAttempts`).get();return rows.docs.filter(d=>d.data().activityId==='memorama-simplex'&&d.data().kind==='reported').length;}).toBe(1);
 await expect.poll(async()=>{const row=await fixture.sdk.db.doc(`courses/${scope.courseId}/terms/${scope.termId}/groups/${scope.groupId}/participation/${uid}`).get();return row.data()?.activities?.['memorama-simplex']?.completed;}).toBe(true);
 const saved=await fixture.sdk.db.collection(`users/${uid}/reportedAttempts`).get();expect(saved.docs.find(d=>d.data().kind==='opened')?.data().context).toEqual(scope);
 await page.goto('#/aventura');await page.getByText('Ver participación del grupo',{exact:true}).click();await expect(page.getByRole('checkbox',{name:/Participar y compartir/})).toHaveCount(0);await expect(page.locator('.group-ranking ol li')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

 const report=(await fixture.call('teacherA','groupProgress',{...scope,periodDays:0})).body;expect(report.students.find((s:any)=>s.uid===uid)).toMatchObject({completedGames:1,practicedGames:1,validated:0,pendingGames:27});
 await expect.poll(async()=>(await fixture.call('teacherA','groupRanking',scope)).body.rows[0]?.participation,{timeout:15000}).toBe(1);const ranking=(await fixture.call('teacherA','groupRanking',scope)).body;expect(ranking.rows).toHaveLength(1);expect(ranking.rows[0]).toMatchObject({participation:1,position:1});expect(JSON.stringify(ranking)).not.toContain(uid);
 expect((await fixture.call('teacherB','groupRanking',scope)).status).toBe(403);
 await page.reload();await expect(page.locator('#nickname')).not.toHaveValue('Entrenador OptiLab');
 const head=(await fixture.sdk.db.doc(`users/${uid}/sync/current`).get()).data()!;for(const [field,value] of Object.entries({avatarId:'avatar-02',companionId:'piv'})){expect((await fixture.sdk.db.doc(`users/${uid}/epochs/${head.epoch}/fields/${field}`).get()).data()?.value).toBe(value);}
 const other=await browser.newContext({baseURL:test.info().project.use.baseURL as string});await fixture.attach(other);
 try{const second=await other.newPage();await loginExisting(second,fixture,'studentA');await acceptCloud(second);await second.goto('#/optidex');const game=second.locator('.cartridge').filter({hasText:'Memorama Simplex'});await expect(game.getByRole('button',{name:'Practicado · desmarcar',exact:true})).toBeVisible();await second.reload();await expect(game.getByRole('button',{name:'Practicado · desmarcar',exact:true})).toBeVisible();}finally{await other.close();}
 const attempts=await fixture.sdk.db.collection(`users/${uid}/reportedAttempts`).get();expect(attempts.docs.filter(d=>d.data().activityId==='memorama-simplex'&&d.data().kind==='reported')).toHaveLength(1);
 await page.goto('#/aventura');await page.getByText('Ver participación del grupo',{exact:true}).click();await expect(page.locator('.group-ranking ol li')).toHaveCount(1);await expect.poll(async()=>(await fixture.call('teacherA','groupRanking',scope)).body.rows.length).toBe(1);
});
