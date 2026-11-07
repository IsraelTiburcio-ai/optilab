import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {emulatorAdmin,type EmulatorAdmin} from '../../server/academic/sdk';
import {localConfig} from '../../server/academic/config';
import {seedFixtures,type Fixtures} from '../../server/academic/bootstrap';
import {AcademicRepository} from '../../server/academic/repository';
import {AcademicService} from '../../server/academic/service';
import {ApiError} from '../../server/academic/errors';
import type {Actor,Scope} from '../../server/academic/contracts';
import {publishedGroupActivities} from '../../server/academic/activities';
import {catalogGames} from '../../server/academic/catalog';

const password='fixture-password-123';
let sdk:EmulatorAdmin,f:Fixtures,service:AcademicService;
const key=()=>crypto.randomUUID();
const s=(group='a'):Scope=>({courseId:f.courseId,termId:f.termId,groupId:f.groups[group as 'a'|'b']});
const actor=(name:string):Actor=>({uid:f.actors[name as keyof Fixtures['actors']].uid,label:name});
const execute=(name:string,operation:string,input:unknown)=>service.execute(actor(name),operation,input);
const status=async(name:string,operation:string,input:unknown)=>{try{await execute(name,operation,input);return 200;}catch(e){if(e instanceof ApiError)return e.status;throw e;}};
const wordwall={provider:'wordwall',resourceId:'cc167dda64954e3dbb379706dd8348c8',
  sourceUrl:'https://wordwall.net/resource/22610275/metodo-de-m-grande',
  embedUrl:'https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0'};
const learningapps={provider:'learningapps',resourceId:'pznycxd7t21',
  sourceUrl:'https://learningapps.org/watch?v=pznycxd7t21',embedUrl:'https://learningapps.org/show.php?id=pznycxd7t21'};
async function invite(group='a'){return execute(group==='a'?'teacherA':'teacherB','createInvitation',{...s(group),idempotencyKey:key(),expiresInSeconds:3600,maxUses:10,maxPending:10});}
async function request(inv:Record<string,any>,name='studentA',group='a'){return execute(name,'requestMembership',{...s(group),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key()});}
async function admit(name='studentA',group='a'){const inv=await invite(group),req=await request(inv,name,group);return execute(group==='a'?'teacherA':'teacherB','approveMembership',{...s(group),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});}
const input=(extra:Record<string,unknown>={})=>({...s('a'),groupIds:[f.groups.a],gymId:3,title:'Actividad sintética',description:'Descripción',instructions:'Instrucciones',idempotencyKey:key(),...extra});
const saved=async(extra:Record<string,unknown>={},name='teacherA')=>execute(name,'saveActivityDraft',input(extra));

before(async()=>{const config=localConfig(process.env);sdk=await emulatorAdmin();service=new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds);});
after(async()=>{if(sdk)await sdk.close();});
beforeEach(async()=>{f=await seedFixtures(sdk,password);});

test('docente crea borrador Wordwall, previsualiza datos, publica y el alumno lo ve',async()=>{
  await admit('studentA','a');
  const draft=await saved(wordwall);
  assert.equal(draft.status,'draft');assert.equal(draft.revision,1);assert.match(draft.activityId,/^a_[0-9a-f]{32}$/);
  const audit=await sdk.db.doc(`academicAudit/${draft.commandId}`).get();
  assert.equal(audit.exists,true);
  const workspace=await execute('teacherA','activityWorkspace',s('a'));
  assert.equal(workspace.definitions.length,1);assert.equal(workspace.assignments.length,1);assert.equal(workspace.assignments[0].status,'draft');
  const before=await execute('studentA','publishedGroupActivities',s('a'));
  assert.equal(before.gyms.flatMap((g:any)=>g.activities).length,0);
  const published=await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  assert.equal(published.status,'published');
  const after=await execute('studentA','publishedGroupActivities',s('a'));
  const row=after.gyms.find((g:any)=>g.gymId===3).activities[0];
  assert.equal(row.title,'Actividad sintética');assert.equal(row.provider,'wordwall');assert.equal(row.revision,1);
  assert.equal((await execute('studentA','publishedActivity',{...s('a'),activityId:draft.activityId})).embedUrl,wordwall.embedUrl);
});

