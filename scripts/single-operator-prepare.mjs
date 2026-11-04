import {readFile,mkdir,writeFile,realpath,rm,lstat} from 'node:fs/promises';
import {resolve,dirname,basename,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSession} from '../server/single-operator/preparation.mjs';
import {hash} from '../server/pilot/plan.mjs';

// Deliberately no --execute, credentials, Firebase SDK, fetch, or workflow dispatch.
async function main(){
  const args=process.argv.slice(2),o={};
  for(let i=0;i<args.length;i+=2){if(!['--manifest','--out','--snapshot'].includes(args[i])||o[args[i]]||!args[i+1]||args[i+1].startsWith('--'))throw Error('Options: --manifest FILE [--snapshot BASELINE_RECEIPT] [--out NEW_PRIVATE_DIRECTORY]');o[args[i]]=args[i+1];}
  if(!o['--manifest'])throw Error('Explicit private manifest required');
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const m=JSON.parse(await readFile(o['--manifest'],'utf8'));
  const [base,pilot]=await Promise.all(['firestore.rules','firestore.pilot.rules'].map(p=>readFile(resolve(root,p),'utf8')));
  const bundle=prepareSession(m,{base,pilot});
  let servicesSha256=null;
  if(o['--snapshot']){
    const s=JSON.parse(await readFile(o['--snapshot'],'utf8'));
    if(s.project!=='optilab-cd829'||s.scope!=='read-only-baseline-snapshot'||s.sourceSha256!==m.expectedActiveRulesSha256||s.billing?.billingEnabled!==false||s.services?.status!=='PASS'||!Array.isArray(s.services.enabled)||s.approvedServicesSha256!==hash([...s.services.enabled].sort()))throw Error('Baseline snapshot does not match reviewed target');
    servicesSha256=s.approvedServicesSha256;
  }
  const approval={scope:'single-operator-test-execution-v1',approvedBy:m.operator,approvedAt:null,frontendSha:m.frontendSha,windowDigest:bundle.plan.windowDigest,candidateRulesSha256:bundle.plan.rulesSha256,expectedActiveRulesSha256:m.expectedActiveRulesSha256,approvedServicesSha256:servicesSha256,impactReviewed:false,singleOperatorRiskAccepted:false,allowRulesDeployment:false,allowSessionWrites:false,allowFrontendOn:false,allowFrontendOff:false,allowRecovery:false};
  const usage={source:'console',operator:m.operator,windowHours:24,observedAt:null,evidencePath:null,evidenceSha256:null,counts:Object.fromEntries(Object.keys(m.limits24h).map(k=>[k,null])),storageBytes:null,storageObservedAt:null};
  if(o['--out']){
    const out=resolve(o['--out']),parent=await realpath(dirname(out)),repo=await realpath(root);
    for(let cursor=parent;;cursor=dirname(cursor)){
      try{await lstat(resolve(cursor,'.git'));throw Error('Private output cannot be inside any Git checkout');}
      catch(error){if(error.code!=='ENOENT')throw error;}
      if(dirname(cursor)===cursor)break;
    }
    // Resolve symlinked parents before checking containment. Never write UID-bearing files into Git.
    const outside=relative(repo,parent);
    if(outside===''||(!isAbsolute(outside)&&outside!=='..'&&!outside.startsWith('..'+sep)))throw Error('Output must be outside the repository');
    const approved=await realpath(m.exports.directory),within=relative(approved,parent);
    if(isAbsolute(within)||within==='..'||within.startsWith('..'+sep))throw Error('Output must be inside the declared private export location');
    const destination=resolve(parent,basename(out));
    await mkdir(destination,{mode:0o700});
    try{for(const [file,content] of Object.entries({'candidate.rules':bundle.rules,'firebase-rules.json':JSON.stringify({firestore:{rules:resolve(destination,'candidate.rules')}},null,2),'control-paused.json':JSON.stringify(bundle.control,null,2),'approval-plan.json':JSON.stringify(bundle.plan,null,2),'execution-approval.proposed.json':JSON.stringify(approval,null,2),'usage.proposed.json':JSON.stringify(usage,null,2),'session.json':JSON.stringify(m,null,2)}))await writeFile(resolve(destination,file),content,{mode:0o600,flag:'wx'});}
    catch(error){await rm(destination,{recursive:true,force:true});throw error;}
  }
  console.log(JSON.stringify({mode:bundle.plan.mode,frontendSha:bundle.plan.frontendSha,rulesSha256:bundle.plan.rulesSha256,approvalRequired:true,executionImplemented:bundle.plan.executionImplemented,network:false,productionWrites:false,privateBundleWritten:!!o['--out']}));
}
try{await main();}catch{console.error('BLOCKED: invalid single-operator preparation, changed sources or unsafe output. No network or production actions.');process.exitCode=1;}
