import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {emulatorAdmin,type EmulatorAdmin} from '../../server/academic/sdk';
import {localConfig} from '../../server/academic/config';
import {seedFixtures,type Fixtures} from '../../server/academic/bootstrap';
import {AcademicRepository} from '../../server/academic/repository';
import {AcademicService} from '../../server/academic/service';
import {ApiError} from '../../server/academic/errors';
import type {Actor,Scope} from '../../server/academic/contracts';

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