test('Wordwall sin embed se publica como apertura externa segura',async()=>{
  await admit('studentA','a');
  const external={provider:'wordwall',resourceId:'22610275',sourceUrl:'https://wordwall.net/es/resource/22610275/metodo-de-m-grande',embedUrl:null};
  const draft=await saved({...external,title:'Wordwall externa'});
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  const row=(await execute('studentA','publishedGroupActivities',s('a'))).gyms.find((g:any)=>g.gymId===3).activities[0];
  assert.equal(row.embedUrl,null);assert.equal(row.sourceUrl,external.sourceUrl);
  assert.equal((await execute('studentA','publishedActivity',{...s('a'),activityId:draft.activityId})).embedUrl,null);
});
test('el editor visual guarda orden y visibilidad de originales y externas por grupo',async()=>{
  await admit('studentA','a');
  const draft=await saved({...wordwall,title:'Externa ordenada'});
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  const workspace=await execute('teacherA','activityWorkspace',s('a')),layout=workspace.layouts.find((row:any)=>row.gymId===3);
  const originals=catalogGames.filter(game=>game.gymId===3).map(game=>game.gameId),hidden=originals[0];
  assert.ok(layout.orderedActivityIds.includes(draft.activityId));
  assert.ok(originals.every(id=>layout.orderedActivityIds.includes(id)));
  const ordered=[draft.activityId,...originals.filter(id=>id!==hidden).reverse(),hidden];
  await execute('teacherA','saveGymLayout',{...s('a'),gymId:3,orderedActivityIds:ordered,hiddenOriginalGameIds:[hidden],expectedVersion:layout.revision,idempotencyKey:key()});
  const student=await execute('studentA','publishedGroupActivities',s('a')),studentLayout=student.gyms.find((gym:any)=>gym.gymId===3).layout;
  assert.deepEqual(studentLayout.orderedActivityIds,ordered);assert.deepEqual(studentLayout.hiddenOriginalGameIds,[hidden]);
  assert.deepEqual(student.gyms.find((gym:any)=>gym.gymId===3).activities.map((row:any)=>row.activityId),[draft.activityId]);
  assert.equal(await status('studentA','saveGymLayout',{...s('a'),gymId:3,orderedActivityIds:ordered,hiddenOriginalGameIds:[],expectedVersion:1,idempotencyKey:key()}),403);
});
test('asigna una definición a dos grupos, permite gimnasios distintos y aísla docentes/alumnos',async()=>{
  await admit('studentA','a');await admit('studentB','b');
  const draft=await saved({...wordwall,groupIds:[f.groups.a,f.groups.b]},'teacherBoth');
  await execute('teacherBoth','publishActivities',{...s('a'),groupIds:[f.groups.a,f.groups.b],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  assert.equal(await status('teacherB','activityWorkspace',s('a')),403);
  assert.equal(await status('teacherA','publishedGroupActivities',s('a')),403);
  const a=await execute('studentA','publishedGroupActivities',s('a')),b=await execute('studentB','publishedGroupActivities',s('b'));
  assert.equal(a.gyms.find((g:any)=>g.gymId===3).activities[0].activityId,draft.activityId);
  assert.equal(b.gyms.find((g:any)=>g.gymId===3).activities[0].activityId,draft.activityId);
  const workspaceB=await execute('teacherBoth','activityWorkspace',s('b')),assignmentB=workspaceB.assignments[0];
  const moved=await execute('teacherBoth','moveActivity',{...s('b'),activityId:draft.activityId,gymId:1,expectedVersion:assignmentB.revision,idempotencyKey:key()});
  assert.equal(moved.gymId,1);
  const b2=await execute('studentB','publishedGroupActivities',s('b'));
  assert.equal(b2.gyms.find((g:any)=>g.gymId===1).activities[0].activityId,draft.activityId);
  assert.equal(b2.gyms.find((g:any)=>g.gymId===3).activities.length,0);
});

test('ordena por grupo/gimnasio, detecta CAS obsoleto y conserva el orden tras recargar',async()=>{
  const a=await saved({...wordwall,title:'Primera'},'teacherA');
  const b=await saved({...learningapps,title:'Segunda'},'teacherA');
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:a.activityId,expectedVersion:1,idempotencyKey:key()});
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:b.activityId,expectedVersion:1,idempotencyKey:key()});
  const ws=await execute('teacherA','activityWorkspace',s('a'));
  const placement=ws.placements.find((p:any)=>p.gymId===3);assert.deepEqual(placement.orderedActivityIds,[a.activityId,b.activityId]);
  assert.deepEqual(ws.layouts.find((p:any)=>p.gymId===3).orderedActivityIds.filter((id:string)=>id.startsWith('a_')),[a.activityId,b.activityId]);
  const reordered=await execute('teacherA','reorderActivities',{...s('a'),gymId:3,orderedActivityIds:[b.activityId,a.activityId],expectedVersion:placement.revision,idempotencyKey:key()});
  assert.equal(reordered.count,2);
  assert.equal(await status('teacherA','reorderActivities',{...s('a'),gymId:3,orderedActivityIds:[a.activityId,b.activityId],expectedVersion:placement.revision,idempotencyKey:key()}),409);
  const reloaded=await execute('teacherA','activityWorkspace',s('a'));
  assert.deepEqual(reloaded.placements.find((p:any)=>p.gymId===3).orderedActivityIds,[b.activityId,a.activityId]);
});

