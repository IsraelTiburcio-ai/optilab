import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSession,verifyActiveRules,sha256,reviewedSources} from '../../server/single-operator/preparation.mjs';
import {session,sources} from './fixture.mjs';

// Entirely synthetic: this is NOT the source/hash from any production audit.
const activeSource="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{path=**} { allow read, write: if false; } } }\n";
const root='https://firebaserules.googleapis.com/v1/',releaseName='projects/optilab-cd829/releases/cloud.firestore';
function fixture(t){
  const now=Date.now(),m={...session(now),expectedActiveRulesSha256:sha256(activeSource)},b=prepareSession(m,sources);
  const release={name:releaseName,rulesetName:'projects/optilab-cd829/rulesets/synthetic-reviewed-source',updateTime:new Date(now-60000).toISOString()};
  const ruleset={name:release.rulesetName,source:{files:[{name:'firestore.rules',content:activeSource}]}};
  const approval={scope:'single-operator-test-rules-comparison-v1',approvedBy:m.operator,approvedAt:new Date(now-1000).toISOString(),impactReviewed:true,
    frontendSha:m.frontendSha,windowDigest:b.plan.windowDigest,versionedBaseRulesSha256:reviewedSources.base,candidateRulesSha256:b.plan.rulesSha256,activeRulesSha256:m.expectedActiveRulesSha256};
  const calls=[],fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited');});
  const get=t.mock.fn(async(url,options)=>{calls.push({url,...options});assert.equal(options.method,'GET');if(url===root+releaseName)return structuredClone(release);if(url===root+release.rulesetName)return structuredClone(ruleset);throw Error('Unexpected URL');});
  return {now,m,b,release,ruleset,approval,calls,fetch,get,options:{get,approvedSource:activeSource,approval,clock:()=>now}};
}
test('different versioned and active hashes: only fresh exact approved GET comparison can PASS',async t=>{
  const f=fixture(t);assert.notEqual(f.m.expectedActiveRulesSha256,reviewedSources.base);
  assert.equal(f.b.plan.versionedBaseRulesSha256,reviewedSources.base);assert.equal(f.b.plan.expectedActiveRulesSha256,sha256(activeSource));
  assert.equal(f.b.plan.activeRulesVerification,'NOT_PERFORMED');
  const checked=await verifyActiveRules(f.m,sources,f.options);assert.equal(checked.status,'PASS');assert.equal(checked.executionAuthorized,false);
  assert.equal(checked.activeRulesSha256,sha256(activeSource));
  assert.deepEqual(f.calls.map(x=>x.url),[root+releaseName,root+f.release.rulesetName,root+releaseName]);
  assert(f.calls.every(c=>c.method==='GET'));assert.equal(f.fetch.mock.callCount(),0);
});
test('missing owner approval, impact review or changed bindings block before any GET',async t=>{
  const f=fixture(t);
  for(const patch of [null,{scope:'private-pilot-v1'},{approvedBy:'other-owner'},{approvedAt:new Date(f.now+1).toISOString()},
    {impactReviewed:false},{frontendSha:'c'.repeat(40)},{windowDigest:'c'.repeat(64)},{versionedBaseRulesSha256:'c'.repeat(64)},
    {candidateRulesSha256:'c'.repeat(64)},{activeRulesSha256:'c'.repeat(64)}]){
    await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,approval:patch===null?null:{...f.approval,...patch}}));
  }
  await assert.rejects(()=>verifyActiveRules({...f.m,expectedActiveRulesSha256:'c'.repeat(64)},sources,f.options));
  assert.equal(f.get.mock.callCount(),0);assert.equal(f.fetch.mock.callCount(),0);
});
test('missing adapter, changed approved bytes or unexpected live content cannot fall back to a hash/file',async t=>{
  const f=fixture(t);
  await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,get:undefined}));
  await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,approvedSource:activeSource+'\n'}));
  assert.equal(f.get.mock.callCount(),0);
  f.ruleset.source.files[0].content=activeSource+'\n';
  await assert.rejects(()=>verifyActiveRules(f.m,sources,f.options),/Live Rules differ/);
  assert.equal(f.get.mock.callCount(),2);assert.equal(f.fetch.mock.callCount(),0);
});
test('inaccessible or invalid release/ruleset metadata remains blocked, with GETs only',async t=>{
  const f=fixture(t);
  for(const patch of [{name:'projects/optilab-cd829/releases/firebase.firestore'},
    {rulesetName:'projects/another-project/rulesets/fixture'},{rulesetName:'projects/optilab-cd829/rulesets/id?unsafe'},
    {updateTime:null}]){
    const get=async()=>({...f.release,...patch});await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,get}));
  }
  for(const value of [null,{...f.ruleset,name:'other'}, {...f.ruleset,source:{files:[]}},
    {...f.ruleset,source:{files:[{content:activeSource},{content:activeSource}]}},{...f.ruleset,source:{files:[{content:null}]}}]){
    const get=async url=>url===root+releaseName?f.release:value;await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,get}));
  }
  await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,get:async()=>{throw Error('Synthetic HTTP 403');}}));
  assert.equal(f.fetch.mock.callCount(),0);
});
test('release rotation, stale comparison and invalid clock never pass',async t=>{
  const f=fixture(t);
  for(const patch of [{rulesetName:'projects/optilab-cd829/rulesets/rotated'}, {updateTime:new Date(f.now).toISOString()}]){
    let count=0;const get=async(url,options)=>{count++;assert.equal(options.method,'GET');return count===3?{...f.release,...patch}:url===root+releaseName?f.release:f.ruleset;};
    await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,get}),/release changed/);assert.equal(count,3);
  }
  for(const elapsed of [300001,-1]){
    let ticks=0;await assert.rejects(()=>verifyActiveRules(f.m,sources,{...f.options,clock:()=>f.now+(ticks++?elapsed:0)}),/stale or invalid clock/);
  }
  assert.equal(f.fetch.mock.callCount(),0);
});
test('versioned source locks still block modifications independently of approved production source',async t=>{
  const f=fixture(t);
  for(const key of ['base','pilot'])await assert.rejects(()=>verifyActiveRules(f.m,{...sources,[key]:sources[key]+'\n'},f.options),/Rules sources changed/);
  assert.equal(f.get.mock.callCount(),0);assert.equal(f.fetch.mock.callCount(),0);
});
