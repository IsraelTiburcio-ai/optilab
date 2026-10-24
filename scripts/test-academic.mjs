import {spawnSync} from 'node:child_process';
import {academicEnvironment} from './academic-env.mjs';
if(process.argv.length!==2||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('ACADEMIC_ENV_REJECTED');
const env=academicEnvironment();delete env.FIRESTORE_EMULATOR_HOST;delete env.FIREBASE_AUTH_EMULATOR_HOST;
const result=spawnSync('npx',['--yes','firebase-tools@15.0.0','emulators:exec','--only','auth,firestore','--project','demo-optilab-sync',
  '--config','firebase.sync-emulator.json','node scripts/academic-test-child.mjs'],{stdio:'inherit',env:{...env,ACADEMIC_BOOTSTRAP:'synthetic-v1',ACADEMIC_RATE_LIMIT:'10000'}});
process.exit(result.status??1);
