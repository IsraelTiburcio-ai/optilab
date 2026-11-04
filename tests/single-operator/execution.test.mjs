import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
import {requireExecutionApproval,verifyOperationalReceipts,administrativeMetadata,requiredPermissions,deploymentPermissions} from '../../server/single-operator/execution.mjs';
import {executionFixture,sources} from './execution-fixture.mjs';
test('single execution approval is separate, artifact-bound and has explicit recovery scopes',()=>{
 const now=Date.now(),f=executionFixture(now);assert.equal(requireExecutionApproval(f.m,sources,f.approval,now).windowDigest,f.bundle.plan.windowDigest);
 for(const patch of [{scope:'private-pilot-v1'},{frontendSha:'c'.repeat(40)},{windowDigest:'c'.repeat(64)},{candidateRulesSha256:'c'.repeat(64)},{expectedActiveRulesSha256:'c'.repeat(64)},{approvedBy:'other-owner'},{impactReviewed:false},{singleOperatorRiskAccepted:false},{allowFrontendOff:false},{allowRecovery:false},{allowSessionWrites:undefined}])assert.throws(()=>requireExecutionApproval(f.m,sources,{...f.approval,...patch},now));
});
test('receipts reject stale metadata, wrong Rules, billing, services, unknown quota/storage and missing permissions',()=>{
 const now=Date.now(),f=executionFixture(now);assert.doesNotThrow(()=>verifyOperationalReceipts(f.m,sources,f.approval,f.receipt,now));
 for(const mutate of [r=>r.observedAt=new Date(now-300001).toISOString(),r=>r.platform.rules.candidateDeployed=false,r=>r.platform.rules.sourceSha256='c'.repeat(64),r=>r.platform.billing.billingEnabled=true,r=>r.platform.services.enabled.push('unapproved.googleapis.com'),r=>r.permissions.granted.splice(0,1),r=>delete r.usage.counts.reads,r=>r.usage.counts.writes=1000,r=>delete r.usage.storageBytes,r=>r.usage.storageBytes=1073741824,r=>r.usage.storageObservedAt=new Date(now-300001).toISOString(),r=>r.control.sequence=-1]){const r=structuredClone(f.receipt);mutate(r);assert.throws(()=>verifyOperationalReceipts(f.m,sources,f.approval,r,now));}
});
test('metadata adapter uses GET plus only read-only testIamPermissions POST; no mutation endpoints',async()=>{
 const calls=[];class GoogleAuth{constructor(options){assert.deepEqual(options.scopes,['https://www.googleapis.com/auth/cloud-platform']);}async getClient(){return {request:async options=>{calls.push(options);return {data:options.method==='POST'?{permissions:[...requiredPermissions,...deploymentPermissions]}:{ok:true}};}};}}
 const adapter=await administrativeMetadata({loadAuth:async()=>({GoogleAuth})});await adapter.get('https://firebaserules.googleapis.com/v1/projects/optilab-cd829/releases/cloud.firestore');const got=await adapter.permissions();assert(got.includes('datastore.databases.get'));assert.equal(calls.length,2);assert.equal(calls[0].method,'GET');assert.equal(calls[1].method,'POST');assert.equal(calls[1].url,'https://cloudresourcemanager.googleapis.com/v1/projects/optilab-cd829:testIamPermissions');assert.deepEqual(calls[1].data.permissions,[...requiredPermissions,...deploymentPermissions]);
 await assert.rejects(()=>adapter.get('https://evil.example/'));await assert.rejects(()=>adapter.get('http://firebaserules.googleapis.com/'));assert.equal(calls.length,2);assert(calls.every(x=>!/:enable|setIamPolicy|billingInfo:/.test(x.url)));
});
test('session CLI defaults offline and refuses production before ADC without exact separate authorization',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'single-cli-gate-'));try{const f=executionFixture(),file=join(dir,'session.json');await writeFile(file,JSON.stringify(f.m));
 const clean={...process.env};delete clean.SINGLE_OPERATOR_EXECUTION_APPROVAL;delete clean.GOOGLE_CLOUD_QUOTA_PROJECT;clean.GOOGLE_APPLICATION_CREDENTIALS='/no-credentials';
 const args=['scripts/single-operator-session.mjs','prepare','--target','production','--manifest',file];const dry=spawnSync(process.execPath,args,{env:clean,encoding:'utf8'});assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).network,false);assert.equal(JSON.parse(dry.stdout).writes,false);assert(!dry.stdout.includes(f.m.uid));
 const denied=spawnSync(process.execPath,[...args,'--execute','--confirm','prepare:'+f.bundle.plan.windowDigest],{env:clean,encoding:'utf8'});assert.notEqual(denied.status,0);assert.match(denied.stderr,/BLOCKED/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
