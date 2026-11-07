import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {frontendEnvironment,buildContext} from '../../scripts/single-operator-build.mjs';
import {prepareSession} from '../../server/single-operator/preparation.mjs';
import {requiredPermissions} from '../../server/single-operator/execution.mjs';
import {hash} from '../../server/pilot/plan.mjs';
import {session,sources} from './fixture.mjs';
function fixture(){
  const now=Date.now(),manifest={...session(now),operator:'IsraelTiburcio-ai'},b=prepareSession(manifest,sources);
  const context={repository:'IsraelTiburcio-ai/optilab',actor:'IsraelTiburcio-ai',triggeringActor:'IsraelTiburcio-ai',ref:'refs/heads/main',event:'workflow_dispatch',sha:manifest.frontendSha,mainSha:manifest.frontendSha,expectedSha:manifest.frontendSha};
  const approval={scope:'single-operator-test-execution-v1',approvedBy:manifest.operator,approvedAt:new Date(now-1000).toISOString(),frontendSha:manifest.frontendSha,windowDigest:b.plan.windowDigest,candidateRulesSha256:b.plan.rulesSha256,expectedActiveRulesSha256:manifest.expectedActiveRulesSha256,approvedServicesSha256:hash(['firestore.googleapis.com']),impactReviewed:true,singleOperatorRiskAccepted:true,allowRulesDeployment:true,allowSessionWrites:true,allowFrontendOn:true,allowFrontendOff:true,allowRecovery:true};
  const receipt={version:1,project:manifest.project,observedAt:new Date(now).toISOString(),windowDigest:b.plan.windowDigest,candidateRulesSha256:b.plan.rulesSha256,
    platform:{rules:{status:'PASS',candidateDeployed:true,sourceSha256:b.plan.rulesSha256},billing:{status:'PASS',billingEnabled:false},services:{status:'PASS',enabled:['firestore.googleapis.com']}},
    usage:{source:'console',operator:manifest.operator,windowHours:24,storageBytes:1000,storageObservedAt:new Date(now).toISOString(),observedAt:new Date(now).toISOString(),evidenceSha256:'a'.repeat(64),counts:{reads:1,writes:1,deletes:0,documents:1,largestAccount:1}},permissions:{status:'PASS',granted:requiredPermissions},control:{status:'PAUSED',windowDigest:b.plan.windowDigest,sequence:1}};
  return {now,manifest,sources,approval,receipt,context,digest:b.plan.windowDigest};
}
test('single ON binds owner/current SHA/digest/paused receipts; no raw UID or private decisions enter build',()=>{
  const f=fixture(),result=frontendEnvironment('on',f);
  assert.equal(result.env.VITE_INTEGRATED_PROGRESS,'pilot-v1');assert.equal(result.env.VITE_ACADEMIC_API_MODE,'production');assert.equal(result.env.VITE_PROGRESS_SYNC,'production');assert.equal(result.env.VITE_SYNC_PILOT,'single-operator-test-v1');
  assert.equal(result.env.VITE_SINGLE_OPERATOR_END,f.manifest.endAt);assert(!JSON.stringify(result).includes(f.manifest.uid));
  assert.equal(result.stamp.rulesSha256,f.approval.candidateRulesSha256);assert.equal(result.stamp.frontendSha,f.manifest.frontendSha);
});
test('ON rejects unapproved, expired, stale, opened, mismatched and nonowner releases',()=>{
  const f=fixture();
  for(const change of [{digest:'b'.repeat(64)},{now:Date.parse(f.manifest.endAt)},
    {approval:{...f.approval,allowFrontendOn:false}},{context:{...f.context,actor:'someone-else'}},
    {context:{...f.context,triggeringActor:'someone-else'}},{context:{...f.context,ref:'refs/heads/other'}},
    {context:{...f.context,event:'push'}},{context:{...f.context,mainSha:'c'.repeat(40)}},
    {receipt:{...f.receipt,observedAt:new Date(f.now-300001).toISOString()}},
    {receipt:{...f.receipt,control:{...f.receipt.control,status:'OPEN'}}},
    {receipt:{...f.receipt,platform:{...f.receipt.platform,billing:{status:'PASS',billingEnabled:true}}}}])
    assert.throws(()=>frontendEnvironment('on',{...f,...change}));
});
test('OFF clears every Sync gate even without manifest, receipts or expired secrets',()=>{
  const f=fixture(),off=frontendEnvironment('off',{context:f.context,now:f.now});
  assert.equal(off.env.VITE_INTEGRATED_PROGRESS,'');assert.equal(off.env.VITE_ACADEMIC_API_MODE,'production');assert.equal(off.env.VITE_PROGRESS_SYNC,'disabled');assert.equal(off.env.VITE_SYNC_PILOT,'');assert.equal(off.env.VITE_SINGLE_OPERATOR_DIGEST,'');assert.equal(off.env.VITE_SINGLE_OPERATOR_START,'');assert.equal(off.env.VITE_SINGLE_OPERATOR_END,'');
  assert.equal(off.stamp.sync,'OFF');assert.equal(off.stamp.windowDigest,null);
  assert.throws(()=>buildContext('off',{...f.context,actor:'someone-else'}));
});
test('release is manual, main/owner-only, OFF default, same Pages lock; original pilot untouched',()=>{
  const workflow=readFileSync('.github/workflows/single-operator-frontend.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/^  (push|schedule|pull_request):/m);
  assert.match(workflow,/default: off/);assert.match(workflow,/github.actor == github.repository_owner/);assert.match(workflow,/group: pages/);
  assert.match(workflow,/Recheck and stamp final artifact/);assert.doesNotMatch(workflow,/firebase deploy|private-pilot-approval|PILOT_MANIFEST_JSON/);
  const normal=readFileSync('.github/workflows/deploy.yml','utf8');assert.match(normal,/VITE_PROGRESS_SYNC: disabled/);
});
test('OFF CLI needs no private file, credentials or network and emits an auditable public stamp',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'optilab-frontend-off-'));try{
    const guard=join(dir,'guard.mjs'),envFile=join(dir,'github-env'),stamp=join(dir,'stamp.json');
    await writeFile(guard,"import {Socket} from 'node:net';Socket.prototype.connect=()=>{throw Error('Network forbidden');};globalThis.fetch=()=>{throw Error('Fetch forbidden');};");
    const f=fixture(),result=spawnSync(process.execPath,['--import',guard,'scripts/single-operator-build.mjs','--action','off','--manifest','/missing/private.json','--approval','/missing/approval.json','--receipt','/missing/receipt.json','--stamp',stamp],{encoding:'utf8',env:{...process.env,
      GOOGLE_APPLICATION_CREDENTIALS:'/missing/no-credentials',GITHUB_REPOSITORY:f.context.repository,GITHUB_ACTOR:f.context.actor,GITHUB_TRIGGERING_ACTOR:f.context.triggeringActor,GITHUB_REF:f.context.ref,GITHUB_EVENT_NAME:f.context.event,GITHUB_SHA:f.context.sha,SINGLE_OPERATOR_MAIN_SHA:f.context.mainSha,SINGLE_OPERATOR_EXPECTED_SHA:f.context.expectedSha,GITHUB_ENV:envFile}});
    assert.equal(result.status,0,result.stderr);assert.match(await readFile(envFile,'utf8'),/VITE_PROGRESS_SYNC=disabled\n/);assert.equal(JSON.parse(await readFile(stamp,'utf8')).sync,'OFF');assert(!result.stdout.includes(f.manifest.uid));
  }finally{await rm(dir,{recursive:true,force:true});}
});
