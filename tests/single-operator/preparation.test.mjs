import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,stat,rm,symlink,mkdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareSession,validateSession,sha256,reviewedSources} from '../../server/single-operator/preparation.mjs';
import {requireApproval} from '../../server/pilot/activation.mjs';
import {assertProtectedEnvironment} from '../../server/pilot/environment.mjs';
import {session,sources} from './fixture.mjs';

test('separate preparation binds exact UID/window/SHA/scope, never grants authorization',()=>{
  const m=session(),b=prepareSession(m,sources);assert.equal(b.plan.executionImplemented,true);assert.equal(b.plan.approvalRequired,true);
  assert.equal(b.plan.rulesSha256,sha256(b.rules));assert.equal(b.control.readsEnabled,false);assert.equal(b.control.writesEnabled,false);
  assert.equal(b.control.expiresAt,m.startAt);assert.equal(b.plan.network,false);assert.equal(b.plan.productionWrites,false);
  assert.equal(JSON.stringify(b.plan).includes(m.uid),false);
  for(const patch of [{uid:'single-fixture-b'},{frontendSha:'c'.repeat(40)},{endAt:new Date(Date.parse(m.endAt)-1).toISOString()},{limits24h:{...m.limits24h,reads:4000}}])
    assert.notEqual(prepareSession({...m,...patch},sources).plan.rulesSha256,b.plan.rulesSha256);
});
test('reject malformed target, duration, additional identities, scope, consent and approval reuse',()=>{
  const m=session();
  for(const patch of [{project:'other'},{mode:'private-pilot-v1'},{origin:'http://optilab.club'},{uid:['a','b']},{uid:'a/b'},{participants:['a','b']},
    {endAt:'not-a-date'},{endAt:new Date(Date.parse(m.startAt)+7200001).toISOString()},{frontendSha:null},{frontendSha:['b'.repeat(40)]},
    {adultAttested:false},{fictitiousDataOnly:false},{studentsAllowed:true},{independentConsents:false},{leaseMinutes:20},
    {risksAcknowledged:false},{authorization:{scope:'private-pilot-v1'}},{expectedActiveRulesSha256:'ecf30f94'},{expectedActiveRulesSha256:['c'.repeat(64)]},
    {limits24h:{reads:0,writes:1,deletes:1,documents:1,largestAccount:1}},{exports:{directory:'relative',encryptionVerified:true,removeExternalCopies:true}}])
    assert.throws(()=>validateSession({...m,...patch}));
});
test('reviewed source locks and preserved academic tail prevent hidden policy changes',()=>{
  assert.equal(sha256(sources.base),reviewedSources.base);assert.equal(sha256(sources.pilot),reviewedSources.pilot);
  assert.throws(()=>prepareSession(session(),{...sources,pilot:sources.pilot+'\n'}));
  const b=prepareSession(session(),sources),tail=sources.base.slice(sources.base.indexOf('    function course(c) {'));
  assert.equal(b.rules.slice(b.rules.indexOf('    function course(c) {')),tail);
  assert(!b.rules.includes('function pilotAccess('));assert(b.rules.includes('singleOperatorTestControl/current'));
  assert(b.rules.includes("kind in ['edit','reset','restore']"));
});
test('old pilot still rejects a single operator and the new manifest',()=>{
  assert.throws(()=>requireApproval(session()));
  assert.throws(()=>assertProtectedEnvironment({can_admins_bypass:false,protection_rules:[{type:'required_reviewers',prevent_self_review:true,reviewers:[{reviewer:{login:'owner-fixture'}}]}]}));
});
test('CLI dry-run is offline; no execute option, no UID stdout, private artifacts only outside repo',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'optilab-single-prepare-')),file=join(dir,'session.json'),guard=join(dir,'no-network.mjs');
  await writeFile(guard,"import {Socket} from 'node:net';Socket.prototype.connect=()=>{throw Error('Network forbidden in mocked CLI test');};globalThis.fetch=()=>{throw Error('Fetch forbidden in mocked CLI test');};");
  const run=args=>spawnSync(process.execPath,['--import',guard,'scripts/single-operator-prepare.mjs','--manifest',file,...args],{encoding:'utf8',env:{...process.env,GOOGLE_APPLICATION_CREDENTIALS:'/nonexistent/no-credentials',GOOGLE_CLOUD_QUOTA_PROJECT:'not-used'}});
  try{
    const m=session();m.exports.directory=dir;await writeFile(file,JSON.stringify(m));const dry=run([]);assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).network,false);assert(!dry.stdout.includes('single-fixture-a'));
    assert.notEqual(run(['--execute']).status,0);assert.notEqual(run(['--out',resolve('single-private-artifact')]).status,0);
    await symlink(process.cwd(),join(dir,'repo-link'));assert.notEqual(run(['--out',join(dir,'repo-link','unsafe')]).status,0);
    await mkdir(join(dir,'another-repo'));await writeFile(join(dir,'another-repo','.git'),'gitdir: fictitious');assert.notEqual(run(['--out',join(dir,'another-repo','unsafe')]).status,0);
    assert.notEqual(run(['--out',join(tmpdir(),'outside-declared-location')]).status,0);
    const out=join(dir,'bundle'),written=run(['--out',out]);assert.equal(written.status,0,written.stderr);assert.equal((await stat(out)).mode&0o777,0o700);
    for(const name of ['candidate.rules','control-paused.json','approval-plan.json','session.json','firebase-rules.json'])assert.equal((await stat(join(out,name))).mode&0o777,0o600);
    assert.equal(JSON.parse(await readFile(join(out,'control-paused.json'),'utf8')).writesEnabled,false);
    assert.deepEqual(JSON.parse(await readFile(join(out,'firebase-rules.json'),'utf8')),{firestore:{rules:join(await realpath(out),'candidate.rules')}});
    assert.notEqual(run(['--out',out]).status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
