import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,collection,collectionGroup,getDoc,getDocs,setDoc,query,limit,serverTimestamp,Timestamp,writeBatch,setLogLevel} from 'firebase/firestore';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw new Error('Production readiness tests require the isolated loopback emulator, never a real project.');
const rules=readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8');let env,uid,foreign;
setLogLevel('silent');
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-optilab-production-qa',firestore:{host:'127.0.0.1',port:8085,rules}});});
after(async()=>{await env?.cleanup();});
beforeEach(()=>{uid='qa-'+randomUUID();foreign='qa-'+randomUUID();});
const db=(user=uid,claims={})=>env.authenticatedContext(user,claims).firestore();
const head=(operationId=randomUUID(),revision=1,epoch=1)=>({schemaVersion:2,uid,epoch,revision,operationId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const field=(operationId,value='QA',revision=1,epoch=1)=>({schemaVersion:2,uid,epoch,revision,operationId,value});
function batch(client,{receipt={},key='nickname',value='QA',operationId=randomUUID(),revision=1,epoch=1,receiptId='o_'+operationId,writeHead=true,writeField=true}={}){
  const b=writeBatch(client);if(writeHead){const ref=doc(client,`users/${uid}/sync/current`);if(revision===1)b.set(ref,head(operationId,revision,epoch));else b.update(ref,{epoch,revision,operationId,updatedAt:serverTimestamp()});}
  if(writeField)b.set(doc(client,`users/${uid}/epochs/${epoch}/fields/${key}`),field(operationId,value,revision,epoch));
  b.set(doc(client,`users/${uid}/epochs/${epoch}/receipts/${receiptId}`),{schemaVersion:2,uid,epoch,operationId,kind:'edit',sourceHash:'',createdAt:serverTimestamp(),...receipt});return b;
}
test('v2 private writes require nonanonymous owner, exact CAS and coherent receipt',async()=>{
  const a=db();await assertSucceeds(batch(a).commit());await assertSucceeds(getDoc(doc(a,`users/${uid}/sync/current`)));
  for(const other of [db(foreign),env.unauthenticatedContext().firestore(),db(uid,{firebase:{sign_in_provider:'anonymous'}})]){
    await assertFails(getDoc(doc(other,`users/${uid}/sync/current`)));await assertFails(batch(other,{revision:2}).commit());
  }
  await assertFails(getDocs(query(collectionGroup(a,'fields'),limit(40))));
});
test('forged receipt operation cannot poison a future ACK and rolls back its entire batch',async()=>{
  const a=db(),op=randomUUID(),fake=randomUUID();await assertFails(batch(a,{operationId:op,receiptId:'o_'+fake,receipt:{operationId:fake}}).commit());
  assert.equal((await getDoc(doc(a,`users/${uid}/sync/current`))).exists(),false);
  await assertSucceeds(batch(a,{operationId:op}).commit());
  await assertFails(batch(a,{revision:2,receipt:{uid:foreign}}).commit());
});
test('a CAS update cannot reuse its previous operationId',async()=>{
  const a=db(),op=randomUUID();await assertSucceeds(batch(a,{operationId:op}).commit());
  await assertFails(setDoc(doc(a,`users/${uid}/sync/current`),{revision:2,operationId:op,updatedAt:serverTimestamp()},{merge:true}));
});
test('two writers racing one revision have exactly one successful atomic commit',async()=>{
  const a=db(),b=db();await assertSucceeds(batch(a).commit());
  const results=await Promise.allSettled([batch(a,{revision:2,value:'A'}).commit(),batch(b,{revision:2,value:'B'}).commit()]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await getDoc(doc(a,`users/${uid}/sync/current`))).data().revision,2);
});
test('read budgets and field bounds are enforced by Rules, not merely the UI',async()=>{
  const a=db();await assertSucceeds(batch(a).commit());
  await assertSucceeds(getDocs(query(collection(a,`users/${uid}/epochs/1/fields`),limit(40))));
  await assertFails(getDocs(query(collection(a,`users/${uid}/epochs/1/fields`),limit(41))));
  for(const name of ['diagnostics','gameRuns']){await assertSucceeds(getDocs(query(collection(a,`users/${uid}/epochs/1/${name}`),limit(50))));await assertFails(getDocs(query(collection(a,`users/${uid}/epochs/1/${name}`),limit(51))));}
  await assertFails(getDocs(query(collection(a,`users/${uid}/epochs/1/receipts`),limit(1))));
  await assertFails(batch(a,{revision:2,value:'x'.repeat(31)}).commit());await assertFails(batch(a,{revision:2,key:'role',value:'admin'}).commit());
});
test('headless or stale-epoch writes and receipts are rejected',async()=>{
  const a=db();await assertFails(batch(a,{writeHead:false}).commit());await assertSucceeds(batch(a).commit());
  const advance=writeBatch(a);advance.update(doc(a,`users/${uid}/sync/current`),{epoch:2,revision:2,operationId:randomUUID(),updatedAt:serverTimestamp()});await assertSucceeds(advance.commit());
  await assertFails(batch(a,{revision:3,epoch:1}).commit());
});
test('new temporary-game reports cannot become gameRuns; native Memorama remains valid',async()=>{
  const a=db(),op=randomUUID(),runId=randomUUID(),h=head(op),path=`users/${uid}/epochs/1/gameRuns/${runId}`;
  const run={schemaVersion:1,uid,trust:'self-reported',createdAt:serverTimestamp(),date:Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),runId,gameId:'memorama-simplex',result:{completed:true,matchedPairs:8,totalPairs:8,attempts:9,errors:1,elapsedMs:1000,accuracy:89}};
  const catalog=JSON.parse(readFileSync(new URL('../../catalogo_optimizacion_gimnasios_1_a_5.json',import.meta.url)));
  for(const {repo:gameId} of catalog.juegos.filter(g=>g.repo!=='memorama-simplex')){const b=writeBatch(a);b.set(doc(a,`users/${uid}/sync/current`),h);b.set(doc(a,path),{...run,gameId});await assertFails(b.commit());}
  const valid=writeBatch(a);valid.set(doc(a,`users/${uid}/sync/current`),h);valid.set(doc(a,path),run);await assertSucceeds(valid.commit());
  assert.deepEqual((await getDoc(doc(a,path))).data().result,run.result);
});
test('production deploy config has no emulator/service settings and indexes stay collection-scoped and bounded',()=>{
  const config=JSON.parse(readFileSync(new URL('../../firebase.production.json',import.meta.url)));
  assert.deepEqual(config,{firestore:{rules:'firestore.rules',indexes:'firestore.indexes.json'}});
  const indexes=JSON.parse(readFileSync(new URL('../../firestore.indexes.json',import.meta.url)));
  for(const group of ['sync','fields','receipts','gameRuns','diagnostics'])assert.ok(indexes.fieldOverrides.some(f=>f.collectionGroup===group&&f.fieldPath==='*'&&f.indexes.length===0));
  for(const group of ['gameRuns','diagnostics'])assert.deepEqual(indexes.fieldOverrides.find(f=>f.collectionGroup===group&&f.fieldPath==='date').indexes,[{order:'DESCENDING',queryScope:'COLLECTION'}]);
  assert.ok(indexes.indexes.every(i=>i.queryScope==='COLLECTION'));
});
test('new Rules accept the maximum 122-write atomic import without relaxing data or receipt validation',async()=>{
  const a=db(),op=randomUUID(),past=Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  const ids=JSON.parse(readFileSync(new URL('../../catalogo_optimizacion_gimnasios_1_a_5.json',import.meta.url))).juegos.map(g=>g.repo);
  const values={nickname:'Máximo sintético',avatarId:'avatar-06',companionId:'brio',route:ids,celebrated:3,
    ...Object.fromEntries(ids.map(id=>['practice--'+id,past])),...Object.fromEntries([1,2,3,4,5].map(id=>['visit--'+id,true]))};
  for(const stage of [2,3])values['milestone--'+stage]={stage,ruleVersion:1,unlockedAt:past,practice:Object.fromEntries(ids.map(id=>[id,past]))};
  assert.equal(Object.keys(values).length,40);const b=writeBatch(a);b.set(doc(a,`users/${uid}/sync/current`),head(op));
  for(const [key,value] of Object.entries(values))b.set(doc(a,`users/${uid}/epochs/1/fields/${key}`),field(op,value));
  const common={schemaVersion:1,uid,trust:'self-reported',createdAt:serverTimestamp(),date:past};
  for(let i=0;i<30;i++)b.set(doc(a,`users/${uid}/epochs/1/diagnostics/${randomUUID()}`),{...common,answers:[1,0,1,1,0],score:5});
  for(let i=0;i<50;i++){const id=randomUUID();b.set(doc(a,`users/${uid}/epochs/1/gameRuns/${id}`),{...common,runId:id,gameId:'memorama-simplex',result:{completed:true,matchedPairs:8,totalPairs:8,attempts:9,errors:1,elapsedMs:1000,accuracy:89}});}
  b.set(doc(a,`users/${uid}/epochs/1/receipts/i_${'a'.repeat(64)}`),{schemaVersion:2,uid,epoch:1,kind:'import',operationId:op,sourceHash:'a'.repeat(64),createdAt:serverTimestamp()});
  await assertSucceeds(b.commit());assert.equal((await getDocs(query(collection(a,`users/${uid}/epochs/1/fields`),limit(40)))).size,40);
});
