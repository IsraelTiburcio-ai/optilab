#!/usr/bin/env node
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {exportUid,eraseUid,admit,control,inventory,monitor,pauseWrites} from '../server/pilot/admin.mjs';
import {planUid} from '../server/pilot/plan.mjs';
const args=process.argv.slice(2),command=args.shift();const options={};
for(let i=0;i<args.length;i++){const key=args[i];if(!key.startsWith('--')||options[key]!==undefined)throw Error('Invalid/duplicate option');options[key]=['--execute'].includes(key)?true:args[++i];}
const allowed=['--execute','--target','--project','--uid','--confirm','--plan-hash','--archives'];
if(Object.keys(options).some(k=>!allowed.includes(k))||!['plan','export','erase','admit','pause','monitor'].includes(command))throw Error('Commands: plan | export | erase | admit | pause | monitor. Default: dry-run. Explicit --target emulator|production --project required.');
const target=options['--target'],projectId=options['--project'];
if(target==='emulator'&&projectId==='demo-optilab-sync'){
 if(process.env.FIRESTORE_EMULATOR_HOST&&process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8185'||process.env.FIREBASE_AUTH_EMULATOR_HOST&&process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9199')throw Error('Unexpected emulator');
 process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8185';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9199';
}else if(target==='production'&&projectId==='optilab-cd829'){
 if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST||(options['--execute']&&process.env.OPTILAB_PILOT_OPERATOR_APPROVAL!=='private-pilot-approved-v1'))throw Error('Production requires separate operator authorization and no emulator overrides');
}else throw Error('Explicit supported target/project required');
const uid=options['--uid'],execute=options['--execute']===true;
if(execute&&options['--confirm']!==(uid||command))throw Error('Explicit --confirm UID (or command for global action) required');
if(!execute){console.log(JSON.stringify({mode:'DRY-RUN',command,target,projectId,uid:uid||null,network:false,writes:false}));process.exit(0);}
if(['export','erase'].includes(command)&&!options['--archives'])throw Error('Explicit private --archives directory required');
initializeApp({projectId,...(target==='production'?{credential:applicationDefault()}:{})});const db=getFirestore(),auth=getAuth();let result;
try{
 if(command==='plan'){const p=planUid(uid,await inventory(db));result={uid,hash:p.hash,owned:p.owned,review:p.review,retained:p.retained};}
 if(command==='export'){const x=await exportUid(db,uid,options['--archives']);result={path:x.path,digest:x.digest,planHash:x.plan.hash,review:x.plan.review};}
 if(command==='erase')result=await eraseUid(db,uid,{planHash:options['--plan-hash'],directory:options['--archives'],Timestamp});
 if(command==='admit')result=await admit(db,auth,uid,{Timestamp});
 if(command==='pause'){await pauseWrites(db,Timestamp);result={writesEnabled:false};}
 if(command==='monitor')result=await monitor(db,{execute:true,Timestamp});
 console.log(JSON.stringify({command,target,...result},null,2));
}catch(error){console.error(`Pilot operation failed: ${error.code||'validation/operation error'}. Inspect local audit securely; no credentials printed.`);process.exitCode=1;}
finally{await db.terminate();}
