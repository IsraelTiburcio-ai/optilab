import {readFile} from 'node:fs/promises';
import {validateProposal,requireApproval,verifyReceipts,prepareWindow,operateLease,emergencyPause} from '../server/pilot/activation.mjs';
import {inspectPlatform,adcReader,sha256} from '../server/pilot/platform.mjs';
async function main(){
const args=process.argv.slice(2),action=args.shift(),o={};
for(let i=0;i<args.length;i++){const k=args[i];if(!['--manifest','--target','--platform','--usage','--execute','--confirm'].includes(k)||o[k]!==undefined)throw Error('Invalid/duplicate option');o[k]=k==='--execute'?true:args[++i];}
if(!['plan','prepare','open','renew','pause'].includes(action))throw Error('Actions: plan | prepare | open | renew | pause');
const target=o['--target']??'production';if(!['production','emulator'].includes(target))throw Error('Explicit supported target required');
const m=action==='pause'?null:JSON.parse(await readFile(o['--manifest']??'config/private-pilot.proposed.json','utf8'));
const plan=m?validateProposal(m):{digest:'pause'};
if(!o['--execute']){console.log(JSON.stringify({action,target,...plan,mode:'DRY-RUN',network:false,writes:false}));process.exit(0);}
if(action==='plan')throw Error('Plan has no execution mode');
if(o['--confirm']!==`${action}:${plan.digest}`)throw Error('Exact action:digest confirmation required');
if(target==='production'&&process.env.OPTILAB_PILOT_SECOND_AUTHORIZATION!==(action==='pause'?'pause-approved':plan.digest))throw Error('Second explicit owner authorization required');
let receipts;
if(m){requireApproval(m);const rules=await readFile('firestore.pilot.rules','utf8');let platform;
 if(target==='production'){if(o['--platform'])throw Error('Production metadata must be inspected live');platform=await inspectPlatform(await adcReader(),rules);}
 else platform=JSON.parse(await readFile(o['--platform'],'utf8'));
 const usage=JSON.parse(await readFile(o['--usage'],'utf8'));const evidence=await readFile(usage.evidencePath);if(evidence.length>10_000_000||sha256(evidence)!==usage.evidenceSha256)throw Error('Usage screenshot/evidence integrity failed');
 receipts={platform,usage,rulesSha256:sha256(rules)};verifyReceipts(m,receipts);
}
if(target==='production'){if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Emulator overrides forbidden');}
else{for(const [key,value]of Object.entries({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8185',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'})){if(process.env[key]&&process.env[key]!==value)throw Error('Unexpected emulator');process.env[key]=value;}}
const {initializeApp,applicationDefault}=await import('firebase-admin/app');const {getFirestore,Timestamp}=await import('firebase-admin/firestore');const {getAuth}=await import('firebase-admin/auth');
const app=initializeApp({projectId:target==='production'?'optilab-cd829':'demo-optilab-sync',...(target==='production'?{credential:applicationDefault()}:{})}),db=getFirestore(app),auth=getAuth(app);
try{let result;if(action==='pause')result=await emergencyPause(db,Timestamp);if(action==='prepare')result=await prepareWindow(db,auth,Timestamp,m,receipts);if(action==='open'||action==='renew')result=await operateLease(db,auth,Timestamp,m,receipts,{renew:action==='renew'});console.log(JSON.stringify({target,action,...result}));}
catch{console.error('Pilot operation failed. Keep paused; review metadata, usage, grants and local journal. No credentials logged.');process.exitCode=1;}
finally{await db.terminate();}
}
try{await main();}catch{console.error("Pilot operation blocked. Review approval, receipts and access; use emergency pause for a running pilot. No credentials logged.");process.exitCode=1;}
