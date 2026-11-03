import {test} from 'node:test';import assert from 'node:assert/strict';import {append,empty,decode,metrics,ids,type Attempt} from './model';
const event:Attempt={version:1,id:'run-1',activityId:'system-lab',kind:'reported',trust:'client-report',observedAt:new Date().toISOString(),result:{correct:6,total:8}};
test('28 activities, only available fields preserved',()=>{assert.equal(ids.length,28);const l=append(empty(),event);assert.equal(l.entries[0].result?.score,undefined);assert.equal(metrics(l).find(x=>x.activityId==='system-lab')?.validated,0);});
test('duplicate and modified replay cannot replace first report',()=>{const l=append(empty(),event);assert.equal(append(l,{...event,result:{score:999}}),l);assert.equal(l.entries.length,1);});
test('client cannot elevate trust',()=>assert.throws(()=>append(empty(),{...event,trust:'server-validated'} as unknown as Attempt)));
test('reject negative metrics, unknown activities and versions',()=>{for(const e of [{...event,result:{durationMs:-1}},{...event,activityId:'evil'},{...event,version:2}])assert.throws(()=>append(empty(),e as Attempt));});
test('opening is never completion; no inferred score',()=>{const l=append(empty(),{...event,kind:'opened',trust:'declaration',result:undefined});assert.equal(metrics(l).find(x=>x.activityId==='system-lab')?.reported,0);});
test('corrupt history fails closed; reload retains replay fences',()=>{assert.throws(()=>decode('{'));const l=decode(JSON.stringify(append(empty(),event)));assert.equal(append(l,event),l);});

test('preserve native Memorama fields without renaming duration',()=>{const l=append(empty(),{...event,activityId:'memorama-simplex',result:{completed:true,matchedPairs:8,totalPairs:8,attempts:8,errors:0,elapsedMs:1234,accuracy:100}});assert.equal(l.entries[0].result?.elapsedMs,1234);assert.equal(l.entries[0].result?.durationMs,undefined);});
