import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,terminate,doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,writeBatch,setLogLevel,collection,collectionGroup,getDocs,query,limit,where,orderBy,startAfter} from 'firebase/firestore';
import {firestoreTransport} from '../../src/progress/transport';
import {ProgressEngine} from '../../src/progress/engine';
import {blankSnapshot,emptyProgress,withEvolution,SyncConflict,type Operation} from '../../src/progress/model';
import {games} from '../../src/data';

if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')
  throw new Error('Sync integration requires BOTH isolated loopback emulators.');
setLogLevel('silent');
class MemoryStorage implements Storage {
  data=new Map<string,string>();get length(){return this.data.size;}clear(){this.data.clear();}
  getItem(k:string){return this.data.get(k)??null;}key(i:number){return [...this.data.keys()][i]??null;}
  setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}
}
const apps=[0,1,2].map(i=>initializeApp({projectId:'demo-optilab-sync',apiKey:'fake-api-key',authDomain:'demo-optilab-sync.firebaseapp.com'},`sync-test-${i}`));
const auths=apps.map(a=>{const auth=getAuth(a);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});return auth;});
const dbs=apps.map(a=>{const db=getFirestore(a);connectFirestoreEmulator(db,'127.0.0.1',8085);return db;});
let uid:string,other:string;
const engines:ProgressEngine[]=[];
const wait=async(check:()=>boolean)=>{const until=Date.now()+20000;while(!check()){if(Date.now()>until)throw new Error('Timed out waiting for sync condition');await new Promise(r=>setTimeout(r,25));}};
const transport=(i=0)=>firestoreTransport(dbs[i],uid,()=>auths[i].currentUser?.uid===uid);
const op=(changes:Operation['changes']={},epoch=1):Operation=>({id:crypto.randomUUID(),afterId:null,kind:'edit',epoch,changes,diagnostics:{},runs:{}});
const engine=async(i=0,storage=new MemoryStorage())=>{
  const e=new ProgressEngine(uid,storage,transport(i),5);engines.push(e);e.start();await wait(()=>e.getSnapshot().ready);return e;
};
before(async()=>{
  const email=`sync-${crypto.randomUUID()}@example.test`,password='fixture-password';
  uid=(await createUserWithEmailAndPassword(auths[0],email,password)).user.uid;
  await signInWithEmailAndPassword(auths[1],email,password);
  other=(await createUserWithEmailAndPassword(auths[2],`other-${crypto.randomUUID()}@example.test`,password)).user.uid;
});
after(async()=>{engines.forEach(e=>e.dispose());await Promise.all(dbs.map(terminate));await Promise.all(apps.map(deleteApp));});

