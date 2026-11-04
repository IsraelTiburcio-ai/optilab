import {beforeEach,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,writeBatch,serverTimestamp,Timestamp,setLogLevel,getDocs,collection,query,limit} from 'firebase/firestore';
import {ProgressEngine} from '../../src/progress/engine.ts';
import {MemoryStorage} from '../../src/progress/storage.ts';
import {firestoreTransport} from '../../src/progress/transport.ts';
import {attemptTransport} from '../../src/attempts/cloudTransport.ts';
import {prepareSession} from '../../server/single-operator/preparation.mjs';
import {session,sources} from './fixture.mjs';
import {firestoreHost,firestorePort} from '../emulator-endpoints.mjs';

if(process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost||process.env.GCLOUD_PROJECT!=='demo-optilab-sync')throw Error('Only demo-optilab-sync loopback emulator allowed');
let env,m,bundle;setLogLevel('silent');
const a=()=>env.authenticatedContext('single-fixture-a',{email_verified:true}).firestore();
const control=(patch={})=>({...bundle.control,startAt:Timestamp.fromDate(new Date(m.startAt)),endAt:Timestamp.fromDate(new Date(m.endAt)),updatedAt:Timestamp.now(),expiresAt:Timestamp.fromMillis(Math.min(Date.now()+60000,Date.parse(m.endAt))),readsEnabled:true,writesEnabled:true,...patch});
async function adminSet(path,data){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),data));}
async function load(value=session()){
  await env?.cleanup();m=value;bundle=prepareSession(m,sources);
  env=await initializeTestEnvironment({projectId:'demo-optilab-sync',firestore:{host:'127.0.0.1',port:firestorePort,rules:bundle.rules}});
  await env.clearFirestore();await adminSet('singleOperatorTestControl/current',control());
}
beforeEach(()=>load());after(async()=>env?.cleanup());
const event=()=>({version:1,id:randomUUID(),uid:'single-fixture-a',activityId:'memorama-simplex',kind:'reported',trust:'client-report',observedAt:new Date().toISOString(),serverReceivedAt:serverTimestamp(),result:{completed:true,matchedPairs:8,totalPairs:8,attempts:8,errors:0,elapsedMs:1200,accuracy:100}});
function saveProgress(db){
  const op=randomUUID(),uid='single-fixture-a',batch=writeBatch(db);
  batch.set(doc(db,`users/${uid}/sync/current`),{schemaVersion:2,uid,epoch:1,revision:1,operationId:op,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  batch.set(doc(db,`users/${uid}/epochs/1/fields/nickname`),{schemaVersion:2,uid,epoch:1,revision:1,operationId:op,value:'Adulto ficticio'});
  batch.set(doc(db,`users/${uid}/epochs/1/receipts/o_${op}`),{schemaVersion:2,uid,epoch:1,operationId:op,kind:'edit',sourceHash:'',createdAt:serverTimestamp()});
  return batch.commit();
}
test('generated Rules compile and two independent clients recover v2 progress and one Memorama report',async()=>{
  const mac=a(),phone=a();await assertSucceeds(saveProgress(mac));assert.equal((await getDoc(doc(phone,'users/single-fixture-a/epochs/1/fields/nickname'))).data().value,'Adulto ficticio');
  const data=event(),path=`users/single-fixture-a/reportedAttempts/memorama-simplex--${data.id}`;
  await assertSucceeds(setDoc(doc(mac,path),data));const first=await assertSucceeds(getDoc(doc(phone,path)));assert.equal(first.data().result.completed,true);
  const reloaded=a();assert.equal((await getDoc(doc(reloaded,path))).data().id,data.id);
  await assertFails(setDoc(doc(mac,path),data)); // immutable replay cannot overwrite; transport dedup reads first.
});
test('existing engines work with the narrower Rules: consent, two clients, dedup, backup and restore',async()=>{
  const uid='single-fixture-a',mac=a(),phone=a(),engines=[mac,phone].map(db=>new ProgressEngine(uid,new MemoryStorage(),firestoreTransport(db,uid,()=>true),5));
  const wait=async(check)=>{for(let i=0;i<400;i++){if(check())return;await new Promise(r=>setTimeout(r,25));}throw Error('Emulator engine timed out');};
  try{
    engines.forEach(e=>e.start());await wait(()=>engines.every(e=>e.getSnapshot().ready));
    assert(engines.every(e=>e.getSnapshot().decision!=='accepted'));
    await Promise.all(engines.map(e=>e.keepRemote()));
    engines[0].change({...engines[0].getSnapshot().progress,nickname:'Respaldo ficticio'});
    await wait(()=>engines[1].getSnapshot().progress.nickname==='Respaldo ficticio'&&engines[0].getSnapshot().status==='synced');
    const {uid:_uid,serverReceivedAt:_time,...reported}=event(),sender=attemptTransport(mac,uid,()=>true);
    const run={gameId:'memorama-simplex',runId:reported.id,date:reported.observedAt,...reported.result};
    engines[0].change({...engines[0].getSnapshot().progress,gameResults:[run]});
    await wait(()=>engines[1].getSnapshot().progress.gameResults.length===1&&engines[0].getSnapshot().status==='synced');
    const backup=await engines[0].exportBackup();
    await sender.put(reported);await sender.put(reported);
    const rows=await getDocs(query(collection(phone,`users/${uid}/reportedAttempts`),limit(2000)));assert.equal(rows.size,1);assert.equal(rows.docs[0].data().id,reported.id);
    await engines[0].reset();await wait(()=>engines[0].getSnapshot().status==='synced'&&engines[1].getSnapshot().reviewEpoch===2);
    await engines[0].restore(backup);await wait(()=>engines.every(e=>e.getSnapshot().progress.nickname==='Respaldo ficticio'&&e.getSnapshot().reviewEpoch===3));
    assert.deepEqual(engines[1].getSnapshot().progress.gameResults,[run]);
  }finally{engines.forEach(e=>e.dispose());}
});
test('another UID, anonymous, unverified and cross-owner requests cannot access the test data',async()=>{
  for(const db of [env.authenticatedContext('single-fixture-b',{email_verified:true}).firestore(),env.authenticatedContext('single-fixture-a',{email_verified:false}).firestore(),env.authenticatedContext('single-fixture-a',{email_verified:true,firebase:{sign_in_provider:'anonymous'}}).firestore(),env.unauthenticatedContext().firestore()]){
    await assertFails(getDoc(doc(db,'users/single-fixture-a/sync/current')));await assertFails(saveProgress(db));
  }
  await assertFails(getDoc(doc(a(),'users/single-fixture-b/sync/current')));
  const b=env.authenticatedContext('single-fixture-b',{email_verified:true}).firestore();await assertFails(setDoc(doc(b,'users/single-fixture-b/sync/current'),{uid:'single-fixture-b'}));
});
test('old pilot grants/control cannot activate this separate mode',async()=>{
  await adminSet('singleOperatorTestControl/current',{});
  await adminSet('syncPilotControl/current',{version:1,readsEnabled:true,writesEnabled:true,expiresAt:Timestamp.fromMillis(Date.now()+600000)});
  await adminSet('syncPilotMembers/single-fixture-a',{version:1,uid:'single-fixture-a',status:'active',expiresAt:Timestamp.fromMillis(Date.now()+600000)});
  await assertFails(saveProgress(a()));
});
test('client cannot change control, admit users, write outside scope, import or elevate trust',async()=>{
  const db=a();
  for(const path of ['singleOperatorTestControl/current','syncPilotControl/current','syncPilotMembers/single-fixture-a','users/single-fixture-a/validatedAttempts/fake','users/single-fixture-a/progress/current','users/single-fixture-a/diagnostics/fake','users/single-fixture-a/enrollments/fake','users/single-fixture-a/backups/fake','courses/fake'])await assertFails(setDoc(doc(db,path),{value:true}));
  const other={...event(),activityId:'system-lab'};await assertFails(setDoc(doc(db,`users/single-fixture-a/reportedAttempts/system-lab--${other.id}`),other));
  const forged={...event(),trust:'server-validated'};await assertFails(setDoc(doc(db,`users/single-fixture-a/reportedAttempts/memorama-simplex--${forged.id}`),forged));
  // An import receipt is forbidden even if all other v2 metadata is coherent.
  const op=randomUUID(),batch=writeBatch(db),uid='single-fixture-a';batch.set(doc(db,`users/${uid}/sync/current`),{schemaVersion:2,uid,epoch:1,revision:1,operationId:op,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  batch.set(doc(db,`users/${uid}/epochs/1/receipts/i_${'a'.repeat(64)}`),{schemaVersion:2,uid,epoch:1,operationId:op,kind:'import',sourceHash:'a'.repeat(64),createdAt:serverTimestamp()});await assertFails(batch.commit());
});
test('full pause, expired lease and leases longer than ten minutes deny new operations',async()=>{
  for(const patch of [{readsEnabled:false,writesEnabled:false},{expiresAt:Timestamp.fromMillis(Date.now()-1)},{expiresAt:Timestamp.fromMillis(Date.now()+660000)}]){
    await adminSet('singleOperatorTestControl/current',control(patch));await assertFails(getDoc(doc(a(),'users/single-fixture-a/sync/current')));await assertFails(saveProgress(a()));
  }
});
test('writes-only pause still permits reads; erased fence blocks replay even after control renewal',async()=>{
  await adminSet('singleOperatorTestControl/current',control({writesEnabled:false}));await assertSucceeds(getDoc(doc(a(),'users/single-fixture-a/sync/current')));await assertFails(saveProgress(a()));
  await adminSet('singleOperatorTestControl/current',control());await adminSet('syncPilotMembers/single-fixture-a',{status:'erased'});await assertFails(saveProgress(a()));
});
test('absolute two-hour window cannot be extended or switched to another UID by control edits',async()=>{
  for(const patch of [{uid:'single-fixture-b'},{endAt:Timestamp.fromMillis(Date.parse(m.endAt)+7200000)},{windowDigest:'a'.repeat(64)}]){
    await adminSet('singleOperatorTestControl/current',control(patch));await assertFails(saveProgress(a()));
  }
  const now=Date.now();await load({...session(now),startAt:new Date(now-7260000).toISOString(),endAt:new Date(now-60000).toISOString()});await assertFails(saveProgress(a()));
  await load({...session(now),startAt:new Date(now+60000).toISOString(),endAt:new Date(now+7260000).toISOString()});await assertFails(saveProgress(a()));
});