test('oculta, reactiva y archiva sin borrar la revisión histórica',async()=>{
  await admit('studentA','a');const draft=await saved({...wordwall});
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  const ws=await execute('teacherA','activityWorkspace',s('a')),assignment=ws.assignments[0];
  await execute('teacherA','setActivityStatus',{...s('a'),activityId:draft.activityId,status:'hidden',expectedVersion:assignment.revision,idempotencyKey:key()});
  assert.equal((await execute('studentA','publishedGroupActivities',s('a'))).gyms.flatMap((g:any)=>g.activities).length,0);
  assert.equal(await status('studentA','publishedActivity',{...s('a'),activityId:draft.activityId}),404);
  const hidden=await execute('teacherA','activityWorkspace',s('a'));
  assert.equal(hidden.assignments[0].status,'hidden');
  assert.equal((await sdk.db.doc(`courses/${f.courseId}/activities/${draft.activityId}/revisions/1`).get()).exists,true);
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  assert.equal((await execute('studentA','publishedGroupActivities',s('a'))).gyms.flatMap((g:any)=>g.activities).length,1);
  const active=await execute('teacherA','activityWorkspace',s('a'));
  await execute('teacherA','setActivityStatus',{...s('a'),activityId:draft.activityId,status:'archived',expectedVersion:active.assignments[0].revision,idempotencyKey:key()});
  assert.equal((await execute('teacherA','activityWorkspace',s('a'))).assignments[0].status,'archived');
  assert.equal(await status('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()}),409);
});

test('rechaza URLs y proveedores no permitidos y exige idempotencia',async()=>{
  assert.equal(await status('teacherA','saveActivityDraft',input({...wordwall,sourceUrl:'https://evil.example/watch?v=cc167dda64954e3dbb379706dd8348c8'})),400);
  assert.equal(await status('teacherA','saveActivityDraft',input({...wordwall,provider:'other'})),400);
  assert.equal(await status('teacherA','saveActivityDraft',input({...learningapps,embedUrl:'https://learningapps.org/show.php?id=other'})),400);
  const payload=input({...wordwall,idempotencyKey:'stable-key-1234567890'});
  const first=await execute('teacherA','saveActivityDraft',payload);
  const replay=await execute('teacherA','saveActivityDraft',payload);
  assert.equal(replay.replayed,true);assert.equal(replay.activityId,first.activityId);
  assert.equal((await execute('teacherA','activityWorkspace',s('a'))).definitions.length,1);
});
test('revocar la matrícula corta el acceso del alumno sin borrar la revisión publicada',async()=>{
  const approved=await admit('studentB','a');const draft=await saved({...wordwall},'teacherA');
  await execute('teacherA','publishActivities',{...s('a'),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  assert.equal((await execute('studentB','publishedGroupActivities',s('a'))).gyms.flatMap((g:any)=>g.activities).length,1);
  await execute('teacherA','revokeMembership',{...s('a'),uid:f.actors.studentB.uid,expectedVersion:approved.version,idempotencyKey:key()});
  assert.equal(await status('studentB','publishedGroupActivities',s('a')),403);
  assert.equal((await sdk.db.doc(`courses/${f.courseId}/activities/${draft.activityId}/revisions/1`).get()).exists,true);
});
test('cada grupo conserva su propio orden aunque comparta la misma definición',async()=>{
  await admit('studentA','a');await admit('studentB','b');
  const first=await saved({...wordwall,groupIds:[f.groups.a,f.groups.b]},'teacherBoth');
  const second=await saved({...learningapps,groupIds:[f.groups.a,f.groups.b]},'teacherBoth');
  for(const id of [first.activityId,second.activityId])await execute('teacherBoth','publishActivities',{...s('a'),groupIds:[f.groups.a,f.groups.b],activityId:id,expectedVersion:1,idempotencyKey:key()});
  const a=await execute('teacherBoth','activityWorkspace',s('a')),b=await execute('teacherBoth','activityWorkspace',s('b'));
  const placementA=a.placements.find((p:any)=>p.gymId===3),placementB=b.placements.find((p:any)=>p.gymId===3);
  assert.deepEqual(placementA.orderedActivityIds,[first.activityId,second.activityId]);
  await execute('teacherBoth','reorderActivities',{...s('b'),gymId:3,orderedActivityIds:[second.activityId,first.activityId],expectedVersion:placementB.revision,idempotencyKey:key()});
  assert.deepEqual((await execute('teacherBoth','activityWorkspace',s('a'))).placements.find((p:any)=>p.gymId===3).orderedActivityIds,[first.activityId,second.activityId]);
  assert.deepEqual((await execute('studentB','publishedGroupActivities',s('b'))).gyms.find((g:any)=>g.gymId===3).activities.map((x:any)=>x.activityId),[second.activityId,first.activityId]);
});
test('un docente de otro grupo no puede secuestrar una definición ajena',async()=>{
  const draft=await saved({...wordwall},'teacherA');
  const response=await status('teacherB','saveActivityDraft',{...s('b'),groupIds:[f.groups.b],activityId:draft.activityId,expectedVersion:1,...wordwall,title:'Secuestro',description:'',instructions:'',gymId:1,idempotencyKey:key()});
  assert.equal(response,403);
  assert.equal((await execute('teacherA','activityWorkspace',s('a'))).definitions[0].title,'Actividad sintética');
});

test('guardado atómico, CAS externo, idempotencia, aislamiento e historial intacto',async()=>{
  await admit('studentA','a');await admit('studentB','b');
  const draft=await saved(wordwall);
  await execute('teacherA','publishActivities',{...s(),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  const ws=await execute('teacherA','activityWorkspace',s()),layout=ws.layouts.find((l:any)=>l.gymId===3),a=ws.assignments[0];
  const historyPath=`users/${f.actors.studentA.uid}/reportedAttempts/untouched`,history={synthetic:true,score:6};await sdk.db.doc(historyPath).set(history);
  const payload={...s(),gymId:3,orderedActivityIds:[...layout.orderedActivityIds].reverse(),hiddenOriginalGameIds:[layout.orderedActivityIds[0]],expectedVersion:layout.revision,
    externalVisibility:[{activityId:a.activityId,expectedVersion:a.revision,visible:false}],idempotencyKey:key()};
  assert.equal(await status('teacherB','saveGymLayout',payload),403);
  assert.equal(await status('studentA','saveGymLayout',payload),403);
  assert.equal(await status('teacherA','saveGymLayout',{...payload,externalVisibility:[{...payload.externalVisibility[0],expectedVersion:999}]}),409);
  assert.deepEqual((await execute('teacherA','activityWorkspace',s())).layouts.find((l:any)=>l.gymId===3),layout);
  const result=await execute('teacherA','saveGymLayout',payload);assert.equal(result.revision,1);
  assert.equal((await execute('teacherA','saveGymLayout',payload)).replayed,true);
  assert.equal(await status('studentA','publishedActivity',{...s(),activityId:a.activityId}),404);
  const visible=await execute('studentA','publishedGroupActivities',s());assert.equal(visible.gyms[2].activities.length,0);
  assert.deepEqual(visible.gyms[2].layout.hiddenOriginalGameIds,payload.hiddenOriginalGameIds);
  assert.deepEqual((await sdk.db.doc(historyPath).get()).data(),history);
  assert.equal((await execute('studentB','publishedGroupActivities',s('b'))).gyms[2].layout.revision,0);
  assert.equal((await sdk.db.doc(`courses/${f.courseId}/activities/${a.activityId}/revisions/1`).get()).exists,true);
  assert.equal(await status('teacherA','saveGymLayout',{...payload,idempotencyKey:key()}),409);
  const latest=await execute('teacherA','activityWorkspace',s());
  await execute('teacherA','saveGymLayout',{...payload,expectedVersion:1,idempotencyKey:key(),externalVisibility:[{activityId:a.activityId,expectedVersion:latest.assignments[0].revision,visible:true}]});
  assert.equal((await execute('studentA','publishedActivity',{...s(),activityId:a.activityId})).revision,1);
});
test('dos docentes concurrentes no sobrescriben un layout',async()=>{
  const ws=await execute('teacherA','activityWorkspace',s()),layout=ws.layouts[2];
  const payload={...s(),gymId:3,orderedActivityIds:layout.orderedActivityIds,hiddenOriginalGameIds:[],externalVisibility:[],expectedVersion:0};
  const results=await Promise.allSettled(['teacherA','teacherBoth'].map(name=>execute(name,'saveGymLayout',{...payload,idempotencyKey:key()})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
});
test('consulta asignaciones paginadas una vez por grupo y conserva las cinco proyecciones',async()=>{
  await admit('studentA','a');const draft=await saved(learningapps);
  await execute('teacherA','publishActivities',{...s(),groupIds:[f.groups.a],activityId:draft.activityId,expectedVersion:1,idempotencyKey:key()});
  const base=`courses/${f.courseId}`,group=`${base}/terms/${f.termId}/groups/${f.groups.a}`;
  const def=(await sdk.db.doc(`${base}/activities/${draft.activityId}`).get()).data()!,rev=(await sdk.db.doc(`${base}/activities/${draft.activityId}/revisions/1`).get()).data()!,assignment=(await sdk.db.doc(`${group}/groupActivities/${draft.activityId}`).get()).data()!;
  const batch=sdk.db.batch();for(let i=0;i<54;i++){
    const activityId=`a_${String(i).padStart(32,'0')}`;
    batch.set(sdk.db.doc(`${base}/activities/${activityId}`),{...def,activityId});
    batch.set(sdk.db.doc(`${base}/activities/${activityId}/revisions/1`),{...rev,activityId});
    batch.set(sdk.db.doc(`${group}/groupActivities/${activityId}`),{...assignment,activityId,gymId:i%5+1,displayOrder:i});
  }await batch.commit();
  const repo=new AcademicRepository(sdk.db);let returned=-1;
  const result=await repo.measure(()=>publishedGroupActivities(repo,f.actors.studentA,s()),m=>{returned=m.queryDocumentsReturned;});
  assert.equal(returned,55);assert.equal(result.gyms.flatMap((g:any)=>g.activities).length,55);
  const ws=await execute('teacherA','activityWorkspace',s());assert.equal(ws.assignments.length,55);assert.equal(ws.definitions.length,55);
});
