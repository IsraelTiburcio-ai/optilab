import {spawnSync} from 'node:child_process';
import {academicEnvironment} from './academic-env.mjs';
// emulators:exec adds this synthetic config AFTER the parent rejected inherited
// FIREBASE_CONFIG. Validate the exact CLI-generated values; never pass them to SDKs.
if(process.argv.length!==2)throw new Error('ACADEMIC_ENV_REJECTED');
const expected={projectId:'demo-optilab-sync',storageBucket:'demo-optilab-sync.appspot.com',databaseURL:'https://demo-optilab-sync.firebaseio.com'};
let generated;try{generated=JSON.parse(process.env.FIREBASE_CONFIG??'');}catch{throw new Error('ACADEMIC_ENV_REJECTED');}
if(!generated||typeof generated!=='object'||Object.keys(generated).length!==3||Object.entries(expected).some(([k,v])=>generated[k]!==v)||
  process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw new Error('ACADEMIC_ENV_REJECTED');
const env={...process.env};delete env.FIREBASE_CONFIG;
const result=spawnSync('npm',['run','test:academic:api'],{stdio:'inherit',env:academicEnvironment(env)});
process.exit(result.status??1);
