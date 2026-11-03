import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Socket} from 'node:net';
import {inspectPlatform,sha256} from '../../server/pilot/platform.mjs';

const releaseUrl='https://firebaserules.googleapis.com/v1/projects/optilab-cd829/releases/cloud.firestore';
const releaseName='projects/optilab-cd829/releases/cloud.firestore';
const rulesetName='projects/optilab-cd829/rulesets/mock-ruleset';
const rulesetUrl=`https://firebaserules.googleapis.com/v1/${rulesetName}`;
const billingUrl='https://cloudbilling.googleapis.com/v1/projects/optilab-cd829/billingInfo';
const servicesUrl='https://serviceusage.googleapis.com/v1/projects/optilab-cd829/services?filter=state%3AENABLED&pageSize=200';
const deployedSource='mock deployed Rules source; never published';

function fixture(t,{release={name:releaseName,rulesetName},deny=false}={}){
  // inspectPlatform must use only its injected GET. Any real HTTP/TCP attempt fails.
  const network=t.mock.fn(()=>{throw Error('Real network forbidden in platform regression tests');});
  t.mock.method(globalThis,'fetch',network);
  t.mock.method(Socket.prototype,'connect',network);
  const responses=new Map([
    [releaseUrl,release],
    [rulesetUrl,{source:{files:[{content:deployedSource}]}}],
    [billingUrl,{billingEnabled:false}],
    [servicesUrl,{services:[{config:{name:'firestore.googleapis.com'}}]}],
  ]);
  const get=t.mock.fn(async(...args)=>{
    assert.equal(args.length,1,'Only the injected GET URL is accepted; no write options');
    const [url]=args;
    assert(responses.has(url),`Unexpected simulated GET: ${url}`);
    if(deny)throw Error('Simulated metadata access denied');
    return structuredClone(responses.get(url));
  });
  t.after(()=>assert.equal(network.mock.callCount(),0,'No real fetch or TCP connection attempted'));
  return {get};
}

for(const matches of [true,false]){
  test(`cloud.firestore release GET: Rules PASS, candidateDeployed=${matches}`,async t=>{
    const {get}=fixture(t);
    const candidate=matches?deployedSource:'different mock candidate; never published';
    const result=await inspectPlatform(get,candidate);
    assert.equal(result.rules.status,'PASS');
    assert.equal(result.rules.release,releaseName);
    assert.equal(result.rules.ruleset,rulesetName);
    assert.equal(result.rules.candidateDeployed,matches);
    assert.equal(result.rules.sourceSha256,sha256(deployedSource));
    assert.equal(result.rules.candidateSha256,sha256(candidate));
    assert.equal(result.billing.status,'PASS');
    assert.equal(result.services.status,'PASS');
    assert.deepEqual(get.mock.calls.map(call=>call.arguments[0]).sort(),
      [releaseUrl,rulesetUrl,billingUrl,servicesUrl].sort());
    // The fake has no transport or write methods: all four calls were simulated GETs.
  });
}

test('unavailable metadata stays BLOCKED without falling back to a real API',async t=>{
  const {get}=fixture(t,{deny:true});
  const result=await inspectPlatform(get,deployedSource);
  for(const part of ['rules','billing','services'])assert.equal(result[part].status,'BLOCKED');
  assert.deepEqual(get.mock.calls.map(call=>call.arguments[0]).sort(),
    [releaseUrl,billingUrl,servicesUrl].sort());
});

test('a ruleset from another project is rejected before any follow-up GET',async t=>{
  const {get}=fixture(t,{release:{name:releaseName,rulesetName:'projects/other-project/rulesets/mock'}});
  const result=await inspectPlatform(get,deployedSource);
  assert.equal(result.rules.status,'BLOCKED');
  assert.deepEqual(get.mock.calls.map(call=>call.arguments[0]).sort(),
    [releaseUrl,billingUrl,servicesUrl].sort());
});
