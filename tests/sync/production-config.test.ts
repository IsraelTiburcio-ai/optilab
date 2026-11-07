import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionSyncAllowed,productionSyncTarget} from '../../src/progress/productionConfig';
import {progressSyncMode,syncAllowed} from '../../src/progress/config';
import {createProductionTransport,createProgressTransport} from '../../src/progress/transport';
import type {FirebaseSettings} from '../../src/auth/config';
import {readFileSync} from 'node:fs';

const auth:Extract<FirebaseSettings,{status:'ready'}>={status:'ready',emulatorUrl:null,config:{projectId:'optilab-cd829',authDomain:'optilab-cd829.firebaseapp.com',apiKey:'synthetic-only',appId:'1:123:web:qa',messagingSenderId:'123',storageBucket:'optilab-cd829.firebasestorage.app'}};
const env={VITE_SYNC_PILOT:'private-admission-v1',PROD:true,DEV:false,BASE_URL:'/',VITE_PROGRESS_SYNC:'production',VITE_PROGRESS_SYNC_RELEASE:'private-progress-and-attempts-v1',VITE_PROGRESS_SYNC_PROJECT_ID:'optilab-cd829',VITE_PROGRESS_SYNC_ORIGIN:productionSyncTarget.origin};
test('production is a separate explicit opt-in, disabled by missing/partial flags',()=>{
  assert.equal(productionSyncAllowed(env,auth,productionSyncTarget.origin),true);
  assert.equal(progressSyncMode(env,auth,productionSyncTarget.origin),'production');
  assert.equal(syncAllowed(env,auth,'127.0.0.1'),false);
  assert.equal(progressSyncMode({},auth,productionSyncTarget.origin),'disabled');
  for(const key of Object.keys(env)){const partial={...env} as Record<string,unknown>;delete partial[key];assert.equal(productionSyncAllowed(partial,auth,productionSyncTarget.origin),false,key);}
});
test('production refuses demo/DEV, wrong host/project, emulator endpoints and inconsistent build settings',()=>{
  for(const patch of [{DEV:true},{PROD:false},{VITE_PROGRESS_SYNC:'emulator'},{VITE_PROGRESS_SYNC:'true'},{VITE_PROGRESS_SYNC_RELEASE:'approved'},{BASE_URL:'/optilab/'},{VITE_PROGRESS_SYNC_PROJECT_ID:'demo-optilab-sync'},{VITE_PROGRESS_SYNC_ORIGIN:'https://evil.example'},{VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099'},{VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085'},{VITE_FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'}])assert.equal(productionSyncAllowed({...env,...patch},auth,productionSyncTarget.origin),false);
  for(const origin of ['http://localhost:5196','http://127.0.0.1:5196','https://evil.example','https://optilab.club.evil.example','null',productionSyncTarget.origin+'/path'])assert.equal(progressSyncMode(env,auth,origin),'disabled');
  for(const settings of [{status:'missing',missing:[]},{...auth,emulatorUrl:'http://127.0.0.1:9099'},{...auth,config:{...auth.config,projectId:'demo-optilab-sync'}},{...auth,config:{...auth.config,authDomain:'evil.example'}}] as FirebaseSettings[])assert.equal(productionSyncAllowed(env,settings,productionSyncTarget.origin),false);
});
test('unchanged emulator gates remain DEV + loopback + exact demo + both exact endpoints',()=>{
  const demo={...auth,config:{...auth.config,projectId:'demo-optilab-sync'},emulatorUrl:'http://127.0.0.1:9099'},e={DEV:true,VITE_PROGRESS_SYNC:'emulator',VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085'};
  assert.equal(progressSyncMode(e,demo,'http://127.0.0.1:5195'),'emulator');
  assert.equal(progressSyncMode({...e,DEV:false,PROD:true},demo,'http://127.0.0.1:5195'),'disabled');
  assert.equal(progressSyncMode(e,demo,productionSyncTarget.origin),'disabled');
});
test('production factories reject disabled configuration before locating any app, Auth or Firestore',()=>{
  assert.throws(()=>createProductionTransport('a'),/productiva desactivada/);
  assert.throws(()=>createProgressTransport('a'),/productiva desactivada/);
});
test('ordinary deployment explicitly enables general production; local template remains opt-in',()=>{
  const workflow=readFileSync(new URL('../../.github/workflows/deploy.yml',import.meta.url),'utf8');
  assert.match(workflow,/VITE_PROGRESS_SYNC: production/);assert.match(workflow,/VITE_SYNC_PILOT: ''/);assert.match(workflow,/VITE_PROGRESS_SYNC_RELEASE: general-progress-v1/);assert.match(workflow,/VITE_PROGRESS_SYNC_PROJECT_ID: optilab-cd829/);assert.match(workflow,/VITE_PROGRESS_SYNC_ORIGIN: https:\/\/optilab.club/);
  const template=readFileSync(new URL('../../.env.sync-production.example',import.meta.url),'utf8');assert.match(template,/^VITE_PROGRESS_SYNC=disabled$/m);assert.doesNotMatch(template,/VITE_PROGRESS_SYNC=production/);
});

test('general release has no account allowlist, lease or pilot window; target and identity gates stay strict',()=>{
 const general={...env,VITE_SYNC_PILOT:'',VITE_PROGRESS_SYNC_RELEASE:'general-progress-v1'};
 assert.equal(productionSyncAllowed(general,auth,productionSyncTarget.origin),true);
 for(const patch of [{VITE_SYNC_PILOT:'private-admission-v1'},{VITE_PROGRESS_SYNC:'disabled'},{VITE_PROGRESS_SYNC_PROJECT_ID:'other'},{VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085'}])assert.equal(productionSyncAllowed({...general,...patch},auth,productionSyncTarget.origin),false);
});
