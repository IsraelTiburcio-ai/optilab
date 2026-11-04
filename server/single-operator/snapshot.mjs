import {mkdir,writeFile,realpath,lstat,rm} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {sha256} from './preparation.mjs';
import {inspectPlatform} from '../pilot/platform.mjs';
import {hash} from '../pilot/plan.mjs';

/** Metadata/source GETs only; no application documents, IAM, SDK or credentials. */
export async function captureRules(get,clock=Date.now){
  if(typeof get!=='function')throw Error('Read-only GET adapter required');
  const started=clock(),root='https://firebaserules.googleapis.com/v1/',name='projects/optilab-cd829/releases/cloud.firestore';
  const before=await get(root+name,{method:'GET'});
  if(before?.name!==name||!/^projects\/optilab-cd829\/rulesets\/[A-Za-z0-9_-]+$/.test(before.rulesetName)||!Number.isFinite(Date.parse(before.updateTime)))throw Error('Invalid active release');
  const ruleset=await get(root+before.rulesetName,{method:'GET'}),files=ruleset?.source?.files;
  if(ruleset?.name!==before.rulesetName||!Array.isArray(files)||files.length!==1||typeof files[0].content!=='string'||!files[0].content)throw Error('Exact single source unavailable');
  const after=await get(root+name,{method:'GET'}),finished=clock();
  if(after?.name!==name||after.rulesetName!==before.rulesetName||after.updateTime!==before.updateTime||!Number.isFinite(started)||!Number.isFinite(finished)||finished<started||finished-started>300000)throw Error('Release changed or snapshot stale');
  return {source:files[0].content,receipt:{version:1,project:'optilab-cd829',observedAt:new Date(finished).toISOString(),release:name,ruleset:before.rulesetName,updatedAt:before.updateTime,sourceSha256:sha256(files[0].content),scope:'read-only-baseline-snapshot',productionWrites:false}};
}

export async function captureBaseline(get,clock=Date.now){
  const started=clock(),snapshot=await captureRules(get,clock),platform=await inspectPlatform(get,snapshot.source),finished=clock();
  if(platform.rules.status!=='PASS'||platform.rules.sourceSha256!==snapshot.receipt.sourceSha256||platform.rules.updatedAt!==snapshot.receipt.updatedAt
    ||platform.billing.status!=='PASS'||platform.billing.billingEnabled!==false||platform.services.status!=='PASS'
    ||finished<started||finished-started>300000)throw Error('Baseline Rules, billing or service evidence unavailable/changed');
  snapshot.receipt={...snapshot.receipt,observedAt:new Date(finished).toISOString(),billing:platform.billing,services:platform.services,approvedServicesSha256:hash([...platform.services.enabled].sort())};
  return snapshot;
}

export async function saveSnapshot(snapshot,directory){
  if(sha256(snapshot.source)!==snapshot.receipt.sourceSha256)throw Error('Snapshot integrity mismatch');
  const parent=await realpath(dirname(resolve(directory)));
  for(let p=parent;;p=dirname(p)){
    try{await lstat(resolve(p,'.git'));throw Error('Snapshot must be outside Git');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(p===dirname(p))break;
  }
  const out=resolve(parent,basename(resolve(directory)));await mkdir(out,{mode:0o700});
  try{
    for(const [name,value]of Object.entries({'baseline.rules':snapshot.source,'snapshot.json':JSON.stringify(snapshot.receipt,null,2),'firebase-baseline.json':JSON.stringify({firestore:{rules:resolve(out,'baseline.rules')}},null,2)}))
      await writeFile(resolve(out,name),value,{mode:0o600,flag:'wx'});
  }catch(e){await rm(out,{recursive:true,force:true});throw e;}
}
