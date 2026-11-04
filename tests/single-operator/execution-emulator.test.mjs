import {before,beforeEach,after,test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDocFromServer,setLogLevel} from 'firebase/firestore';
import {initializeApp,deleteApp} from 'firebase-admin/app';import {getFirestore,Timestamp} from 'firebase-admin/firestore';import {getAuth} from 'firebase-admin/auth';
import {preparePaused,operate,pauseTotal,inspectControl,controlPath,auditPath} from '../../server/single-operator/execution.mjs';
import {sha256} from '../../server/single-operator/preparation.mjs';
import {executionFixture,sources} from './execution-fixture.mjs';
import {firestoreHost,firestorePort,authHost} from '../emulator-endpoints.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost||process.env.FIREBASE_AUTH_EMULATOR_HOST!==authHost||process.env.GCLOUD_PROJECT!=='demo-optilab-sync')throw Error('Local demo Auth/Firestore emulators required');
let env,app,db,auth,f;
setLogLevel('silent');before(async()=>{app=initializeApp({projectId:'demo-optilab-sync'},'single-execution-tests');db=getFirestore(app);auth=getAuth(app);try{await auth.createUser({uid:'single-fixture-a',email:'single-execution@example.test',emailVerified:true});}catch(e){if(e.code!=='auth/uid-already-exists'&&e.code!=='auth/email-already-exists')throw e;}});
beforeEach(async()=>{await env?.cleanup();f=executionFixture();env=await initializeTestEnvironment({projectId:'demo-optilab-sync',firestore:{host:'127.0.0.1',port:firestorePort,rules:f.bundle.rules}});await env.clearFirestore();await auth.updateUser(f.m.uid,{disabled:false,emailVerified:true});});
after(async()=>{await env?.cleanup();await db.terminate();await deleteApp(app);});
const receipt=async(now=Date.now())=>({...structuredClone(f.receipt),observedAt:new Date(now).toISOString(),control:await inspectControl(db)});
const client=()=>env.authenticatedContext(f.m.uid,{email_verified:true}).firestore();
async function prepared(){return preparePaused(db,auth,Timestamp,f.m,sources,f.approval,await receipt());}
async function open(){return operate(db,auth,Timestamp,'open',f.m,sources,f.approval,await receipt());}
test('atomic paused preparation, one opening, replay does not renew, full pause and explicit recovery',async()=>{
 const p=await prepared();assert.equal(p.status,'PREPARED_PAUSED');assert.equal(Object.keys((await db.doc(controlPath).get()).data()).length,10);
 await assertFails(getDocFromServer(doc(client(),`users/${f.m.uid}/sync/current`)));
 const first=await receipt(),opened=await operate(db,auth,Timestamp,'open',f.m,sources,f.approval,first);assert.equal(opened.status,'OPEN');await assertSucceeds(getDocFromServer(doc(client(),`users/${f.m.uid}/sync/current`)));
 const replay=await operate(db,auth,Timestamp,'open',f.m,sources,f.approval,first);assert.equal(replay.status,'REPLAY_NO_CHANGE');assert.equal(replay.expiresAt,opened.expiresAt);
 const stale=await receipt();await pauseTotal(db,Timestamp);await assert.rejects(()=>operate(db,auth,Timestamp,'renew',f.m,sources,f.approval,stale));await assertFails(getDocFromServer(doc(client(),`users/${f.m.uid}/sync/current`)));
 const recovered=await operate(db,auth,Timestamp,'recover',f.m,sources,f.approval,await receipt());assert.equal(recovered.status,'RECOVERED');await assertSucceeds(getDocFromServer(doc(client(),`users/${f.m.uid}/sync/current`)));
 await assert.rejects(async()=>preparePaused(db,auth,Timestamp,f.m,sources,f.approval,await receipt()));
});
test('pause always wins against a stale concurrent renew and original pilot remains untouched',async()=>{
 await prepared();await open();const stale=await receipt();await db.doc('syncPilotControl/current').set({fixture:'unchanged'});
 await Promise.allSettled([operate(db,auth,Timestamp,'renew',f.m,sources,f.approval,stale),pauseTotal(db,Timestamp)]);
 const c=(await db.doc(controlPath).get()).data();assert.equal(c.readsEnabled,false);assert.equal(c.writesEnabled,false);assert.deepEqual((await db.doc('syncPilotControl/current').get()).data(),{fixture:'unchanged'});
 await assertFails(getDocFromServer(doc(client(),`users/${f.m.uid}/sync/current`)));
});
test('transaction failure writes neither audit nor control; occupied original pilot blocks preparation',async()=>{
 const wrapped={doc:path=>db.doc(path),runTransaction:fn=>db.runTransaction(tx=>{let creates=0;return fn({get:ref=>tx.get(ref),create:(ref,data)=>{if(++creates===2)throw Error('Synthetic transaction failure');tx.create(ref,data);}});})};
 await assert.rejects(async()=>preparePaused(wrapped,auth,Timestamp,f.m,sources,f.approval,await receipt()));assert.equal((await db.doc(auditPath).get()).exists,false);assert.equal((await db.doc(controlPath).get()).exists,false);
 await db.doc('syncPilotControl/current').set({readsEnabled:true,writesEnabled:false,expiresAt:Timestamp.fromMillis(Date.now()+60000)});await assert.rejects(()=>prepared());assert.equal((await db.doc(controlPath).get()).exists,false);
});
test('expired leases need recovery, cannot exceed fixed end; disabled/erased accounts fail closed',async()=>{
 await prepared();await open();await db.doc(controlPath).update({expiresAt:Timestamp.fromMillis(Date.now()-1)});
 await assert.rejects(async()=>operate(db,auth,Timestamp,'renew',f.m,sources,f.approval,await receipt()));
 // Expired OPEN state must be observed as paused for the recovery receipt; inspect reports actual flags,
 // so close first using the independent emergency operation.
 await pauseTotal(db,Timestamp);await operate(db,auth,Timestamp,'recover',f.m,sources,f.approval,await receipt());
 assert((await db.doc(controlPath).get()).data().expiresAt.toMillis()<=Date.parse(f.m.endAt));
 await pauseTotal(db,Timestamp);await auth.updateUser(f.m.uid,{disabled:true});await assert.rejects(async()=>operate(db,auth,Timestamp,'recover',f.m,sources,f.approval,await receipt()));await auth.updateUser(f.m.uid,{disabled:false});
 await db.doc(`syncPilotMembers/${f.m.uid}`).set({status:'erased'});await assert.rejects(async()=>operate(db,auth,Timestamp,'recover',f.m,sources,f.approval,await receipt()));
});
test('real CLI rehearsal: inspect, prepare, open, quota failure pause and recovery with fictitious emulator account',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'single-execution-cli-'));try{
  const evidence=Buffer.from('Fictitious emulator usage evidence only');f.usage.evidenceSha256=sha256(evidence);f.usage.evidencePath=join(dir,'usage.txt');await writeFile(f.usage.evidencePath,evidence,{mode:0o600});
  for(const [name,value]of Object.entries({session:f.m,approval:f.approval,platform:f.platform,usage:f.usage}))await writeFile(join(dir,name+'.json'),JSON.stringify(value),{mode:0o600});
  const invoke=(action,extra=[])=>{const args=['scripts/single-operator-session.mjs',action,'--target','emulator','--execute','--confirm',action+':'+(action==='pause'?'pause':f.bundle.plan.windowDigest)];if(action!=='pause')args.push('--manifest',join(dir,'session.json'),'--approval',join(dir,'approval.json'),'--platform',join(dir,'platform.json'),'--usage',join(dir,'usage.json'));return spawnSync(process.execPath,args.concat(extra),{env:process.env,encoding:'utf8'});};
  const inspect=async(name)=>{const file=join(dir,name+'.json'),r=invoke('inspect',['--out',file]);assert.equal(r.status,0,r.stderr);return file;};
  const initial=await inspect('before');let r=invoke('prepare',['--receipt',initial]);assert.equal(r.status,0,r.stderr);
  const ready=await inspect('paused');r=invoke('open',['--receipt',ready]);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'OPEN');
  const online=await inspect('online');const bad={...f.usage,counts:{...f.usage.counts,reads:5000}};await writeFile(join(dir,'usage.json'),JSON.stringify(bad),{mode:0o600});r=invoke('renew',['--receipt',online]);assert.notEqual(r.status,0);assert.equal((await db.doc(controlPath).get()).data().writesEnabled,false);
  await writeFile(join(dir,'usage.json'),JSON.stringify(f.usage),{mode:0o600});const paused=await inspect('failure-paused');r=invoke('recover',['--receipt',paused]);assert.equal(r.status,0,r.stderr);r=invoke('pause');assert.equal(r.status,0,r.stderr);assert.equal((await db.doc(controlPath).get()).data().readsEnabled,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
