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
const day=86400000;
let sdk:EmulatorAdmin,f:Fixtures,service:AcademicService;
const key=()=>crypto.randomUUID();
const s=(group='a'):Scope=>({courseId:f.courseId,termId:f.termId,groupId:f.groups[group as 'a'|'b']});
const actor=(name:string):Actor=>({uid:f.actors[name as keyof Fixtures['actors']].uid,label:name});
const execute=(name:string,operation:string,input:unknown)=>service.execute(actor(name),operation,input);
async function denied(name:string,operation:string,input:unknown) {
  try{await execute(name,operation,input);return 200;}
  catch(error){if(error instanceof ApiError)return error.status;throw error;}
}
async function invite(group='a') {
  return execute(group==='a'?'teacherA':'teacherB','createInvitation',{...s(group),idempotencyKey:key(),expiresInSeconds:3600,maxUses:10,maxPending:10});
}
async function request(inv:Record<string,any>,name='studentA',group='a') {
  return execute(name,'requestMembership',{...s(group),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key()});
}
async function admit(name='studentA',group='a') {
  const inv=await invite(group),req=await request(inv,name,group);
  return execute(group==='a'?'teacherA':'teacherB','approveMembership',{...s(group),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
}
async function profile(name:string,fullName:string,nickname:string) {
  return execute(name,'updateAcademicProfile',{idempotencyKey:key(),expectedVersion:0,fullName,shareGameIdentity:true,
    nickname,avatarId:'avatar-02',companionId:'piv'});
}
async function head(uid:string,epoch=1) {
  const now=Date.now();
  await sdk.db.doc(`users/${uid}/sync/current`).set({schemaVersion:2,uid,epoch,revision:1,operationId:crypto.randomUUID(),
    createdAt:sdk.timestamp(now),updatedAt:sdk.timestamp(now)});
}
async function practice(uid:string,gameId:string,date:number,epoch=1) {
  await sdk.db.doc(`users/${uid}/epochs/${epoch}/fields/practice--${gameId}`).set({schemaVersion:2,uid,epoch,revision:1,
    operationId:crypto.randomUUID(),value:sdk.timestamp(date)});
}
async function run(uid:string,gameId:string,date:number,epoch=1) {
  const runId=crypto.randomUUID();
  await sdk.db.doc(`users/${uid}/epochs/${epoch}/gameRuns/${runId}`).set({schemaVersion:1,uid,trust:'self-reported',
    createdAt:sdk.timestamp(date),date:sdk.timestamp(date),gameId,runId,result:{completed:true}});
}
let attemptSequence=0;
async function attempt(uid:string,activityId:string,kind:'opened'|'declared'|'reported',date:number) {
  const id=`event-${++attemptSequence}`;
  await sdk.db.doc(`users/${uid}/reportedAttempts/${activityId}--${id}`).set({version:1,id,activityId,kind,
    trust:kind==='reported'?'client-report':'declaration',observedAt:new Date(date).toISOString(),uid,serverReceivedAt:sdk.timestamp(date)});
}
before(async()=>{
  const config=localConfig(process.env);sdk=await emulatorAdmin();
  service=new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds);
});
after(async()=>{if(sdk)await sdk.close();});
beforeEach(async()=>{f=await seedFixtures(sdk,password);attemptSequence=0;});
test('teacherA sees active students with unique game counts in the selected period',async()=>{
  await admit('studentA');await admit('studentB');
  await profile('studentA','Alumna Sintética A','Sintetica_A');
  await profile('studentB','Alumno Sintético B','Sintetico_B');
  const now=Date.now(),a=f.actors.studentA.uid,b=f.actors.studentB.uid;
  await head(a);await head(b);
  await attempt(a,'system-lab','opened',now-2*3600000);
  await practice(a,'system-lab',now-3600000);
  await attempt(a,'ruta-de-metas','reported',now-30*60000);
  await run(a,'rompecabezas-simplex',now-3*3600000);
  await attempt(b,'lp-factory','opened',now-5*3600000);
  await attempt(b,'lp-factory','declared',now-4*3600000);
  await run(b,'system-lab',now-6*3600000);
  const result=await execute('teacherA','groupProgress',s());
  assert.equal(result.scope.groupId,f.groups.a);assert.equal(result.period.days,30);assert.ok(result.period.from);assert.equal(result.period.to,result.generatedAt);
  assert.equal(result.studentsTotal,2);assert.equal(result.studentsActive,2);assert.equal(result.truncated,false);
  assert.deepEqual(result.activities,{opened:2,declared:2,reported:3,validated:0});
  const studentA=result.students.find((row:any)=>row.uid===a),studentB=result.students.find((row:any)=>row.uid===b);
  assert.equal(studentA.name,'Alumna Sintética A');assert.equal(studentA.email,f.actors.studentA.email);assert.equal(studentA.emailVerified,true);assert.equal(studentA.gamertag,'Sintetica_A');
  assert.equal(studentA.opened,1);assert.equal(studentA.declared,1);assert.equal(studentA.reported,2);assert.equal(studentA.validated,0);
  assert.equal(studentA.practicedGames,1);assert.equal(studentA.completedGames,2);assert.equal(studentA.lastActivityAt,new Date(now-30*60000).toISOString());
  assert.equal(studentB.opened,1);assert.equal(studentB.declared,1);assert.equal(studentB.reported,1);assert.equal(studentB.lastActivityAt,new Date(now-4*3600000).toISOString());
  const gym=(row:any,gymId:number)=>row.gyms.find((entry:any)=>entry.gymId===gymId);
  assert.deepEqual(gym(studentA,1),{gymId:1,opened:1,declared:1,reported:0});
  assert.deepEqual(gym(studentA,3),{gymId:3,opened:0,declared:0,reported:1});
  assert.deepEqual(gym(studentA,5),{gymId:5,opened:0,declared:0,reported:1});
  assert.deepEqual(gym(studentB,1),{gymId:1,opened:0,declared:0,reported:1});
  assert.deepEqual(gym(studentB,2),{gymId:2,opened:1,declared:1,reported:0});
  const groupGym=(gymId:number)=>result.gyms.find((entry:any)=>entry.gymId===gymId);
  assert.equal(groupGym(1).totalGames,5);assert.equal(groupGym(2).totalGames,8);assert.equal(groupGym(3).totalGames,5);assert.equal(groupGym(4).totalGames,5);assert.equal(groupGym(5).totalGames,5);
  assert.deepEqual(groupGym(1),{gymId:1,title:'Bosque de Sistemas',totalGames:5,opened:1,practiced:1,completed:1});
  assert.deepEqual(groupGym(2),{gymId:2,title:'Valle Lineal',totalGames:8,opened:1,practiced:1,completed:0});
});
test('students, foreign teachers and outsiders are denied and other groups stay isolated',async()=>{
  await admit('studentA','a');await admit('studentB','b');
  for(const name of ['studentA','teacherB','studentC'])assert.equal(await denied(name,'groupProgress',s('a')),403);
  assert.equal(await denied('teacherA','groupProgress',s('b')),403);
  const a=await execute('teacherA','groupProgress',s('a')),b=await execute('teacherB','groupProgress',s('b'));
  assert.equal(a.studentsTotal,1);assert.equal(a.students[0].uid,f.actors.studentA.uid);
  assert.equal(b.studentsTotal,1);assert.equal(b.students[0].uid,f.actors.studentB.uid);
});
test('revoking membership removes the student from group progress without deleting personal activity',async()=>{
  const approved=await admit('studentA','a'),uid=f.actors.studentA.uid;
  await head(uid);await practice(uid,'system-lab',Date.now()-3600000);
  await execute('teacherA','revokeMembership',{...s('a'),uid,expectedVersion:approved.version,idempotencyKey:key()});
  const result=await execute('teacherA','groupProgress',s('a'));
  assert.equal(result.studentsTotal,0);assert.deepEqual(result.students,[]);
  assert.deepEqual(result.activities,{opened:0,declared:0,reported:0,validated:0});
  assert.ok((await sdk.db.doc(`users/${uid}/epochs/1/fields/practice--system-lab`).get()).exists);
});
test('periodDays includes and excludes dated activity while zero means all time',async()=>{
  await admit('studentA','a');
  const uid=f.actors.studentA.uid,now=Date.now();
  await head(uid);
  await practice(uid,'system-lab',now-3600000);
  await practice(uid,'lp-factory',now-10*day);
  await attempt(uid,'ruta-de-metas','opened',now-20*day);
  await attempt(uid,'ahorcado-simplex','reported',now-40*day);
  const recent=await execute('teacherA','groupProgress',{...s('a'),periodDays:2});
  assert.equal(recent.period.days,2);assert.ok(Date.parse(recent.period.from!)>now-3*day);
  assert.equal(recent.students[0].declared,1);assert.equal(recent.students[0].opened,0);assert.equal(recent.students[0].reported,0);
  assert.deepEqual(recent.activities,{opened:0,declared:1,reported:0,validated:0});
  const all=await execute('teacherA','groupProgress',{...s('a'),periodDays:0});
  assert.equal(all.period.days,0);assert.equal(all.period.from,null);
  assert.equal(all.students[0].declared,2);assert.equal(all.students[0].opened,1);assert.equal(all.students[0].reported,1);
  assert.deepEqual(all.activities,{opened:1,declared:2,reported:1,validated:0});
  assert.equal(await denied('teacherA','groupProgress',{...s('a'),periodDays:366}),400);
});
test('missing or malformed progress documents leave an empty activity without crashing',async()=>{
  await admit('studentA','a');await admit('studentB','a');
  const a=f.actors.studentA.uid,b=f.actors.studentB.uid;
  await sdk.db.doc(`users/${a}/sync/current`).delete();
  await sdk.db.doc(`users/${b}/sync/current`).set({schemaVersion:2,uid:b,epoch:'incompatible'});
  await sdk.db.doc(`users/${b}/epochs/1/fields/practice--system-lab`).set({value:'not-a-timestamp'});
  const result=await execute('teacherA','groupProgress',s('a'));
  assert.equal(result.studentsTotal,2);assert.equal(result.studentsActive,0);assert.equal(result.truncated,false);
  for(const student of result.students){assert.equal(student.lastActivityAt,null);assert.equal(student.opened,0);assert.equal(student.declared,0);assert.equal(student.reported,0);}
  assert.deepEqual(result.activities,{opened:0,declared:0,reported:0,validated:0});
});
