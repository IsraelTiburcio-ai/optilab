import {before,after,test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,limit,query,serverTimestamp,disableNetwork,enableNetwork} from 'firebase/firestore';
import {initializeApp,deleteApp} from 'firebase-admin/app';import {getFirestore,Timestamp} from 'firebase-admin/firestore';import {getAuth} from 'firebase-admin/auth';
import {control,admit,inventory,exportUid,eraseUid,monitor} from '../../server/pilot/admin.mjs';import {planUid} from '../../server/pilot/plan.mjs';
import {firestoreHost,firestorePort} from '../emulator-endpoints.mjs';
let env,app,db,auth;const projectId='demo-optilab-pilot';
before(async()=>{if(process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost)throw Error('Isolated emulator required');env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:firestorePort,rules:readFileSync('firestore.pilot.rules','utf8')}});app=initializeApp({projectId},'pilot-tests');db=getFirestore(app);auth=getAuth(app);});
after(async()=>{await env.cleanup();await db.terminate();await deleteApp(app);});
const client=(uid,verified=true)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
async function grant(uid){await db.doc(`syncPilotMembers/${uid}`).set({version:1,uid,status:'active',expiresAt:Timestamp.fromMillis(Date.now()+3600000),updatedAt:Timestamp.now()});}
const payload=uid=>({version:1,id:'run',activityId:'system-lab',uid,kind:'reported',trust:'client-report',observedAt:'2026-01-01T00:00:00.000Z',serverReceivedAt:serverTimestamp(),result:{correct:6,total:8}});
test('effective admission: unknown, unverified, expired, revoked and other UID denied; own verified active allowed',async()=>{
 await control(db,Timestamp,{readsEnabled:true,writesEnabled:true});const a=client('a');await assertFails(getDoc(doc(a,'users/a/progress/current')));await grant('a');
 await assertSucceeds(setDoc(doc(a,'users/a/reportedAttempts/system-lab--run'),payload('a')));
 await assertSucceeds(getDocs(query(collection(a,'users/a/reportedAttempts'),limit(2000))));
 await assertFails(getDoc(doc(client('a',false),'users/a/progress/current')));await assertFails(getDoc(doc(client('b'),'users/a/progress/current')));
 for(const change of [{expiresAt:Timestamp.fromMillis(0)},{status:'revoked'},{status:'erased'}]){await grant('a');await db.doc('syncPilotMembers/a').update(change);await assertFails(getDoc(doc(a,'users/a/progress/current')));}
 await grant('a');for(const path of ['syncPilotMembers/a','syncPilotControl/current'])await assertFails(setDoc(doc(a,path),{status:'active'}));
 await assertFails(getDocs(collection(a,'syncPilotMembers')));await assertFails(getDoc(doc(a,'syncPilotMembers/b')));
});
test('pause affects direct SDK and all private subtrees, independent of frontend; validated results immutable',async()=>{
 await grant('a');const a=client('a');await control(db,Timestamp,{readsEnabled:true,writesEnabled:false});
 await assertSucceeds(getDoc(doc(a,'users/a/reportedAttempts/system-lab--run')));await assertFails(setDoc(doc(a,'users/a/reportedAttempts/system-lab--run2'),{...payload('a'),id:'run2'}));
 await assertFails(setDoc(doc(a,'users/a/validatedAttempts/fake'),{trust:'validated'}));
 await control(db,Timestamp);for(const path of ['progress/current','history/x','reportedAttempts/system-lab--run','validatedAttempts/x','epochs/x','backups/x'])await assertFails(getDoc(doc(a,`users/a/${path}`)));
 await control(db,Timestamp,{readsEnabled:true,writesEnabled:true});await db.doc('syncPilotControl/current').update({expiresAt:Timestamp.fromMillis(0)});await assertFails(getDoc(doc(a,'users/a/progress/current')));
});
test('admission requires verified Auth, cap survives concurrent operators, erased UID cannot rejoin',async()=>{
 await env.clearFirestore();for(const uid of ['u0','u1','u2','u3','u4','u5','unverified'])await auth.createUser({uid,email:`${uid}@example.test`,emailVerified:uid!=='unverified'});
 await assert.rejects(()=>admit(db,auth,'unverified',{Timestamp}));for(let i=0;i<4;i++)await admit(db,auth,`u${i}`,{Timestamp});
 const races=await Promise.allSettled(['u4','u5'].map(uid=>admit(db,auth,uid,{Timestamp})));assert.equal(races.filter(x=>x.status==='fulfilled').length,1);
 await db.doc('syncPilotMembers/u0').update({status:'erased'});await assert.rejects(()=>admit(db,auth,'u0',{Timestamp}));
});
test('UID export and deletion include nested backups/derived data; retain fence, protect B and guest, remove managed archives',async()=>{
 await env.clearFirestore();const uid='erase-a';await grant(uid);
 for(const [path,data] of [['users/erase-a/progress/current',{v:1}],['users/erase-a/epochs/e/history/h',{value:'backup'}],['derived/a',{uid,value:6}],['derived/a/backups/b',{value:1}],['users/b/progress/current',{v:2}]])await db.doc(path).set(data);
 const directory=await mkdtemp(join(tmpdir(),'pilot-archive-'));try{
  const exported=await exportUid(db,uid,directory);assert.equal(exported.plan.documents.length,4);assert.equal((await stat(exported.path)).mode&0o777,0o600);
  const archive=JSON.parse(await readFile(exported.path,'utf8'));assert.equal(archive.payload.uid,uid);
  await db.doc('derived/a').update({value:7});await assert.rejects(()=>eraseUid(db,uid,{planHash:exported.plan.hash,directory,Timestamp}));assert.equal((await db.doc('derived/a').get()).exists,true);
  const current=await exportUid(db,uid,directory);const erased=await eraseUid(db,uid,{planHash:current.plan.hash,directory,Timestamp});assert.equal(erased.deleted,4);assert.equal(erased.managedArchivesDeleted,2);
  assert.equal((await db.doc('users/b/progress/current').get()).data().v,2);assert.equal((await db.doc(`syncPilotMembers/${uid}`).get()).data().status,'erased');
  assert.equal(planUid(uid,await inventory(db)).owned.length,0);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('shared UID references block erasure; inventory caps fail without claiming completeness; monitor pause is effective',async()=>{
 await env.clearFirestore();await db.doc('shared/team').set({members:['a','b']});const directory=await mkdtemp(join(tmpdir(),'pilot-review-'));
 try{const exported=await exportUid(db,'a',directory);assert.equal(exported.plan.review.length,1);await assert.rejects(()=>eraseUid(db,'a',{planHash:exported.plan.hash,directory,Timestamp}));
  await assert.rejects(()=>inventory(db,{maxDocuments:0}));const dry=await monitor(db,{maxDocuments:0,Timestamp});assert.equal(dry.exceeded,true);assert.equal(dry.paused,false);
  const result=await monitor(db,{maxDocuments:0,execute:true,Timestamp});assert.equal(result.paused,true);assert.equal((await db.doc('syncPilotControl/current').get()).data().writesEnabled,false);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('cross-owner UID fields become review blockers, not deletion authority',()=>{const p=planUid('a',[{path:'users/b/private/x',data:{uid:'a'},version:1}]);assert.equal(p.owned.length,0);assert.equal(p.review.length,1);const mixed=planUid('a',[{path:'derived/shared',data:{uid:'a',ownerUid:'b'},version:1}]);assert.equal(mixed.owned.length,0);assert.equal(mixed.review.length,1);});

test('offline queued writes cannot replay after administrative erasure fence',async()=>{
 const uid='offline-fenced';await control(db,Timestamp,{readsEnabled:true,writesEnabled:true});await grant(uid);const device=client(uid);
 await assertSucceeds(getDoc(doc(device,`users/${uid}/sync/current`)));await disableNetwork(device);
 const denied=assertFails(setDoc(doc(device,`users/${uid}/reportedAttempts/system-lab--run`),payload(uid)));
 await db.doc(`syncPilotMembers/${uid}`).update({status:'erased'});await enableNetwork(device);await denied;
 assert.equal((await db.doc(`users/${uid}/reportedAttempts/system-lab--run`).get()).exists,false);
});

test('CLI dry-run is offline; production execution requires separate acknowledgement before SDK initialization',async()=>{
 const {spawnSync}=await import('node:child_process');const clean={...process.env};delete clean.FIRESTORE_EMULATOR_HOST;delete clean.FIREBASE_AUTH_EMULATOR_HOST;delete clean.OPTILAB_PILOT_OPERATOR_APPROVAL;
 const args=['scripts/pilot-admin.mjs','pause','--target','production','--project','optilab-cd829'];
 const dry=spawnSync(process.execPath,args,{env:clean,encoding:'utf8'});assert.equal(dry.status,0);assert.equal(JSON.parse(dry.stdout).network,false);assert.equal(JSON.parse(dry.stdout).writes,false);
 const denied=spawnSync(process.execPath,[...args,'--execute','--confirm','pause'],{env:clean,encoding:'utf8'});assert.notEqual(denied.status,0);assert.match(denied.stderr,/separate operator authorization/);
});
