import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import type {Server} from 'node:http';
import {Socket} from 'node:net';
import {spawn} from 'node:child_process';
import {emulatorAdmin,type EmulatorAdmin} from '../../server/academic/sdk';
import {localConfig} from '../../server/academic/config';
import {seedFixtures,revokeFixtureTeacher,alterFixture,fixtureStoresSecret,type Fixtures} from '../../server/academic/bootstrap';
import {AcademicRepository,groupPath,type Metrics} from '../../server/academic/repository';
import {AcademicService} from '../../server/academic/service';
import {httpServer} from '../../server/academic/http';
import type {Operation,Actor,Scope} from '../../server/academic/contracts';
const password='fixture-password-123';
let sdk:EmulatorAdmin,server:Server,base:string,f:Fixtures;
let tokens:Record<string,string>,revokeNext:string|null=null;
let measurements:{operation:string;metrics:Metrics}[]=[];
const budgetSamples=new Map<string,Metrics>();
const originalConnect=Socket.prototype.connect;let nonLoopbackAttempts=0;
// Covers Admin SDK initialization, Auth verification, HTTP clients and gRPC.
Socket.prototype.connect=function(...args:any[]) {
  const first=Array.isArray(args[0])?args[0][0]:args[0];
  const host=typeof first==='object'&&first?(first.host??first.hostname):typeof args[1]==='string'?args[1]:'localhost';
  if(host&&!['127.0.0.1','localhost','::1'].includes(host)){nonLoopbackAttempts++;throw new Error('NON_LOOPBACK_NETWORK_FORBIDDEN');}
  return Reflect.apply(originalConnect,this,args) as Socket;
} as typeof originalConnect;
const key=()=>crypto.randomUUID();
const s=(group='a'):Scope=>({courseId:f.courseId,termId:f.termId,groupId:f.groups[group as 'a'|'b']});
async function signIn(email:string) {
  const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  assert.equal(response.status,200);return (await response.json()).idToken as string;
}
async function call(actor:string,op:string,input:unknown,url=base) {
  const response=await fetch(`${url}/v1/${op}`,{method:'POST',headers:{'Content-Type':'application/json',...(tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`}:{})},body:JSON.stringify(input)});
  return {status:response.status,body:await response.json()};
}
async function ok(actor:string,op:string,input:unknown,url=base) {
  const result=await call(actor,op,input,url);assert.equal(result.status,200,`Expected success for ${op}, got ${result.status}`);return result.body;
}
async function invite(group='a',extra:Record<string,unknown>={}) {
  return ok(group==='a'?'teacherA':'teacherB','createInvitation',{...s(group),idempotencyKey:key(),expiresInSeconds:3600,maxUses:10,maxPending:10,...extra});
}
async function request(inv:Record<string,any>,actor='studentA',group='a',extra:Record<string,unknown>={}) {
  return ok(actor,'requestMembership',{...s(group),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key(),...extra});
}
async function admit(actor='studentA',group='a') {
  const inv=await invite(group),req=await request(inv,actor,group);
  return ok(group==='a'?'teacherA':'teacherB','approveMembership',{...s(group),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
}
before(async()=>{
  const config=localConfig(process.env);sdk=await emulatorAdmin();
  const service=new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds,{afterPreflight:async(op:Operation,actor:Actor)=>{
    if(op==='approveMembership'&&actor.uid===revokeNext){revokeNext=null;await revokeFixtureTeacher(sdk,f,actor.uid);}
  },onMetrics:(operation,metrics)=>{measurements.push({operation,metrics});
    const previous=budgetSamples.get(operation);if(!previous||metrics.committedWrites>previous.committedWrites)budgetSamples.set(operation,metrics);
  }});
  server=httpServer(config,sdk,service);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
after(async()=>{try{if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(sdk)await sdk.close();}
  finally{Socket.prototype.connect=originalConnect;assert.equal(nonLoopbackAttempts,0);}
  console.info('ACADEMIC_LOCAL_METRICS',JSON.stringify(Object.fromEntries(budgetSamples)));
});
beforeEach(async()=>{
  f=await seedFixtures(sdk,password);tokens={};revokeNext=null;measurements=[];
  for(const [name,actor] of Object.entries(f.actors))tokens[name]=await signIn(actor.email);
});
test('valid request, required approval, v1 grants and own memberships',async()=>{
  const inv=await invite();assert.equal(Buffer.from(inv.token,'base64url').length,32);
  const req=await request(inv);
  assert.equal((await ok('teacherA','groupRequests',{...s(),status:'pending'})).items[0].requestId,req.requestId);
  assert.equal((await call('studentA','groupRequests',{...s(),status:'pending'})).status,403);
  assert.equal((await ok('studentA','requestStatus',{...s(),requestId:req.requestId})).membershipStatus,'none');
  await ok('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
  const own=await ok('studentA','myScopes',{kind:'student'});assert.equal(own.items.length,1);assert.equal(own.items[0].status,'active');
  const roster=await ok('teacherA','roster',s());assert.equal(roster.items.length,1);assert.equal(roster.items[0].uid,f.actors.studentA.uid);
  assert.equal((await ok('teacherA','groupRequests',{...s(),status:'pending'})).items.length,0);
});
test('wrong, expired, revoked and exhausted invitations share one generic response',async()=>{
  const wrong=await invite(),expired=await invite('a',{expiresInSeconds:1}),revoked=await invite(),full=await invite('a',{maxUses:1});
  await ok('teacherA','revokeInvitation',{...s(),inviteId:revoked.inviteId,expectedVersion:1,idempotencyKey:key()});
  const req=await request(full);await ok('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
  await new Promise(r=>setTimeout(r,1100));
  for(const [inv,token] of [[wrong,'A'.repeat(43)],[expired,expired.token],[revoked,revoked.token],[full,full.token]]) {
    const result=await call('studentB','requestMembership',{...s(),inviteId:inv.inviteId,token,idempotencyKey:key()});
    assert.equal(result.status,404);assert.equal(result.body.error.code,'INVITATION_UNAVAILABLE');
  }
});
test('concurrent requests reserve pending slots transactionally and same UID never double-counts',async()=>{
  const inv=await invite('a',{maxPending:1});
  const results=await Promise.all(['studentA','studentB'].map(actor=>call(actor,'requestMembership',{...s(),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key()})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);
  const list=await ok('teacherA','groupInvitations',s());assert.equal(list.items[0].pendingCount,1);
});
test('same UID simultaneous requests count once and stale versions are rejected',async()=>{
  const inv=await invite(),payload={...s(),inviteId:inv.inviteId,token:inv.token};
  const pair=await Promise.all([call('studentA','requestMembership',{...payload,idempotencyKey:key()}),call('studentA','requestMembership',{...payload,idempotencyKey:key()})]);
  assert.ok(pair.every(r=>r.status===200));assert.equal(pair[0].body.requestId,pair[1].body.requestId);
  assert.equal((await ok('teacherA','groupInvitations',s())).items[0].pendingCount,1);
  const req=pair[0].body;
  const approval={...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()};
  const results=await Promise.all([call('teacherA','approveMembership',approval),call('teacherA','approveMembership',{...approval,idempotencyKey:key()})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('two approvals cannot consume the same last use',async()=>{
  const inv=await invite('a',{maxUses:1}),a=await request(inv),b=await request(inv,'studentB');
  const results=await Promise.all([a,b].map(req=>call('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,404]);assert.equal((await ok('teacherA','roster',s())).items.length,1);
});
test('students, foreign teachers and client-declared UID/roles cannot approve or grant staff',async()=>{
  const inv=await invite(),req=await request(inv),input={...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()};
  assert.equal((await call('studentA','approveMembership',input)).status,403);
  assert.equal((await call('teacherB','approveMembership',input)).status,403);
  assert.equal((await call('teacherA','approveMembership',{...input,actorUid:f.actors.teacherBoth.uid})).status,400);
  assert.equal((await call('studentA','createInvitation',{...s(),idempotencyKey:key(),expiresInSeconds:100,maxUses:1,maxPending:1,role:'admin'})).status,400);
  assert.equal((await call('teacherA','bootstrap',{})).status,404);
  assert.equal((await call('teacherA','firestore/write',{path:'staff/admin'})).status,404);
});
test('teacher A cannot administer B and unauthorized roster/request reads reveal no data',async()=>{
  const inv=await invite(),req=await request(inv);
  assert.equal((await call('teacherA','createInvitation',{...s('b'),idempotencyKey:key(),expiresInSeconds:100,maxUses:1,maxPending:1})).status,403);
  assert.equal((await call('studentB','roster',s())).status,403);
  assert.equal((await call('teacherB','roster',s())).status,403);
  assert.equal((await call('studentB','requestStatus',{...s(),requestId:req.requestId})).status,404);
});
test('operator revocation after preflight is rechecked inside the real transaction',async()=>{
  const inv=await invite(),req=await request(inv);revokeNext=f.actors.teacherA.uid;
  assert.equal((await call('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()})).status,403);
  assert.equal((await ok('studentA','requestStatus',{...s(),requestId:req.requestId})).membershipStatus,'none');
});
test('revoke preserves Auth/progress and old invitation cannot reactivate membership',async()=>{
  const inv=await invite(),req=await request(inv),approved=await ok('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
  const personalUrl=`http://127.0.0.1:8085/v1/projects/demo-optilab-sync/databases/(default)/documents/users/${f.actors.studentA.uid}/sync/current`;
  const headers={Authorization:`Bearer ${tokens.studentA}`};const before=await (await fetch(personalUrl,{headers})).text();
  await ok('teacherA','revokeMembership',{...s(),uid:f.actors.studentA.uid,expectedVersion:approved.version,idempotencyKey:key()});
  assert.equal(await (await fetch(personalUrl,{headers})).text(),before);
  assert.ok(await signIn(f.actors.studentA.email));
  assert.equal((await call('studentA','requestMembership',{...s(),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key()})).status,404);
  const state=await ok('studentA','requestStatus',{...s(),requestId:req.requestId});assert.equal(state.membershipStatus,'revoked');
  assert.ok((await ok('teacherA','membershipEvents',s())).items.some((e:any)=>e.action==='membership-revoked'));
});
test('transfer requires both scopes and is atomic, preserving other memberships',async()=>{
  const approved=await admit();
  const personal=`http://127.0.0.1:8085/v1/projects/demo-optilab-sync/databases/(default)/documents/users/${f.actors.studentA.uid}`;
  const headers={Authorization:`Bearer ${tokens.studentA}`};
  const before=await Promise.all(['/sync/current','/epochs/1/fields/nickname'].map(async p=>(await fetch(personal+p,{headers})).json()));
  const input={...s(),destinationGroupId:f.groups.b,uid:f.actors.studentA.uid,expectedVersion:approved.version,idempotencyKey:key()};
  assert.equal((await call('teacherA','transferMembership',input)).status,403);
  assert.equal((await ok('teacherA','roster',s())).items[0].status,'active');
  await ok('teacherBoth','transferMembership',input);
  assert.equal((await ok('teacherA','roster',s())).items[0].status,'revoked');
  assert.equal((await ok('teacherB','roster',s('b'))).items[0].status,'active');
  const own=await ok('studentA','myScopes',{});assert.equal(own.items.filter((r:any)=>r.status==='active').length,1);
  const after=await Promise.all(['/sync/current','/epochs/1/fields/nickname'].map(async p=>(await fetch(personal+p,{headers})).json()));assert.deepEqual(after,before);
  assert.ok((await ok('teacherA','membershipEvents',s())).items.some((e:any)=>e.action==='transfer-out'));
  assert.ok((await ok('teacherB','membershipEvents',s('b'))).items.some((e:any)=>e.action==='transfer-in'));
});
test('multiple memberships and group removal never revoke an unrelated group',async()=>{
  const a=await admit();await admit('studentA','b');
  await ok('teacherA','revokeMembership',{...s(),uid:f.actors.studentA.uid,expectedVersion:a.version,idempotencyKey:key()});
  const own=await ok('studentA','myScopes',{});assert.equal(own.items.find((r:any)=>r.groupId===f.groups.b).status,'active');
});
test('concurrent transfers cannot duplicate admission or rewrite prior source events',async()=>{
  const approved=await admit(),history=(await ok('teacherA','membershipEvents',s())).items;
  const payload={...s(),destinationGroupId:f.groups.b,uid:f.actors.studentA.uid,expectedVersion:approved.version};
  const results=await Promise.all([key(),key()].map(idempotencyKey=>call('teacherBoth','transferMembership',{...payload,idempotencyKey})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const after=(await ok('teacherA','membershipEvents',s())).items;
  for(const event of history)assert.deepEqual(after.find((r:any)=>r.eventId===event.eventId),event);
  assert.equal((await ok('teacherB','roster',s('b'))).items.filter((r:any)=>r.status==='active').length,1);
});
test('idempotent lost response, global payload binding, and secret absent from replay',async()=>{
  const idempotencyKey=key(),payload={...s(),idempotencyKey,expiresInSeconds:100,maxUses:2,maxPending:2};
  const first=await ok('teacherA','createInvitation',payload),again=await ok('teacherA','createInvitation',payload);
  assert.equal(again.replayed,true);assert.equal(again.inviteId,first.inviteId);assert.equal(again.tokenAvailable,false);assert.equal(again.token,undefined);
  assert.equal((await call('teacherA','createInvitation',{...payload,maxUses:3})).status,409);
  assert.equal((await ok('teacherA','groupInvitations',s())).items.length,1);
});
test('reissue revokes the previous token and reject releases a pending slot',async()=>{
  const inv=await invite(),req=await request(inv);
  await ok('teacherA','rejectMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
  const metadata=(await ok('teacherA','groupInvitations',s())).items[0];assert.equal(metadata.pendingCount,0);
  const next=await ok('teacherA','reissueInvitation',{...s(),inviteId:inv.inviteId,expectedVersion:metadata.revision,idempotencyKey:key(),expiresInSeconds:100,maxUses:2,maxPending:2});
  assert.equal((await call('studentB','requestMembership',{...s(),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key()})).status,404);
  await request(next,'studentB');
});
test('course capabilities control createTerm/createGroup; creator cannot assign another teacher',async()=>{
  assert.equal((await call('studentA','createTerm',{courseId:f.courseId,title:'Synthetic new period',idempotencyKey:key()})).status,403);
  assert.equal((await call('teacherB','createTerm',{courseId:f.courseId,title:'Synthetic new period',idempotencyKey:key()})).status,403);
  const term=await ok('teacherA','createTerm',{courseId:f.courseId,title:'Synthetic new period',idempotencyKey:key()});
  const group=await ok('teacherA','createGroup',{courseId:f.courseId,termId:term.termId,title:'Synthetic new group',idempotencyKey:key()});
  assert.equal((await ok('teacherA','myScopes',{kind:'teacher'})).items.length,2);
  assert.equal((await call('teacherB','roster',{courseId:f.courseId,termId:term.termId,groupId:group.groupId})).status,403);
});
test('normal Firebase clients cannot write well-formed grants or invitations; anonymous API rejected',async()=>{
  const path=`http://127.0.0.1:8085/v1/projects/demo-optilab-sync/databases/(default)/documents/${groupPath(s())}/members/${f.actors.studentA.uid}`;
  const response=await fetch(path,{method:'PATCH',headers:{Authorization:`Bearer ${tokens.studentA}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{
    schemaVersion:{integerValue:'1'},uid:{stringValue:f.actors.studentA.uid},courseId:{stringValue:f.courseId},termId:{stringValue:f.termId},groupId:{stringValue:f.groups.a},status:{stringValue:'active'},
  }})});assert.equal(response.status,403);
  assert.equal((await call('nobody','roster',s())).status,401);
  const signed=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})});
  assert.equal(signed.status,200);tokens.anonymous=(await signed.json()).idToken;
  assert.equal((await call('anonymous','myScopes',{})).status,401);
});
test('receipts and lists contain no raw invitation secret; replay rechecks teacher revocation',async()=>{
  const idempotencyKey=key(),payload={...s(),idempotencyKey,expiresInSeconds:100,maxUses:2,maxPending:2};
  const inv=await ok('teacherA','createInvitation',payload);
  assert.equal(await fixtureStoresSecret(sdk,f,inv.commandId,inv.inviteId,inv.token),false);
  assert.ok(!JSON.stringify(await ok('teacherA','groupInvitations',s())).includes(inv.token));
  assert.ok(!JSON.stringify(await ok('teacherA','membershipEvents',s())).includes(inv.token));
  await revokeFixtureTeacher(sdk,f,f.actors.teacherA.uid);
  assert.equal((await call('teacherA','createInvitation',payload)).status,403);
  assert.equal((await call('teacherA','membershipEvents',s())).status,403);
});
test('revoked course affiliation cannot be repaired by a group teacher or used as active access',async()=>{
  const inv=await invite(),req=await request(inv);await alterFixture(sdk,f,'course-suspension');
  assert.equal((await call('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()})).status,403);
  assert.equal((await call('studentA','requestMembership',{...s(),inviteId:inv.inviteId,token:inv.token,idempotencyKey:key()})).status,404);
  assert.equal((await ok('studentA','requestStatus',{...s(),requestId:req.requestId})).accessAllowed,false);
});
test('malformed staff, withdrawn capability and fake token role all fail closed',async()=>{
  await alterFixture(sdk,f,'fake-admin-claim');tokens.studentA=await signIn(f.actors.studentA.email);
  assert.equal((await call('studentA','roster',s())).status,403);
  await alterFixture(sdk,f,'revoked-capability');assert.equal((await call('teacherA','roster',s())).status,403);
  await alterFixture(sdk,f,'malformed-staff');assert.equal((await call('teacherA','groupInvitations',s())).status,403);
});
test('course policy can prohibit two active groups in the same period',async()=>{
  await alterFixture(sdk,f,'single-group');await admit();const inv=await invite('b'),req=await request(inv,'studentA','b');
  assert.equal((await call('teacherB','approveMembership',{...s('b'),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()})).status,409);
  assert.equal((await ok('teacherB','roster',s('b'))).items.length,0);
});
test('malformed roster fails closed on reads, revoke and transfer without propagating private fields',async()=>{
  const approved=await admit();await alterFixture(sdk,f,'malformed-roster');
  assert.equal((await call('teacherA','roster',s())).status,409);
  const payload={...s(),uid:f.actors.studentA.uid,expectedVersion:approved.version,idempotencyKey:key()};
  const revoked=await call('teacherA','revokeMembership',payload);assert.equal(revoked.status,409);
  assert.ok(!JSON.stringify(revoked.body).includes('private-fixture'));
  assert.equal((await call('teacherBoth','transferMembership',{...payload,idempotencyKey:key(),destinationGroupId:f.groups.b})).status,409);
  assert.equal((await ok('teacherB','roster',s('b'))).items.length,0);
});
test('readmission requires a new invitation and explicit approval, never an old pending approval',async()=>{
  const first=await invite(),a=await request(first),approved=await ok('teacherA','approveMembership',{...s(),requestId:a.requestId,expectedVersion:1,idempotencyKey:key()});
  await ok('teacherA','revokeMembership',{...s(),uid:f.actors.studentA.uid,expectedVersion:approved.version,idempotencyKey:key()});
  const next=await invite(),req=await request(next);
  assert.equal((await ok('studentA','requestStatus',{...s(),requestId:req.requestId})).membershipStatus,'revoked');
  await ok('teacherA','approveMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
  assert.equal((await ok('studentA','requestStatus',{...s(),requestId:req.requestId})).accessAllowed,true);
});
test('pagination is bounded and metrics count local SDK attempts, not billed production usage',async()=>{
  await invite();await invite();await invite();
  const first=await ok('teacherA','groupInvitations',{...s(),limit:2});assert.equal(first.items.length,2);assert.ok(first.nextCursor);
  const second=await ok('teacherA','groupInvitations',{...s(),limit:2,cursor:first.nextCursor});assert.equal(second.items.length,1);
  const sample=measurements.find(m=>m.operation==='createInvitation')!.metrics;
  assert.equal(sample.documentReadAttempts,13);assert.equal(sample.committedWrites,4);assert.equal(sample.transactionAttempts,1);
});
test('authorized roster exposes current administrative revision for CAS, including revoked memberships',async()=>{
  const approved=await admit();const roster=(await ok('teacherA','roster',s())).items[0];
  assert.equal(roster.revision,approved.version);assert.equal(roster.labelSource,'self-chosen');
  const result=await ok('teacherA','revokeMembership',{...s(),uid:roster.uid,expectedVersion:roster.revision,idempotencyKey:key()});
  assert.equal((await ok('teacherA','roster',s())).items[0].revision,result.version);
  assert.equal((await call('teacherA','revokeMembership',{...s(),uid:roster.uid,expectedVersion:roster.revision,idempotencyKey:key()})).status,409);
  assert.equal((await call('teacherB','roster',s())).status,403);
});
test('teacher discovery exposes verified capabilities and bounded course periods without granting access',async()=>{
  const a=(await ok('teacherA','myScopes',{kind:'teacher'})).items[0],b=(await ok('teacherB','myScopes',{kind:'teacher'})).items[0];
  assert.equal(a.capabilities.createTerms,true);assert.equal(b.capabilities.createGroups,false);
  await ok('teacherA','createTerm',{courseId:f.courseId,title:'Synthetic empty term',idempotencyKey:key()});
  const page=await ok('teacherA','myScopes',{kind:'teacher',courseId:f.courseId,limit:1});assert.equal(page.periods.length,1);assert.ok(page.nextCursor);
  assert.equal((await ok('teacherA','myScopes',{kind:'teacher',courseId:f.courseId,limit:1,cursor:page.nextCursor})).periods.length,1);
  assert.equal((await call('teacherB','myScopes',{kind:'teacher',courseId:f.courseId})).status,403);
  assert.equal((await call('studentA','myScopes',{kind:'teacher',courseId:f.courseId})).status,403);
});
test('bounds, traversal, public Origin and non-administrative reads are denied',async()=>{
  assert.equal((await call('teacherA','roster',{...s(),limit:51})).status,400);
  assert.equal((await call('teacherA','roster',{...s(),courseId:'../../users'})).status,400);
  const response=await fetch(`${base}/v1/roster`,{method:'POST',headers:{Authorization:`Bearer ${tokens.teacherA}`,'Content-Type':'application/json',Origin:'https://public.example'},body:JSON.stringify(s())});
  assert.equal(response.status,403);
  assert.equal((await call('teacherA','listUsers',{})).status,404);
  assert.equal((await call('teacherA','readProgress',{uid:f.actors.studentA.uid})).status,404);
});
test('rate limiting rejects before academic reads and writes',async()=>{
  let calls=0;
  const service=new AcademicService(new AcademicRepository(sdk.db),sdk,3600,{onMetrics:()=>calls++});
  const limited=httpServer({...localConfig(process.env),rateLimit:1},sdk,service);
  await new Promise<void>(r=>limited.listen(0,'127.0.0.1',r));
  try {
    const url=`http://127.0.0.1:${(limited.address() as {port:number}).port}`;
    await ok('teacherA','roster',s(),url);assert.equal(calls,1);
    const response=await fetch(`${url}/v1/roster`,{method:'POST',headers:{Authorization:`Bearer ${tokens.teacherA}`,'Content-Type':'application/json'},body:JSON.stringify(s())});
    assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');assert.equal(calls,1);
  }finally{await new Promise<void>(r=>limited.close(()=>r()));}
});
test('CLI authenticates through the emulator and redacts invitation output',async()=>{
  const envelope={email:f.actors.teacherA.email,password,operation:'createInvitation',payload:{...s(),idempotencyKey:key(),expiresInSeconds:100,maxUses:1,maxPending:1}};
  const run=()=>new Promise<{code:number|null;output:string;error:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/academic-client.mjs'],{env:{...process.env,ACADEMIC_ADMIN_PORT:String((server.address() as {port:number}).port)},stdio:['pipe','pipe','pipe']});
    let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);child.on('error',reject);child.on('close',code=>resolve({code,output,error}));child.stdin.end(JSON.stringify(envelope));
  });
  const result=await run();assert.equal(result.code,0);assert.equal(result.error,'');assert.ok(JSON.parse(result.output).result.token.startsWith('[redacted;'));
  assert.ok(!result.output.includes(password));
  envelope.email=f.actors.studentA.email;envelope.payload.idempotencyKey=key();
  const denied=await run();assert.equal(denied.code,1);assert.equal(JSON.parse(denied.output).status,403);
});
test('explicit panel seed prepares one active member and two requests without printing credentials or invitation secrets',async()=>{
  const result=await new Promise<{code:number|null;output:string;error:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/seed-academic-panel.mjs'],{env:{...process.env,ACADEMIC_FIXTURE_PASSWORD:password},stdio:['ignore','pipe','pipe']});
    let output='',error='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);child.on('error',reject);child.on('close',code=>resolve({code,output,error}));
  });
  assert.equal(result.code,0);assert.equal(result.error,'');assert.ok(!result.output.includes(password));
  const seeded=JSON.parse(result.output);assert.equal(seeded.token,undefined);assert.equal(seeded.inviteId,undefined);
  tokens.panelSeed=await signIn(seeded.actors.teacherA.email);
  const scope={courseId:seeded.courseId,termId:seeded.termId,groupId:seeded.groups.a};
  assert.equal((await ok('panelSeed','roster',scope)).items.length,1);
  assert.equal((await ok('panelSeed','groupRequests',{...scope,status:'pending'})).items.length,2);
});
test('negative HTTP assertion detects a deliberately removed permission policy',async()=>{
  const service=new AcademicService(new AcademicRepository(sdk.db),sdk,3600,{policy:{group:async()=>{},course:async()=>{}}});
  const mutant=httpServer(localConfig(process.env),sdk,service);await new Promise<void>(r=>mutant.listen(0,'127.0.0.1',r));
  try {
    const url=`http://127.0.0.1:${(mutant.address() as {port:number}).port}`;
    const deny=async(endpoint:string)=>assert.equal((await call('studentA','createInvitation',{...s(),idempotencyKey:key(),expiresInSeconds:100,maxUses:1,maxPending:1},endpoint)).status,403);
    await deny(base);await assert.rejects(()=>deny(url),assert.AssertionError);
  }finally{await new Promise<void>(r=>mutant.close(()=>r()));}
});
const profileInput=(extra:Record<string,unknown>={})=>({idempotencyKey:key(),expectedVersion:0,fullName:'Alumna Sintética',shareGameIdentity:true,nickname:'Pivote Azul',avatarId:'avatar-02',companionId:'piv',...extra});
test('academic profile is own-only, email comes from Auth, and direct Firestore remains denied',async()=>{
  assert.equal((await ok('studentA','getAcademicProfile',{})).revision,0);
  assert.equal((await call('studentA','updateAcademicProfile',profileInput({uid:f.actors.studentB.uid}))).status,400);
  assert.equal((await call('studentA','updateAcademicProfile',profileInput({email:'forged@example.test'}))).status,400);
  await ok('studentA','updateAcademicProfile',profileInput());
  const own=await ok('studentA','getAcademicProfile',{});assert.ok(own.profile.email===f.actors.studentA.email);assert.equal(own.profile.nameSource,'self-declared');assert.equal(own.profile.revision,1);
  assert.equal((await call('studentB','getAcademicProfile',{uid:f.actors.studentA.uid})).status,400);
  assert.equal((await ok('studentB','getAcademicProfile',{})).profile,null);
  const response=await fetch(`http://127.0.0.1:8085/v1/projects/demo-optilab-sync/databases/(default)/documents/academicProfiles/${f.actors.studentA.uid}`,{
    headers:{Authorization:`Bearer ${tokens.studentA}`}});assert.equal(response.status,403);
});
test('academic profile CAS, idempotent replay and receipt never restore or disclose withdrawn identity',async()=>{
  const payload=profileInput(),first=await ok('studentA','updateAcademicProfile',payload);
  const replay=await ok('studentA','updateAcademicProfile',payload);assert.equal(replay.replayed,true);
  const receipt=(await sdk.db.doc(`academicOperations/${first.commandId}`).get()).data();
  assert.ok(!JSON.stringify(receipt).includes(payload.fullName));assert.ok(!JSON.stringify(receipt).includes(payload.nickname));
  assert.equal((await call('studentA','updateAcademicProfile',{...payload,fullName:'Otro nombre declarado'})).status,409);
  const candidates=await Promise.all([1,2].map(()=>call('studentA','updateAcademicProfile',profileInput({expectedVersion:1,shareGameIdentity:false,nickname:null,avatarId:null,companionId:null}))));
  assert.deepEqual(candidates.map(r=>r.status).sort(),[200,409]);
  await ok('studentA','updateAcademicProfile',payload);assert.equal((await ok('studentA','getAcademicProfile',{})).profile.gameIdentity,null);
});
test('profile validation rejects malformed identities and inconsistent consent',async()=>{
  for(const extra of [{fullName:''},{fullName:'A'.repeat(121)},{nickname:'A'.repeat(31)},{avatarId:['avatar-01']},{avatarId:'avatar-99'},{companionId:'unknown'},{shareGameIdentity:false},{fullName:'Nombre\ninyectado'}]){
    assert.equal((await call('studentA','updateAcademicProfile',profileInput(extra))).status,400);
  }
  assert.equal((await ok('studentA','getAcademicProfile',{})).profile,null);
});
test('malformed stored profile fails closed instead of joining another UID into a roster',async()=>{
  await admit();await ok('studentA','updateAcademicProfile',profileInput());
  await sdk.db.doc(`academicProfiles/${f.actors.studentA.uid}`).update({uid:f.actors.studentB.uid});
  assert.equal((await call('studentA','getAcademicProfile',{})).status,409);
  const response=await call('teacherA','roster',s());assert.equal(response.status,409);assert.ok(!JSON.stringify(response.body).includes('Alumna Sintética'));
});
test('teacher projections follow exact group permissions and current consent for pending and active students',async()=>{
  await ok('studentA','updateAcademicProfile',profileInput());await ok('studentB','updateAcademicProfile',profileInput({fullName:'Solicitante Sintético'}));
  await admit();const inv=await invite(),req=await request(inv,'studentB');
  const roster=(await ok('teacherA','roster',s())).items[0];assert.equal(roster.academicProfile.gameIdentity.nickname,'Pivote Azul');
  assert.ok((await ok('teacherA','groupRequests',{...s(),status:'pending'})).items.some((r:any)=>r.requestId===req.requestId&&r.academicProfile?.fullName==='Solicitante Sintético'));
  assert.equal((await call('teacherB','roster',s())).status,403);assert.equal((await call('teacherB','groupRequests',s())).status,403);
  await ok('studentA','updateAcademicProfile',profileInput({expectedVersion:1,shareGameIdentity:false,nickname:null,avatarId:null,companionId:null}));
  assert.equal((await ok('teacherA','roster',s())).items[0].academicProfile.gameIdentity,null);
  await ok('teacherA','rejectMembership',{...s(),requestId:req.requestId,expectedVersion:1,idempotencyKey:key()});
  assert.equal((await ok('teacherA','groupRequests',{...s(),status:'rejected'})).items[0].academicProfile,null);
  await revokeFixtureTeacher(sdk,f,f.actors.teacherA.uid);assert.equal((await call('teacherA','roster',s())).status,403);
});
test('transfer removes fresh profile visibility from the former group without reading or modifying personal progress',async()=>{
  await ok('studentA','updateAcademicProfile',profileInput());await request(await invite());const approved=await admit();
  const progressPath=`users/${f.actors.studentA.uid}/sync/current`,before=JSON.stringify((await sdk.db.doc(progressPath).get()).data());
  await ok('teacherBoth','transferMembership',{...s(),destinationGroupId:f.groups.b,uid:f.actors.studentA.uid,expectedVersion:approved.version,idempotencyKey:key()});
  assert.equal((await ok('teacherA','roster',s())).items[0].academicProfile,null);
  assert.equal((await ok('teacherA','groupRequests',{...s(),status:'pending'})).items[0].academicProfile,null);
  assert.ok((await ok('teacherB','roster',s('b'))).items[0].academicProfile.email===f.actors.studentA.email);
  assert.ok(JSON.stringify((await sdk.db.doc(progressPath).get()).data())===before);
});
test('own request recovery by invitation locator is private and reports expiration, revocation and exhaustion without a secret',async()=>{
  const expired=await invite('a',{expiresInSeconds:1}),req=await request(expired,'studentB');
  assert.equal((await call('studentC','requestStatus',{...s(),inviteId:expired.inviteId})).status,404);
  await new Promise(r=>setTimeout(r,1100));const state=await ok('studentB','requestStatus',{...s(),inviteId:expired.inviteId});
  assert.ok(state.requestId===req.requestId);assert.equal(state.invitationState,'expired');assert.equal(state.accessAllowed,false);
  const inv=await invite(),pending=await request(inv,'studentB');
  const meta=(await ok('teacherA','groupInvitations',s())).items.find((i:any)=>i.inviteId===inv.inviteId);
  await ok('teacherA','revokeInvitation',{...s(),inviteId:inv.inviteId,expectedVersion:meta.revision,idempotencyKey:key()});
  assert.equal((await ok('studentB','requestStatus',{...s(),requestId:pending.requestId})).invitationState,'revoked');
  const full=await invite('a',{maxUses:1}),a=await request(full,'studentA'),b=await request(full,'studentC');
  await ok('teacherA','approveMembership',{...s(),requestId:a.requestId,expectedVersion:1,idempotencyKey:key()});
  assert.equal((await ok('studentC','requestStatus',{...s(),requestId:b.requestId})).invitationState,'exhausted');
  assert.equal((await ok('studentA','requestStatus',{...s(),requestId:a.requestId})).accessAllowed,true);
});
