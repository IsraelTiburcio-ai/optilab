import {readFile,appendFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireExecutionApproval,verifyOperationalReceipts} from '../server/single-operator/execution.mjs';

const owner='IsraelTiburcio-ai',repository=owner+'/optilab';
const must=(ok,message)=>{if(!ok)throw Error(message);};
export function buildContext(action,context){
  must(['on','off'].includes(action),'Explicit on/off publication required');
  must(context.repository===repository&&context.ref==='refs/heads/main'&&context.event==='workflow_dispatch','Manual main-only release required');
  must(context.actor?.toLowerCase()===owner.toLowerCase()&&context.triggeringActor?.toLowerCase()===owner.toLowerCase(),'Only the actual repository owner can publish');
  must(typeof context.expectedSha==='string'&&/^[a-f0-9]{40}$/.test(context.expectedSha)&&context.sha===context.expectedSha&&context.mainSha===context.expectedSha,'Exact approved current main SHA required');
}
export function frontendEnvironment(action,{context,manifest,sources,approval,receipt,digest,now=Date.now()}){
  buildContext(action,context);
  const env={OPTILAB_PAGES_TARGET:'optilab.club',VITE_PROGRESS_SYNC:'disabled',VITE_PROGRESS_SYNC_RELEASE:'',VITE_SYNC_PILOT:'',
    VITE_PROGRESS_SYNC_PROJECT_ID:'',VITE_PROGRESS_SYNC_ORIGIN:'',VITE_FIREBASE_AUTH_EMULATOR_URL:'',VITE_FIRESTORE_EMULATOR_HOST:'',
    VITE_SINGLE_OPERATOR_DIGEST:'',VITE_SINGLE_OPERATOR_START:'',VITE_SINGLE_OPERATOR_END:'',VITE_ACADEMIC_ADMIN:'disabled'};
  let windowDigest=null,rulesSha256=null;
  if(action==='on'){
    const checked=requireExecutionApproval(manifest,sources,approval,now);
    must(approval.allowFrontendOn===true,'Frontend ON not authorized');
    must(manifest.operator.toLowerCase()===owner.toLowerCase()&&manifest.frontendSha===context.expectedSha,'Owner and frontend approval mismatch');
    must(checked.windowDigest===digest,'Exact approved window digest required');
    must(now>=checked.start&&now+60000<checked.end,'Publication requires a current window with at least one minute remaining');
    verifyOperationalReceipts(manifest,sources,approval,receipt,now);
    must(receipt.control.status==='PAUSED','Publish while server control is paused; open afterwards');
    Object.assign(env,{VITE_PROGRESS_SYNC:'production',VITE_PROGRESS_SYNC_RELEASE:'single-operator-test-v1',VITE_SYNC_PILOT:'single-operator-test-v1',
      VITE_PROGRESS_SYNC_PROJECT_ID:'optilab-cd829',VITE_PROGRESS_SYNC_ORIGIN:'https://optilab.club',
      VITE_SINGLE_OPERATOR_DIGEST:digest,VITE_SINGLE_OPERATOR_START:manifest.startAt,VITE_SINGLE_OPERATOR_END:manifest.endAt});
    windowDigest=digest;rulesSha256=checked.bundle.plan.rulesSha256;
  }
  // OFF recovery intentionally has no dependency on expired session secrets/receipts.
  return {env,stamp:{version:1,mode:'single-operator-test',sync:action==='on'?'ON':'OFF',frontendSha:context.expectedSha,
    windowDigest,rulesSha256,observedAt:new Date(now).toISOString()}};
}
async function main(){
  const o={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i];must(['--action','--manifest','--approval','--receipt','--stamp'].includes(k)&&!o[k]&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Invalid build options');o[k]=process.argv[i+1];}
  const context={repository:process.env.GITHUB_REPOSITORY,actor:process.env.GITHUB_ACTOR,triggeringActor:process.env.GITHUB_TRIGGERING_ACTOR,
    ref:process.env.GITHUB_REF,event:process.env.GITHUB_EVENT_NAME,sha:process.env.GITHUB_SHA,mainSha:process.env.SINGLE_OPERATOR_MAIN_SHA,expectedSha:process.env.SINGLE_OPERATOR_EXPECTED_SHA};
  buildContext(o['--action'],context);
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');let manifest,approval,receipt,sources;
  if(o['--action']==='on'){
    must(['--manifest','--approval','--receipt'].every(k=>o[k]),'Private release files required');
    [manifest,approval,receipt]=await Promise.all(['--manifest','--approval','--receipt'].map(async k=>JSON.parse(await readFile(o[k],'utf8'))));
    const [base,pilot]=await Promise.all(['firestore.rules','firestore.pilot.rules'].map(f=>readFile(resolve(root,f),'utf8')));sources={base,pilot};
    must(['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'].every(k=>process.env['VITE_FIREBASE_'+k])
      &&process.env.VITE_FIREBASE_PROJECT_ID==='optilab-cd829'&&process.env.VITE_FIREBASE_AUTH_DOMAIN==='optilab-cd829.firebaseapp.com','Public Firebase target mismatch');
  }
  const result=frontendEnvironment(o['--action'],{context,manifest,approval,receipt,sources,digest:process.env.SINGLE_OPERATOR_DIGEST});
  must(process.env.GITHUB_ENV,'Workflow environment file required');await appendFile(process.env.GITHUB_ENV,Object.entries(result.env).map(([k,v])=>`${k}=${v}\n`).join(''));
  if(o['--stamp'])await writeFile(o['--stamp'],JSON.stringify(result.stamp,null,2)+'\n',{mode:0o644});
  console.log(JSON.stringify({action:o['--action'],frontendSha:context.expectedSha,privateDataExported:false}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Single-operator frontend BLOCKED. Review owner, exact SHA, approvals and fresh paused receipts. No private data logged.');process.exitCode=1;});
