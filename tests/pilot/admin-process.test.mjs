import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {administrativeTarget,administrativeExecution,withAdministrativeProcess,withAdministrativeSdk} from '../../server/pilot/admin-process.mjs';

const production={target:'production',projectId:'optilab-cd829'};
const emulator={target:'emulator',projectId:'demo-optilab-sync'};
function sdkFixture(t,env,{fail}={}){
  const events=[],app={mock:true},db={terminate:async()=>{events.push('terminate');if(fail==='terminate')throw Error('mock cleanup failure');}};
  const modules={
    'firebase-admin/app':{
      applicationDefault:()=>{events.push('adc');assert.equal(env.GOOGLE_CLOUD_QUOTA_PROJECT,production.projectId);return {mock:true};},
      initializeApp:options=>{events.push('initialize');assert.equal(options.projectId,env.FIRESTORE_EMULATOR_HOST?emulator.projectId:production.projectId);return app;},
      deleteApp:async value=>{events.push('delete');assert.equal(value,app);if(fail==='delete')throw Error('mock app cleanup failure');},
    },
    'firebase-admin/firestore':{getFirestore:()=>{events.push('firestore');if(fail==='firestore')throw Error('mock initialization failure');return db;},Timestamp:{mock:true}},
    'firebase-admin/auth':{getAuth:()=>{events.push('auth');if(fail==='auth')throw Error('mock initialization failure');return {listUsers:t.mock.fn(async count=>{assert.equal(count,1);assert.equal(env.GOOGLE_CLOUD_QUOTA_PROJECT,production.projectId);return {};})};}},
  };
  const loadSdk=t.mock.fn(async name=>{events.push('load');assert(Object.hasOwn(modules,name));return modules[name];});
  return {events,loadSdk,db,app};
}

