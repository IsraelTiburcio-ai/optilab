import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncAllowed} from '../../src/progress/config';
import {blankSnapshot, reconcile, canonical, digest, importProgress, emptyProgress, withEvolution, fieldsOf, project, SyncConflict, type Operation} from '../../src/progress/model';

const op=(changes:Operation['changes'],epoch=1):Operation=>({id:crypto.randomUUID(),afterId:null,kind:'edit',epoch,changes,diagnostics:{},runs:{}});
test('production, real project, wrong hosts and absent flags all fail closed',()=>{
  const auth={status:'ready' as const,config:{apiKey:'fake',authDomain:'demo-optilab-sync.firebaseapp.com',projectId:'demo-optilab-sync',
    storageBucket:'demo.example',messagingSenderId:'123',appId:'1:123:web:demo'},emulatorUrl:'http://127.0.0.1:9099'};
  const env={DEV:true,VITE_PROGRESS_SYNC:'emulator',VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085'};
  assert.equal(syncAllowed(env,auth,'127.0.0.1'),true);
  assert.equal(syncAllowed({...env,DEV:false},auth,'127.0.0.1'),false);
  assert.equal(syncAllowed(env,{...auth,config:{...auth.config,projectId:'optilab-cd829'}},'127.0.0.1'),false);
  assert.equal(syncAllowed(env,auth,'israeltiburcio-ai.github.io'),false);
  assert.equal(syncAllowed({...env,VITE_FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com'},auth,'localhost'),false);
  assert.equal(syncAllowed({...env,VITE_PROGRESS_SYNC:''},auth,'localhost'),false);
  assert.equal(syncAllowed(env,{...auth,emulatorUrl:null},'localhost'),false);
});
test('independent changes converge; stale same-field changes raise conflict even with misleading dates',()=>{
  const a=op({nickname:{value:'A',baseRevision:0,predecessor:null}});
  const b=op({avatarId:{value:'avatar-02',baseRevision:0,predecessor:null}});
  const first=reconcile(reconcile(blankSnapshot(),a),b);
  const second=reconcile(reconcile(blankSnapshot(),b),a);
  assert.equal(project(first).nickname,project(second).nickname);
  assert.equal(project(first).avatarId,'avatar-02');
  assert.throws(()=>reconcile(first,op({nickname:{value:'B',baseRevision:0,predecessor:null}})),SyncConflict);
});
test('unmark tombstone wins against stale marked practice; causally subsequent re-mark allowed',()=>{
  const key='practice--memorama-simplex',date='2026-01-01T00:00:00.000Z';
  const mark=op({[key]:{value:date,baseRevision:0,predecessor:null}});
  const first=reconcile(blankSnapshot(),mark);
  const unmark=op({[key]:{value:null,baseRevision:first.fields[key].revision,predecessor:mark.id}});
  const second=reconcile(first,unmark);
  assert.equal(project(second).practiced['memorama-simplex'],undefined);
  assert.throws(()=>reconcile(second,op({[key]:{value:date,baseRevision:0,predecessor:null}})),SyncConflict);
  assert.equal(project(reconcile(second,op({[key]:{value:date,baseRevision:0,predecessor:unmark.id}}))).practiced['memorama-simplex'],date);
});
test('reset advances epoch and stale offline operations cannot resurrect old data',()=>{
  const a=op({nickname:{value:'Antes',baseRevision:0,predecessor:null}});
  const s=reconcile(blankSnapshot(),a),reset={...op({}),kind:'reset' as const};
  const next=reconcile(s,reset);assert.equal(next.epoch,2);assert.equal(project(next).nickname,'Entrenador OptiLab');
  assert.throws(()=>reconcile(next,a),SyncConflict);
});
test('import keeps dates, routes and historical evolution evidence; rejects lossy/corrupt payloads',async()=>{
  const p=withEvolution({...emptyProgress(),nickname:'Fixture',avatarId:'avatar-06',companionId:'brio',
    practiced:{OptiQuest1:'2026-01-01T00:00:00.000Z'},route:['OptiQuest1'],visited:[1],
    results:[{date:'2026-01-01T00:00:00.000Z',answers:[1,0,1,1,0],score:5}]});
  assert.deepEqual(importProgress(JSON.stringify(p)),p);
  assert.equal(await digest(canonical(p)),await digest(canonical({...p})));
  assert.throws(()=>importProgress('{bad'));
  assert.throws(()=>importProgress('{"__proto__":{}}'));
  assert.throws(()=>importProgress(JSON.stringify({...p,route:['unknown']})));
  assert.throws(()=>importProgress(JSON.stringify({...p,nickname:'x'.repeat(31)})));
  assert.throws(()=>importProgress(JSON.stringify({...p,practiced:{unknown:'2026-01-01'}})));
  const restored=reconcile(blankSnapshot(),{...op(Object.fromEntries(Object.entries(fieldsOf(p)).map(([key,value])=>[key,{value,baseRevision:0,predecessor:null}]))),kind:'restore'});
  assert.equal(restored.epoch,2);assert.equal(project(restored).companionId,'brio');
});
