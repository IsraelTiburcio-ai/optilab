import {before,after,test} from 'node:test';import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,sendEmailVerification,reload} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,terminate,setLogLevel,disableNetwork,enableNetwork,doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp,collection,getDocs,query,limit} from 'firebase/firestore';
import {authHost,firestoreHost,authUrl,firestorePort} from '../emulator-endpoints.mjs';
import {attemptTransport} from '../../src/attempts/cloudTransport';import {AttemptCloudEngine} from '../../src/attempts/cloudEngine';import {empty,mergeLedgers,AttemptConflict,type AttemptRepository} from '../../src/attempts/cloudModel';import type {Attempt,Ledger} from '../../src/attempts/model';
if(process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost||process.env.FIREBASE_AUTH_EMULATOR_HOST!==authHost)throw Error('Attempt integration requires BOTH isolated loopback emulators');
setLogLevel('silent');
const apps=[0,1,2,3].map(i=>initializeApp({projectId:'demo-optilab-sync',apiKey:'fake-api-key'},'attempt-'+i));
const auths=apps.map(app=>{const a=getAuth(app);connectAuthEmulator(a,authUrl,{disableWarnings:true});return a;});
const dbs=apps.map(app=>{const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',firestorePort);return db;});
class Repo implements AttemptRepository{ledger=empty();backups:Ledger[]=[];async read(){return structuredClone(this.ledger);}async merge(l:Ledger,w=false){this.ledger=mergeLedgers(this.ledger,l,w);}async backup(l:Ledger){this.backups.push(structuredClone(l));}}
const engines:AttemptCloudEngine[]=[];let uid:string,other:string;const password='Synthetic-sync-42!';
const event=(id=crypto.randomUUID()):Attempt=>({version:1,id,activityId:'memorama-simplex',kind:'reported',trust:'client-report',observedAt:'2026-01-01T00:00:00.000Z',result:{completed:true,matchedPairs:8,totalPairs:8,attempts:8,errors:0,elapsedMs:1234,accuracy:100}});
async function wait(check:()=>boolean){for(let i=0;i<800;i++){if(check())return;await new Promise(r=>setTimeout(r,25));}throw Error('Timeout actual attempt integration');}
async function verify(index:number){const auth=auths[index];await sendEmailVerification(auth.currentUser!);const r=await fetch(`${authUrl}/emulator/v1/projects/demo-optilab-sync/oobCodes`);const codes=(await r.json()).oobCodes;const code=codes.filter((c:any)=>c.email===auth.currentUser!.email&&c.requestType==='VERIFY_EMAIL').at(-1);const result=await fetch(`${authUrl}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-api-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code.oobCode})});assert.equal(result.status,200);await reload(auth.currentUser!);await auth.currentUser!.getIdToken(true);}
const valid=(i:number)=>()=>auths[i].currentUser?.uid===uid;
function engine(index:number,repo:Repo){const e=new AttemptCloudEngine(repo,attemptTransport(dbs[index],uid,valid(index)),valid(index));engines.push(e);e.start();return e;}
before(async()=>{const email=`attempt-${crypto.randomUUID()}@example.test`;uid=(await createUserWithEmailAndPassword(auths[0],email,password)).user.uid;await verify(0);await signInWithEmailAndPassword(auths[1],email,password);other=(await createUserWithEmailAndPassword(auths[2],`other-${crypto.randomUUID()}@example.test`,password)).user.uid;await verify(2);await createUserWithEmailAndPassword(auths[3],`unverified-${crypto.randomUUID()}@example.test`,password);});
after(async()=>{engines.forEach(e=>e.dispose());await Promise.all(dbs.map(terminate));await Promise.all(apps.map(deleteApp));});
test('two real Auth/Firestore clients: explicit consent, concurrency, offline restart and backup restoration',async()=>{
 const a=new Repo(),b=new Repo(),first=event();a.ledger.entries.push(first);const x=engine(0,a),y=engine(1,b);
 assert.equal((await getDoc(doc(dbs[0],`users/${uid}/reportedAttempts/${first.activityId}--${first.id}`))).exists(),false);
 x.activate();y.activate();await wait(()=>a.ledger.entries.length===1&&b.ledger.entries.length===1&&x.getSnapshot().status==='synced');
 a.ledger.entries.push(event());b.ledger.entries.push({...event(),activityId:'system-lab',result:{correct:6,total:8}});x.changed();y.changed();await wait(()=>a.ledger.entries.length===3&&b.ledger.entries.length===3);
 const backup=await a.read();await disableNetwork(dbs[0]);x.setOnline(false);a.ledger.entries.push(event());x.changed();assert.equal(b.ledger.entries.length,3);x.dispose();await enableNetwork(dbs[0]);const restarted=engine(0,a);restarted.activate();await wait(()=>b.ledger.entries.length===4&&restarted.getSnapshot().status==='synced');
 await a.backup(await a.read());await a.merge(backup);restarted.changed();await wait(()=>restarted.getSnapshot().status==='synced');assert.equal(a.ledger.entries.length,4);assert.equal((await getDocs(query(collection(dbs[0],`users/${uid}/reportedAttempts`),limit(2000)))).size,4);
 assert.equal(a.ledger.entries.find(e=>e.activityId==='system-lab')?.result?.score,undefined);y.dispose();restarted.dispose();
});
test('immutable duplicate and replay never overwrite; privileged trust/UID/other-user/unverified writes denied',async()=>{
 const t=attemptTransport(dbs[0],uid,valid(0));const e=event();await t.put(e);await t.put(e);await assert.rejects(()=>t.put({...e,result:{score:999}}),AttemptConflict);
 const ref=doc(dbs[0],`users/${uid}/reportedAttempts/${e.activityId}--${e.id}`);
 await assert.rejects(()=>updateDoc(ref,{trust:'server-validated'}));await assert.rejects(()=>deleteDoc(ref));
 await assert.rejects(()=>getDoc(doc(dbs[2],ref.path)));await assert.rejects(()=>setDoc(doc(dbs[2],ref.path),{...e,uid,serverReceivedAt:serverTimestamp()}));
 const unverified=auths[3].currentUser!.uid;await assert.rejects(()=>setDoc(doc(dbs[3],`users/${unverified}/reportedAttempts/${e.activityId}--${e.id}`),{...e,uid:unverified,serverReceivedAt:serverTimestamp()}));
 for(const patch of [{trust:'server-validated'},{uid:other},{result:{score:-1}},{result:{durationMs:'fake'}},{kind:'validated'}]){
  const bad=event();await assert.rejects(()=>setDoc(doc(dbs[0],`users/${uid}/reportedAttempts/${bad.activityId}--${bad.id}`),{...bad,...patch,uid:patch.uid??uid,serverReceivedAt:serverTimestamp()}));
 }
 await assert.rejects(()=>setDoc(doc(dbs[0],`users/${uid}/validatedAttempts/forged`),{score:999}));
});
test('logout makes stale transport unusable; switching to B cannot read A',async()=>{await signOut(auths[1]);await assert.rejects(()=>attemptTransport(dbs[1],uid,valid(1)).put(event()),/obsoleta/);await signInWithEmailAndPassword(auths[1],auths[2].currentUser!.email!,password);await assert.rejects(()=>getDocs(query(collection(dbs[1],`users/${uid}/reportedAttempts`),limit(2000))));});
