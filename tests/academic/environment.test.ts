import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {localConfig} from '../../server/academic/config';
import {academicPath} from '../../server/academic/repository';
// @ts-expect-error The launch guard is deliberately plain Node ESM.
import {academicEnvironment} from '../../scripts/academic-env.mjs';
const valid={NODE_ENV:'development',ACADEMIC_ADMIN_MODE:'emulator',ACADEMIC_ADMIN_HOST:'127.0.0.1',ACADEMIC_ADMIN_PROJECT:'demo-optilab-sync',
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085'};
test('strict local configuration accepts only the exact explicit emulator environment',()=>assert.equal(localConfig(valid).projectId,'demo-optilab-sync'));
for(const [name,patch] of Object.entries({
  project:{ACADEMIC_ADMIN_PROJECT:'optilab-cd829'},host:{ACADEMIC_ADMIN_HOST:'example.com'},allInterfaces:{ACADEMIC_ADMIN_HOST:'0.0.0.0'},
  production:{NODE_ENV:'production'},disabled:{ACADEMIC_ADMIN_MODE:'disabled'},missingMode:{ACADEMIC_ADMIN_MODE:undefined},
  missingAuth:{FIREBASE_AUTH_EMULATOR_HOST:undefined},missingFirestore:{FIRESTORE_EMULATOR_HOST:undefined},
  remoteAuth:{FIREBASE_AUTH_EMULATOR_HOST:'optilab-cd829.firebaseapp.com'},remoteFirestore:{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com'},
  credentialFile:{GOOGLE_APPLICATION_CREDENTIALS:'SENSITIVE_DO_NOT_PRINT'},credentialJson:{FIREBASE_SERVICE_ACCOUNT:'SENSITIVE_DO_NOT_PRINT'},
  inheritedConfig:{FIREBASE_CONFIG:'SENSITIVE_DO_NOT_PRINT'},inheritedProject:{GCLOUD_PROJECT:'optilab-cd829'},cloudRuntime:{K_SERVICE:'service'},
  metadata:{GCE_METADATA_HOST:'remote.example'},portInjection:{ACADEMIC_ADMIN_PORT:'@remote.example'},
}))test(`startup refuses ${name} before privileged initialization and never prints inherited secrets`,()=>{
  const env={...process.env,...valid,...patch};delete env.NODE_TEST_CONTEXT;
  const child=spawnSync(process.execPath,['--import','tsx','server/academic/main.ts'],{env,encoding:'utf8',timeout:10000});
  assert.notEqual(child.status,0);assert.match(child.stderr,/ACADEMIC_ENV_REJECTED/);assert.doesNotMatch(child.stdout+child.stderr,/SENSITIVE_DO_NOT_PRINT/);
  if(Object.values(patch).every(v=>v!==undefined))assert.throws(()=>academicEnvironment({...valid,...patch}),/ACADEMIC_ENV_REJECTED/);
});
test('academic repository cannot address progress, Auth identities, histories, or arbitrary collections',()=>{
  for(const path of ['users/a/sync/current','users/a/epochs/1/fields/nickname','users/a/progress/current','users/a',
    'staff/a','courses/c/terms/t/groups/g/activityAttempts/run','courses/c/../../users/a/sync/current'])assert.throws(()=>academicPath(path));
});
test('unavailable emulators stop startup before loading privileged SDK or credential discovery',()=>{
  const env={...process.env,...valid};delete env.NODE_TEST_CONTEXT;
  const code=`import {Socket} from 'node:net';
    import {createRequire} from 'node:module';
    import {emulatorAdmin} from './server/academic/sdk.ts';
    Socket.prototype.connect=function(){queueMicrotask(()=>this.emit('error',new Error('synthetic offline')));return this;};
    try{await emulatorAdmin();process.exit(2);}catch(error){
      if(error.message!=='ACADEMIC_EMULATORS_UNAVAILABLE')throw error;
      if(Object.keys(createRequire(import.meta.url).cache).some(path=>/firebase-admin|google-auth-library/.test(path)))process.exit(3);
      console.log('EMULATOR_STARTUP_REFUSED');
    }`;
  const child=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',code],{env,encoding:'utf8',timeout:10000});
  assert.equal(child.status,0);assert.match(child.stdout,/EMULATOR_STARTUP_REFUSED/);
});
