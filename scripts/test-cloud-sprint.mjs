import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';
if(process.argv.length!==2||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Use isolated cloud sprint launcher without endpoint overrides');
const dir=await mkdtemp(join(tmpdir(),'optilab-cloud-'));
try{const config=join(dir,'firebase.json');await writeFile(config,JSON.stringify({firestore:{rules:resolve('firestore.rules'),indexes:resolve('firestore.indexes.json')},emulators:{auth:{host:'127.0.0.1',port:9199},firestore:{host:'127.0.0.1',port:8185},hub:{host:'127.0.0.1',port:4411},logging:{host:'127.0.0.1',port:4511},ui:{enabled:false},singleProjectMode:true}}));
 const child=spawnSync('npx',['--yes','firebase-tools@15.0.0','emulators:exec','--only','auth,firestore','--project','demo-optilab-sync','--config',config,'npm run test:sync:core && npm run test:firestore:rules && npm run test:sync:ui -- --browser chromium && npm run test:sync:ui -- --browser webkit'],{stdio:'inherit',env:{...process.env,CLOUD_QA_ISOLATED:'1',GCLOUD_PROJECT:'demo-optilab-sync',GOOGLE_CLOUD_PROJECT:'demo-optilab-sync'}});process.exitCode=child.status??1;
}finally{await rm(dir,{recursive:true,force:true});}
