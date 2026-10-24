import {test} from 'node:test';
import assert from 'node:assert/strict';
import {academicAllowed} from '../../src/academic/config';
import type {FirebaseSettings} from '../../src/auth/config';
// @ts-expect-error Plain ESM launcher, executed without SDK imports.
import {teacherEnvironment} from '../../scripts/teacher-env.mjs';
const auth:FirebaseSettings={status:'ready',config:{projectId:'demo-optilab-sync',apiKey:'fake',authDomain:'demo-optilab-sync.firebaseapp.com',storageBucket:'demo',messagingSenderId:'123',appId:'1:123:web:demo'},emulatorUrl:'http://127.0.0.1:9099'};
const env={DEV:true,VITE_ACADEMIC_ADMIN:'emulator',VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085'};
test('teacher gate requires every exact emulator condition together',()=>{
  assert.equal(academicAllowed(env,auth,'127.0.0.1'),true);assert.equal(academicAllowed(env,auth,'localhost'),true);
  for(const patch of [{DEV:false},{VITE_ACADEMIC_ADMIN:undefined},{VITE_ACADEMIC_ADMIN:'production'},{VITE_FIRESTORE_EMULATOR_HOST:undefined},{VITE_FIRESTORE_EMULATOR_HOST:'remote.example:8085'}])assert.equal(academicAllowed({...env,...patch},auth,'localhost'),false);
  for(const host of ['israeltiburcio-ai.github.io','example.test','0.0.0.0'])assert.equal(academicAllowed(env,auth,host),false);
  for(const config of [{...auth,emulatorUrl:null},{...auth,emulatorUrl:'http://localhost:9099'},{...auth,config:{...auth.config,projectId:'optilab-cd829'}},{status:'missing',missing:[]} as FirebaseSettings])assert.equal(academicAllowed(env,config,'localhost'),false);
});
test('teacher launcher rejects incompatible inherited values rather than selecting a real project',()=>{
  assert.equal(teacherEnvironment({}).VITE_ACADEMIC_ADMIN,'emulator');
  for(const patch of [{NODE_ENV:'production'},{VITE_FIREBASE_PROJECT_ID:'optilab-cd829'},{VITE_ACADEMIC_ADMIN:'production'},{FIREBASE_CONFIG:'sensitive'},{GOOGLE_APPLICATION_CREDENTIALS:'sensitive'},{VITE_FIREBASE_AUTH_EMULATOR_URL:'http://example.com:9099'}])assert.throws(()=>teacherEnvironment(patch),/ACADEMIC_ENV_REJECTED/);
});