test('target and quota validation is pure; rejects unknown targets, projects and mismatched quotas',()=>{
  for(const [scope,env]of [[{...production,projectId:'other-project'},{}],[{...emulator,projectId:production.projectId},{}],[{target:'unknown',projectId:production.projectId},{}],[production,{GOOGLE_CLOUD_QUOTA_PROJECT:'other-project'}],[emulator,{GOOGLE_CLOUD_QUOTA_PROJECT:production.projectId}]])assert.throws(()=>administrativeTarget(scope.target,scope.projectId,env));
  const env={};assert.deepEqual(administrativeTarget(production.target,production.projectId,env),production);assert.deepEqual(env,{});
});
test('incompatible quota/endpoints reject before callback, SDK loading or credential initialization',async t=>{
  for(const [scope,env]of [[production,{GOOGLE_CLOUD_QUOTA_PROJECT:'other-project'}],[production,{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'}],[production,{FIRESTORE_EMULATOR_HOST:'127.0.0.1:8185'}],[emulator,{FIREBASE_AUTH_EMULATOR_HOST:'untrusted:9199'}],[emulator,{FIRESTORE_EMULATOR_HOST:'untrusted:8185'}]]){
    const before={...env},loadSdk=t.mock.fn(),run=t.mock.fn();
    await assert.rejects(()=>withAdministrativeProcess(scope,run,env));await assert.rejects(()=>withAdministrativeSdk(scope,run,{env,loadSdk}));
    assert.equal(run.mock.callCount(),0);assert.equal(loadSdk.mock.callCount(),0);assert.deepEqual(env,before);
  }
  assert.throws(()=>administrativeExecution({target:'production',projectId:emulator.projectId},{}));
});
test('direct SDK helper cannot bypass scoped quota or isolated emulator initialization',async t=>{
  for(const scope of [production,emulator]){const loadSdk=t.mock.fn();await assert.rejects(()=>withAdministrativeSdk(scope,()=>{}, {env:{},loadSdk}));assert.equal(loadSdk.mock.callCount(),0);}
});
test('authorized process sets quota before mocked ADC/SDK and restores absent, empty or matching values',async t=>{
  for(const initial of [{},{GOOGLE_CLOUD_QUOTA_PROJECT:''},{GOOGLE_CLOUD_QUOTA_PROJECT:production.projectId}]){
    const env={...initial},f=sdkFixture(t,env);
    const result=await withAdministrativeProcess(production,()=>withAdministrativeSdk(production,async({auth})=>{f.events.push('operation');await auth.listUsers(1);return 'mock-result';},{env,loadSdk:f.loadSdk}),env);
    assert.equal(result,'mock-result');assert.equal(f.events.filter(e=>e==='adc').length,1);assert.deepEqual(f.events.slice(-2),['terminate','delete']);assert.deepEqual(env,initial);
  }
});
test('normal sync emulator pair is accepted only for emulator scope',()=>{
  const normal={FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'};
  assert.deepEqual(administrativeExecution(emulator,normal),emulator);
  assert.throws(()=>administrativeExecution(production,normal));
  assert.throws(()=>administrativeExecution(emulator,{FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'}));
});
test('default process environment is scoped and restored while the SDK is mocked',async t=>{
  const keys=['GOOGLE_CLOUD_QUOTA_PROJECT','FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'];
  const before=keys.map(key=>[key,Object.hasOwn(process.env,key),process.env[key]]);
  try{
    for(const key of keys)delete process.env[key];
    const f=sdkFixture(t,process.env);
    await withAdministrativeProcess(production,()=>withAdministrativeSdk(production,async({auth})=>{await auth.listUsers(1);},{loadSdk:f.loadSdk}));
    assert.equal(Object.hasOwn(process.env,'GOOGLE_CLOUD_QUOTA_PROJECT'),false);
    assert.deepEqual(f.events.slice(-2),['terminate','delete']);
  }finally{for(const [key,present,value]of before){if(present)process.env[key]=value;else delete process.env[key];}}
});
test('preflight failure restores process quota without loading credentials or SDK',async t=>{
  const env={},loadSdk=t.mock.fn();await assert.rejects(()=>withAdministrativeProcess(production,async()=>{assert.equal(env.GOOGLE_CLOUD_QUOTA_PROJECT,production.projectId);throw Error('mock preflight denial');},env));assert.equal(loadSdk.mock.callCount(),0);assert.deepEqual(env,{});
});
for(const fail of ['firestore','auth','operation','terminate','delete']){
  test(`resources and scoped quota are cleaned after ${fail} failure`,async t=>{
    const env={},f=sdkFixture(t,env,{fail});
    await assert.rejects(()=>withAdministrativeProcess(production,()=>withAdministrativeSdk(production,async()=>{if(fail==='operation')throw Error('mock operation denial');},{env,loadSdk:f.loadSdk}),env));
    assert.equal(f.events.filter(e=>e==='delete').length,1);assert.equal(f.events.filter(e=>e==='terminate').length,fail==='firestore'?0:1);assert.deepEqual(env,{});
  });
}
test('emulators keep demo project, both exact endpoints and no production quota or ADC',async t=>{
  const env={},f=sdkFixture(t,env);
  await withAdministrativeProcess(emulator,()=>withAdministrativeSdk(emulator,async()=>{
    assert.equal(env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8185');assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9199');assert.equal(env.GOOGLE_CLOUD_QUOTA_PROJECT,undefined);
  },{env,loadSdk:f.loadSdk}),env);
  assert(!f.events.includes('adc'));assert.deepEqual(f.events.slice(-2),['terminate','delete']);assert.deepEqual(env,{});
});

test('both CLI dry-runs and denied production actions load no SDK/ADC and make no requests',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'optilab-quota-mocks-'));
  try{
    const loader=join(dir,'deny-sdk.mjs'),preload=join(dir,'guard.mjs');
    await writeFile(loader,`export async function resolve(name,context,next){if(name.startsWith('firebase-admin')||name==='google-auth-library'){console.error('UNAUTHORIZED_SDK_LOAD');throw Error('SDK forbidden in this test');}return next(name,context);}`);
    await writeFile(preload,`import {register} from 'node:module';import {Socket} from 'node:net';register(${JSON.stringify(loader)},import.meta.url);const deny=()=>{console.error('UNAUTHORIZED_NETWORK');process.exit(93);};Socket.prototype.connect=deny;globalThis.fetch=deny;`);
    const env={...process.env};for(const key of ['GOOGLE_CLOUD_QUOTA_PROJECT','GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','OPTILAB_PILOT_OPERATOR_APPROVAL','OPTILAB_PILOT_SECOND_AUTHORIZATION'])delete env[key];
    const admin=['scripts/pilot-admin.mjs','pause','--target','production','--project','optilab-cd829'];
    const activation=['scripts/pilot-activation.mjs','pause','--target','production'];
    const cases=[
      {args:admin,code:0},
      {args:admin,extra:{GOOGLE_CLOUD_QUOTA_PROJECT:production.projectId},code:0},
      {args:activation,extra:{GOOGLE_CLOUD_QUOTA_PROJECT:production.projectId},code:0},
      {args:['scripts/pilot-activation.mjs','plan'],code:0},
      {args:['scripts/pilot-admin.mjs','pause','--target','emulator','--project','demo-optilab-sync'],code:0},
      {args:['scripts/pilot-activation.mjs','pause','--target','emulator'],code:0},
      {args:[...admin,'--execute','--confirm','pause'],code:1},
      {args:[...activation,'--execute','--confirm','pause:pause'],code:1},
      {args:admin,extra:{GOOGLE_CLOUD_QUOTA_PROJECT:'other-project'},code:1},
      {args:activation,extra:{GOOGLE_CLOUD_QUOTA_PROJECT:'other-project'},code:1},
      {args:[...admin,'--execute','--confirm','pause'],extra:{OPTILAB_PILOT_OPERATOR_APPROVAL:'private-pilot-approved-v1',GOOGLE_CLOUD_QUOTA_PROJECT:'other-project'},code:1},
      {args:[...activation,'--execute','--confirm','pause:pause'],extra:{OPTILAB_PILOT_SECOND_AUTHORIZATION:'pause-approved',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'},code:1},
    ];
    for(const item of cases){
      const r=spawnSync(process.execPath,['--import',preload,...item.args],{env:{...env,...item.extra},encoding:'utf8',timeout:10000});
      assert.equal(r.status,item.code,r.stderr);assert.doesNotMatch(r.stdout+r.stderr,/UNAUTHORIZED_SDK_LOAD|UNAUTHORIZED_NETWORK/);
      if(item.code===0){const value=JSON.parse(r.stdout);assert.equal(value.mode,'DRY-RUN');assert.equal(value.network,false);assert.equal(value.writes,false);}
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
