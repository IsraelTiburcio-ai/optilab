import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionSyncAllowed,productionSessionKind,singleOperatorWindowAllowed,observeSingleOperatorExpiry} from '../../src/progress/productionConfig';
import {MemoryStorage} from '../../src/progress/storage';
import {ProgressEngine} from '../../src/progress/engine';
import {blankSnapshot} from '../../src/progress/model';
import type {FirebaseSettings} from '../../src/auth/config';
const now=Date.now(),env={PROD:true,DEV:false,BASE_URL:'/',VITE_PROGRESS_SYNC:'production',VITE_PROGRESS_SYNC_RELEASE:'single-operator-test-v1',VITE_SYNC_PILOT:'single-operator-test-v1',VITE_PROGRESS_SYNC_PROJECT_ID:'optilab-cd829',VITE_PROGRESS_SYNC_ORIGIN:'https://optilab.club',VITE_SINGLE_OPERATOR_DIGEST:'a'.repeat(64),VITE_SINGLE_OPERATOR_START:new Date(now-60000).toISOString(),VITE_SINGLE_OPERATOR_END:new Date(now+60000).toISOString()};
const auth:Extract<FirebaseSettings,{status:'ready'}>={status:'ready',emulatorUrl:null,config:{projectId:'optilab-cd829',authDomain:'optilab-cd829.firebaseapp.com',apiKey:'synthetic',appId:'fixture',messagingSenderId:'fixture',storageBucket:'fixture'}};
test('single production gate is exact, independent of private pilot and expires',()=>{
  assert.equal(productionSessionKind(env),'single-operator-test');assert(productionSyncAllowed(env,auth,'https://optilab.club',now));
  for(const key of Object.keys(env)){const copy={...env} as Record<string,unknown>;delete copy[key];assert.equal(productionSyncAllowed(copy,auth,'https://optilab.club',now),false,key);}
  for(const change of [{VITE_SYNC_PILOT:'private-admission-v1'},{VITE_PROGRESS_SYNC_RELEASE:'private-progress-and-attempts-v1'},{VITE_SINGLE_OPERATOR_DIGEST:'bad'},{VITE_SINGLE_OPERATOR_END:new Date(now+7200001).toISOString()},{VITE_PROGRESS_SYNC:'disabled'}])assert.equal(productionSyncAllowed({...env,...change},auth,'https://optilab.club',now),false);
  assert.equal(productionSyncAllowed(env,auth,'http://localhost',now),false);assert.equal(productionSyncAllowed(env,auth,'https://optilab.club',now+60000),false);assert.equal(singleOperatorWindowAllowed(env,now-60001),false);
});
test('mounted single-session expiry closes watchers once while preserving account journal and export',async()=>{
  let time=now,task=()=>{},closed=0,expired=0;
  const storage=new MemoryStorage(),engine=new ProgressEngine('fictitious-owner',storage,{watch(next){next(blankSnapshot());return ()=>{closed++;};},async commit(){throw Error('Test must not send');}},100000);
  engine.start();await engine.keepRemote();engine.change({...engine.getSnapshot().progress,nickname:'Conservar pendiente'});
  const stop=observeSingleOperatorExpiry(env,()=>{expired++;engine.suspend('Ventana finalizada');},{now:()=>time,set:fn=>{task=fn;return 1;},clear:()=>{}});
  time=now+60000;task();task();assert.equal(expired,1);assert.equal(closed,1);assert.equal(engine.getSnapshot().pending,1);assert.match(engine.getSnapshot().error,/Ventana finalizada/);
  assert.equal(JSON.parse((await engine.exportBackup()).raw).nickname,'Conservar pendiente');stop();engine.dispose();
});