test('actual Auth + Firestore emulators: consent, atomic import receipt, repeated import and second device',async()=>{
  const a=await engine(),b=await engine(1);
  assert.equal((await getDoc(doc(dbs[0],`users/${uid}/sync/current`))).exists(),false);
  await a.keepRemote(true);assert.equal(a.getSnapshot().decision,'cancelled');
  assert.equal((await getDoc(doc(dbs[0],`users/${uid}/sync/current`))).exists(),false);
  const raw=JSON.stringify({...emptyProgress(),nickname:'Importado',avatarId:'avatar-02',companionId:'piv',
    practiced:{'memorama-simplex':'2026-01-01T00:00:00.000Z'},visited:[3],route:['memorama-simplex'],
    results:[{date:'2026-01-01T00:00:00.000Z',answers:[1,0,1,1,0],score:5}],
    gameResults:[{gameId:'memorama-simplex',runId:'12345678-1234-4234-8234-123456789abc',date:'2026-01-01T00:00:00.000Z',completed:true,matchedPairs:8,totalPairs:8,attempts:10,errors:2,elapsedMs:2000,accuracy:80}]});
  await a.importRaw(raw);await wait(()=>a.getSnapshot().status==='synced');
  await wait(()=>b.getSnapshot().progress.nickname==='Importado');
  assert.equal(b.getSnapshot().progress.results.length,1);assert.equal(b.getSnapshot().progress.gameResults.length,1);
  await a.importRaw(raw);await wait(()=>a.getSnapshot().status==='synced');
  assert.equal((await getDocs(query(collection(dbs[0],`users/${uid}/epochs/1/diagnostics`),limit(50)))).size,1);
  assert.equal(a.getSnapshot().backups[0].raw,raw);
  a.dispose();b.dispose();
});
test('two concurrent actual clients merge independent fields and reject same-field stale CAS',async()=>{
  const t=transport(),t2=transport(1);
  const head=(await getDoc(doc(dbs[0],`users/${uid}/sync/current`))).data()!;
  const r=await Promise.all([t.commit(op({avatarId:{value:'avatar-04',baseRevision:0,predecessor:null}},head.epoch)),
    t2.commit(op({companionId:{value:'dua',baseRevision:0,predecessor:null}},head.epoch))].map(p=>p.catch(e=>e)));
  // Existing values were imported: both are intentionally stale, never blindly overwritten.
  assert.ok(r.every(v=>v instanceof SyncConflict));
  const results=await Promise.all([t.commit(op({'visit--1':{value:true,baseRevision:0,predecessor:null}},head.epoch)),
    t2.commit(op({'visit--2':{value:true,baseRevision:0,predecessor:null}},head.epoch))]);
  assert.equal(results.length,2);
  await t.commit(op({nickname:{value:'Conflicto A',baseRevision:head.revision,predecessor:null}},head.epoch));
  await assert.rejects(()=>t2.commit(op({nickname:{value:'Conflicto B',baseRevision:0,predecessor:null}},head.epoch)),SyncConflict);
});
test('durable interrupted import, offline restart, backup restore, reset and stale epoch blocking',async()=>{
  const storage=new MemoryStorage(),a=await engine(0,storage);
  await a.keepRemote();a.setOnline(false);
  const raw=JSON.stringify({...emptyProgress(),nickname:'Restaurado',avatarId:'avatar-06'});
  await a.importRaw(raw);a.resolveLocal();assert.equal(a.getSnapshot().pending,1);
  const backup=a.getSnapshot().backups.find(b=>b.raw===raw)!;
  a.dispose();
  const resumed=await engine(0,storage);await wait(()=>resumed.getSnapshot().status==='synced');
  assert.equal(resumed.getSnapshot().progress.nickname,'Restaurado');
  const priorEpoch=(await getDoc(doc(dbs[0],`users/${uid}/sync/current`))).data()!.epoch;
  await resumed.reset();await wait(()=>resumed.getSnapshot().status==='synced');
  assert.equal(resumed.getSnapshot().progress.nickname,'Entrenador OptiLab');
  await assert.rejects(()=>transport(1).commit(op({nickname:{value:'Resucitado',baseRevision:0,predecessor:null}},priorEpoch)),e=>
    e instanceof SyncConflict&&e.conflict.kind==='epoch'&&!e.snapshot?.fields.nickname);
  await resumed.restore(backup);await wait(()=>resumed.getSnapshot().status==='synced');
  assert.equal(resumed.getSnapshot().progress.nickname,'Restaurado');
  await assert.rejects(()=>resumed.restore({...backup,ownerUid:other}));
  await assert.rejects(()=>resumed.restore({...backup,raw:'{}'}));
  resumed.dispose();
});
test('v2 Rules deny other UID, fake role, missing CAS, malformed fields, stale generation, and deletes',async()=>{
  const headRef=doc(dbs[0],`users/${uid}/sync/current`),h=(await getDoc(headRef)).data()!;
  await assert.rejects(()=>getDoc(doc(dbs[2],`users/${uid}/sync/current`)));
  await assert.rejects(()=>updateDoc(headRef,{revision:h.revision+2,updatedAt:serverTimestamp()}));
  await assert.rejects(()=>updateDoc(headRef,{role:'admin',revision:h.revision+1,updatedAt:serverTimestamp()}));
  await assert.rejects(()=>setDoc(doc(dbs[0],`users/${uid}/epochs/${h.epoch}/fields/nickname`),{schemaVersion:2,uid,epoch:h.epoch,revision:h.revision,operationId:crypto.randomUUID(),value:'Sin CAS'}));
  const batch=writeBatch(dbs[0]),id=crypto.randomUUID();
  batch.update(headRef,{revision:h.revision+1,operationId:id,updatedAt:serverTimestamp()});
  batch.set(doc(dbs[0],`users/${uid}/epochs/${h.epoch}/fields/role`),{schemaVersion:2,uid,epoch:h.epoch,revision:h.revision+1,operationId:id,value:'admin'});
  await assert.rejects(()=>batch.commit());
  await assert.rejects(()=>setDoc(doc(dbs[0],`users/${uid}/epochs/1/fields/nickname`),{schemaVersion:2,uid,epoch:1,revision:h.revision+1,operationId:id,value:'Antiguo'}));
  await assert.rejects(()=>getDocs(collection(dbs[0],`users/${uid}/epochs/${h.epoch}/fields`)));
  await assert.rejects(()=>deleteDoc(headRef));
  await assert.rejects(()=>deleteDoc(doc(dbs[0],`users/${uid}/epochs/${h.epoch}/fields/nickname`)));
  const malformed=writeBatch(dbs[0]),badId=crypto.randomUUID();
  malformed.update(headRef,{revision:h.revision+1,operationId:badId,updatedAt:serverTimestamp()});
  malformed.set(doc(dbs[0],`users/${uid}/epochs/${h.epoch}/fields/nickname`),{schemaVersion:2,uid,epoch:h.epoch,revision:h.revision+1,operationId:badId,value:{role:'admin'}});
  await assert.rejects(()=>malformed.commit());
  const stale=writeBatch(dbs[0]),staleId=crypto.randomUUID();
  stale.update(headRef,{revision:h.revision+1,operationId:staleId,updatedAt:serverTimestamp()});
  stale.set(doc(dbs[0],`users/${uid}/epochs/${h.epoch-1}/fields/nickname`),{schemaVersion:2,uid,epoch:h.epoch-1,revision:h.revision+1,operationId:staleId,value:'Stale epoch with valid CAS'});
  await assert.rejects(()=>stale.commit());
  await assert.rejects(()=>getDocs(query(collectionGroup(dbs[0],'fields'),where('uid','==',uid),limit(40))));
});
test('maximum legacy import: 40 typed fields, both full evolution milestones, 30 diagnostics and 50 runs atomic',async()=>{
  const e=new ProgressEngine(other,new MemoryStorage(),firestoreTransport(dbs[2],other,()=>auths[2].currentUser?.uid===other),5);engines.push(e);e.start();
  await wait(()=>e.getSnapshot().ready);
  const date='2026-01-01T00:00:00.000Z';
  const full=withEvolution({...emptyProgress(),nickname:'Dense fixture',avatarId:'avatar-06',companionId:'brio',visited:[1,2,3,4,5],
    practiced:Object.fromEntries(games.map(g=>[g.repo,date])),route:games.map(g=>g.repo),evolutionCelebratedStage:3,
    results:Array.from({length:30},(_,i)=>({date:new Date(Date.parse(date)+i*1000).toISOString(),answers:[1,0,1,1,0],score:5})),
    gameResults:Array.from({length:50},()=>({gameId:'memorama-simplex' as const,runId:crypto.randomUUID(),date,
      completed:true as const,matchedPairs:8,totalPairs:8,attempts:10,errors:2,elapsedMs:1000,accuracy:80}))});
  await e.importRaw(JSON.stringify(full));await wait(()=>['synced','error'].includes(e.getSnapshot().status));
  assert.equal(e.getSnapshot().error,'');assert.equal(e.getSnapshot().progress.evolutionMilestones.length,2);
  assert.equal(e.getSnapshot().progress.results.length,30);assert.equal(e.getSnapshot().progress.gameResults.length,50);
  assert.equal((await getDocs(query(collection(dbs[2],`users/${other}/epochs/1/fields`),limit(40)))).size,40);
  e.dispose();
});
test('lost ACK after successful atomic import replays receipt without duplicate writes or events',async()=>{
  const storage=new MemoryStorage(),real=transport();
  const interrupted=new ProgressEngine(uid,storage,{watch:real.watch,commit:async operation=>{await real.commit(operation);throw new Error('Simulated lost ACK');}},5);
  engines.push(interrupted);interrupted.start();await wait(()=>interrupted.getSnapshot().ready);
  const raw=JSON.stringify({...emptyProgress(),nickname:'ACK fixture',results:[{date:'2026-02-01T00:00:00.000Z',answers:[1,0,1,1,0],score:5}]});
  await interrupted.importRaw(raw);interrupted.resolveLocal();await wait(()=>interrupted.getSnapshot().status==='error');
  const headRef=doc(dbs[0],`users/${uid}/sync/current`),before=(await getDoc(headRef)).data()!;
  const count=(await getDocs(query(collection(dbs[0],`users/${uid}/epochs/${before.epoch}/diagnostics`),limit(50)))).size;
  interrupted.dispose();const resumed=await engine(0,storage);await wait(()=>resumed.getSnapshot().status==='synced');
  assert.equal((await getDoc(headRef)).data()!.revision,before.revision);
  assert.equal((await getDocs(query(collection(dbs[0],`users/${uid}/epochs/${before.epoch}/diagnostics`),limit(50)))).size,count);
  resumed.dispose();
});
test('restoring an offline journal preserves all 120 unsent diagnostics beyond the visible 30, with resumable chunks',async()=>{
  const storage=new MemoryStorage(),e=await engine(0,storage);await e.keepRemote();e.setOnline(false);
  for(let i=0;i<120;i++)e.change({...e.getSnapshot().progress,results:[...e.getSnapshot().progress.results,
    {date:new Date(Date.UTC(2026,2,1)+i*1000).toISOString(),answers:[1,0,1,1,0],score:5}].slice(-30)});
  const backup=await e.exportBackup();assert.equal(backup.journal!.length,120);assert.equal(JSON.parse(backup.raw).results.length,30);e.dispose();
  const restored=new ProgressEngine(uid,storage,transport(),5);engines.push(restored);restored.setOnline(false);restored.start();
  await wait(()=>restored.getSnapshot().ready);await restored.restore(backup);
  assert.ok(restored.getSnapshot().pending>1);restored.setOnline(true);await wait(()=>restored.getSnapshot().status==='synced');
  const epoch=(await getDoc(doc(dbs[0],`users/${uid}/sync/current`))).data()!.epoch;
  const records=collection(dbs[0],`users/${uid}/epochs/${epoch}/diagnostics`);let cursor:import('firebase/firestore').QueryDocumentSnapshot|undefined,count=0;
  for(;;) {
    const page=await getDocs(query(records,orderBy('date','desc'),...(cursor?[startAfter(cursor)]:[]),limit(50)));
    count+=page.size;if(page.size<50)break;cursor=page.docs.at(-1);
  }
  assert.equal(count,120);assert.equal(restored.getSnapshot().progress.results.length,30);restored.dispose();
});
test('old local snapshots without milestones use a stable import receipt, not newly derived unlock timestamps',async()=>{
  const e=await engine();const raw=JSON.stringify({nickname:'ACK fixture',practiced:Object.fromEntries(games.slice(0,6).map(g=>[g.repo,'2026-01-01T00:00:00.000Z']))});
  await e.importRaw(raw);if(e.getSnapshot().conflict)e.resolveLocal();await wait(()=>e.getSnapshot().status==='synced');
  const headRef=doc(dbs[0],`users/${uid}/sync/current`),revision=(await getDoc(headRef)).data()!.revision;
  await e.importRaw(raw);if(e.getSnapshot().conflict)e.resolveLocal();await wait(()=>e.getSnapshot().status==='synced');
  assert.equal((await getDoc(headRef)).data()!.revision,revision);e.dispose();
});
test('disposing UID A drops late callbacks and commits; B never sees A namespace',async()=>{
  const storage=new MemoryStorage(),a=await engine(0,storage);await a.keepRemote();a.setOnline(false);
  a.change({...a.getSnapshot().progress,nickname:'Privado pendiente A'});a.dispose();await a.flush();
  const b=new ProgressEngine(other,storage,firestoreTransport(dbs[2],other,()=>auths[2].currentUser?.uid===other),5);engines.push(b);b.start();
  await wait(()=>b.getSnapshot().ready);assert.equal(b.getSnapshot().progress.nickname,'Dense fixture');
  assert.equal(b.getSnapshot().pending,0);assert.equal(b.getSnapshot().backups.length,0);
  b.dispose();await signOut(auths[2]);
});
test('existing remote v1 is detected, remains readable and cannot silently fork into v2',async()=>{
  const legacyUid=(await createUserWithEmailAndPassword(auths[2],`legacy-${crypto.randomUUID()}@example.test`,'fixture-password')).user.uid;
  const path=`users/${legacyUid}/progress/current`;
  const legacy={schemaVersion:1,uid:legacyUid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),revision:1,
    practiced:{},visited:[],nickname:'Legacy remoto',route:[],avatarId:null,companionId:null,evolutionCelebratedStage:1};
  const fork=writeBatch(dbs[2]);fork.set(doc(dbs[2],path),legacy);
  fork.set(doc(dbs[2],`users/${legacyUid}/sync/current`),{schemaVersion:2,uid:legacyUid,epoch:1,revision:1,
    operationId:crypto.randomUUID(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await assert.rejects(()=>fork.commit());
  assert.equal((await getDoc(doc(dbs[2],path))).exists(),false);
  await setDoc(doc(dbs[2],path),legacy);
  const service=firestoreTransport(dbs[2],legacyUid,()=>auths[2].currentUser?.uid===legacyUid);
  let code='';const stop=service.watch(()=>{},e=>{code=(e as {code:string}).code;});
  await wait(()=>code==='sync/legacy-v1');stop();
  await assert.rejects(()=>service.commit(op({nickname:{value:'Fork prohibido',baseRevision:0,predecessor:null}})));
  assert.equal((await getDoc(doc(dbs[2],path))).data()!.nickname,'Legacy remoto');
  assert.equal((await getDoc(doc(dbs[2],`users/${legacyUid}/sync/current`))).exists(),false);
});
