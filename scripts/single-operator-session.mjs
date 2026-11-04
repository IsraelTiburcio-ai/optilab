import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {administrativeTarget,withAdministrativeProcess,withAdministrativeSdk} from '../server/pilot/admin-process.mjs';
import {prepareSession} from '../server/single-operator/preparation.mjs';
import {hash} from '../server/pilot/plan.mjs';
import {requireExecutionApproval,verifyOperationalReceipts,verifyUsageEvidence,preparePaused,operate,pauseTotal,administrativeMetadata,inspectExecution,preflightBaseline} from '../server/single-operator/execution.mjs';
const actions=['plan','preflight','inspect','prepare','open','renew','recover','pause'];
async function main(){
 const args=process.argv.slice(2),action=args.shift(),o={};
 for(let i=0;i<args.length;i++){const k=args[i];if(!['--manifest','--approval','--usage','--receipt','--approved-source','--platform','--out','--target','--execute','--confirm'].includes(k)||Object.hasOwn(o,k))throw Error('Invalid option');o[k]=k==='--execute'?true:args[++i];if(o[k]===undefined)throw Error('Missing option value');}
 if(!actions.includes(action)||!['emulator','production'].includes(o['--target']))throw Error('Explicit action and target required');
 const scope=administrativeTarget(o['--target'],o['--target']==='production'?'optilab-cd829':'demo-optilab-sync');
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),sources={base:await readFile(resolve(root,'firestore.rules'),'utf8'),pilot:await readFile(resolve(root,'firestore.pilot.rules'),'utf8')};
 const m=action==='pause'?null:JSON.parse(await readFile(o['--manifest'],'utf8'));
 const bundle=m?prepareSession(m,sources):null,digest=bundle?.plan.windowDigest??'pause';
 if(!o['--execute']){console.log(JSON.stringify({action,target:scope.target,windowDigest:digest,mode:'DRY-RUN',network:false,writes:false}));return;}
 if(action==='plan'||o['--confirm']!==`${action}:${digest}`)throw Error('Exact action:digest confirmation required');
 if(scope.target==='production'&&process.env.SINGLE_OPERATOR_EXECUTION_APPROVAL!==(action==='pause'?'pause-approved':digest))throw Error('Independent owner production authorization required');
 const approval=m?JSON.parse(await readFile(o['--approval'],'utf8')):null;
 if(m)requireExecutionApproval(m,sources,approval);
 if(o['--platform']&&scope.target!=='emulator')throw Error('Production metadata cannot use fixture files');
 const usage=m?JSON.parse(await readFile(o['--usage'],'utf8')):null;
 if(usage)verifyUsageEvidence(usage,await readFile(usage.evidencePath));
 await withAdministrativeProcess(scope,async()=>{
  let metadata;
  if(m){if(scope.target==='production')metadata=await administrativeMetadata();else {const fixture=JSON.parse(await readFile(o['--platform'],'utf8'));metadata={get:async url=>{if(url.includes('/releases/'))return fixture.release;if(url.includes('/rulesets/'))return fixture.ruleset;if(url.includes('cloudbilling'))return fixture.billing;if(url.includes('serviceusage'))return fixture.services;throw Error('Unexpected fixture URL');},permissions:async()=>fixture.permissions};}}
  await withAdministrativeSdk(scope,async({db,auth,Timestamp})=>{
   try{
    let result;
    if(action==='pause')result=await pauseTotal(db,Timestamp);
    else if(action==='preflight')result=await preflightBaseline(m,sources,approval,await readFile(o['--approved-source'],'utf8'),metadata,usage);
    else{
     const live=await inspectExecution(db,auth,m,sources,approval,usage,metadata);
     if(action==='inspect')result=live;
     else {
      const receipt=JSON.parse(await readFile(o['--receipt'],'utf8'));verifyOperationalReceipts(m,sources,approval,receipt);
      if(receipt.control.sequence!==live.control.sequence||receipt.control.status!==live.control.status)throw Error('Receipt does not match live control; inspect again');
      result=action==='prepare'?await preparePaused(db,auth,Timestamp,m,sources,approval,receipt):await operate(db,auth,Timestamp,action,m,sources,approval,receipt);
     }
    }
    if(o['--out']){
     // All receipts may contain private identities in usage evidence paths. No shared output.
     const dir=await realpath(dirname(resolve(o['--out']))),stat=await lstat(dir);if((stat.mode&0o077)!==0)throw Error('Private output directory required');
     for(let cursor=dir;;cursor=dirname(cursor)){try{await lstat(resolve(cursor,'.git'));throw Error('Private receipt cannot be inside Git');}catch(error){if(error.code!=='ENOENT')throw error;}if(dirname(cursor)===cursor)break;}
     await writeFile(resolve(dir,resolve(o['--out']).split('/').at(-1)),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
    }
    console.log(JSON.stringify({action,target:scope.target,status:result.status??'PASS',windowDigest:digest,...(result.sequence!==undefined?{sequence:result.sequence}:{}),...(result.expiresAt?{expiresAt:result.expiresAt}:{})}));
   }catch(error){
    if(['prepare','open','renew','recover'].includes(action)){try{await pauseTotal(db,Timestamp);}catch{console.error('EMERGENCY PAUSE FAILED: stop clients; do not renew; lease expiry remains the fail-closed limit.');}}
    throw error;
   }
  });
 });
}
try{await main();}catch{console.error('BLOCKED: single-operator operation failed. No credentials logged; review approved artifacts, live metadata, usage and control.');process.exitCode=1;}
