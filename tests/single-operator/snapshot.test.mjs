import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,mkdir,writeFile,symlink,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {captureRules,captureBaseline,saveSnapshot} from '../../server/single-operator/snapshot.mjs';
const release={name:'projects/optilab-cd829/releases/cloud.firestore',rulesetName:'projects/optilab-cd829/rulesets/fictitious',updateTime:'2026-01-01T00:00:00Z'};
const source='// Synthetic source, not production.\r\n';
function getFixture(){const calls=[];return {calls,get:async(url,options)=>{calls.push({url,...options});return url.endsWith('cloud.firestore')?release:{name:release.rulesetName,source:{files:[{content:source}]}};}};}
test('snapshot uses three GETs, exact bytes and private Rules-only recovery config',async()=>{
  const f=getFixture(),snapshot=await captureRules(f.get);assert.equal(snapshot.source,source);assert.equal(f.calls.length,3);assert(f.calls.every(x=>x.method==='GET'));
  const dir=await mkdtemp(join(tmpdir(),'single-snapshot-'));try{
    const out=join(dir,'private');await saveSnapshot(snapshot,out);assert.equal((await stat(out)).mode&0o777,0o700);
    for(const name of ['baseline.rules','snapshot.json','firebase-baseline.json'])assert.equal((await stat(join(out,name))).mode&0o777,0o600);
    assert.equal(await readFile(join(out,'baseline.rules'),'utf8'),source);assert.deepEqual(JSON.parse(await readFile(join(out,'firebase-baseline.json'),'utf8')),{firestore:{rules:join(await realpath(out),'baseline.rules')}});
    await assert.rejects(()=>saveSnapshot(snapshot,out));
    await mkdir(join(dir,'repo'));await writeFile(join(dir,'repo','.git'),'fixture');await assert.rejects(()=>saveSnapshot(snapshot,join(dir,'repo','bad')));
    await symlink(join(dir,'repo'),join(dir,'link'));await assert.rejects(()=>saveSnapshot(snapshot,join(dir,'link','bad')));
    await assert.rejects(()=>saveSnapshot({...snapshot,source:'changed'},join(dir,'corrupt')));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('snapshot denies inaccessible/foreign/multiple source and release rotation',async()=>{
  await assert.rejects(()=>captureRules(async()=>{throw Error('mock 403');}));
  for(const value of [{...release,rulesetName:'projects/other/rulesets/x'},{...release,name:'wrong'},null])await assert.rejects(()=>captureRules(async()=>value));
  for(const files of [[],[{content:'a'},{content:'b'}],[{content:null}]])await assert.rejects(()=>captureRules(async url=>url.endsWith('cloud.firestore')?release:{name:release.rulesetName,source:{files}}));
  let n=0;await assert.rejects(()=>captureRules(async url=>++n===3?{...release,updateTime:'2026-02-01T00:00:00Z'}:url.endsWith('cloud.firestore')?release:{name:release.rulesetName,source:{files:[{content:source}]}}));
});
test('baseline also captures disabled billing and exact approved service inventory via GET only',async()=>{
  const calls=[];
  const get=async(url,options)=>{calls.push(options?.method??'GET');if(url.includes('cloudbilling'))return{billingEnabled:false};if(url.includes('serviceusage'))return{services:[{config:{name:'firestore.googleapis.com'}}]};return url.endsWith('cloud.firestore')?release:{name:release.rulesetName,source:{files:[{content:source}]}};};
  const s=await captureBaseline(get);assert.equal(s.receipt.billing.billingEnabled,false);assert.deepEqual(s.receipt.services.enabled,['firestore.googleapis.com']);assert.equal(s.receipt.approvedServicesSha256.length,64);assert.equal(calls.length,7);assert(calls.every(m=>m==='GET'));
  await assert.rejects(()=>captureBaseline(async(url,options)=>url.includes('cloudbilling')?{billingEnabled:true}:get(url,options)));
});
test('snapshot CLI dry-run never loads ADC; execute requires independent read-only authorization',()=>{
  const args=['scripts/single-operator-snapshot.mjs','--target','production','--project','optilab-cd829'];
  const env={...process.env,GOOGLE_APPLICATION_CREDENTIALS:'/no-real-credentials',SINGLE_OPERATOR_SNAPSHOT_APPROVAL:''};delete env.GOOGLE_CLOUD_QUOTA_PROJECT;
  const dry=spawnSync(process.execPath,args,{env,encoding:'utf8'});assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).network,false);
  const denied=spawnSync(process.execPath,[...args,'--execute','--confirm','snapshot:optilab-cd829','--out','/tmp/not-written'],{env,encoding:'utf8'});assert.notEqual(denied.status,0);
});
