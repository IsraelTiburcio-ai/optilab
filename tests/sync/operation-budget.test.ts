import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateSyncOperation,syncOperationLimits} from '../../src/progress/validation';
import {emptyProgress,fieldsOf,withEvolution,type Operation} from '../../src/progress/model';
import {games} from '../../src/data';
const date='2026-01-01T00:00:00.000Z';
const operation=():Operation=>({id:crypto.randomUUID(),epoch:1,kind:'edit',afterId:null,changes:{nickname:{value:'Sintético',baseRevision:0,predecessor:null}},diagnostics:{},runs:{}});
const run=(runId:string)=>({gameId:'memorama-simplex' as const,runId,date,completed:true as const,matchedPairs:8,totalPairs:8,attempts:9,errors:1,elapsedMs:1000,accuracy:89});
test('maximum supported operation stays within the 122-write client budget and preserves native legacy payload',()=>{
  const full=withEvolution({...emptyProgress(),practiced:Object.fromEntries(games.map(g=>[g.repo,date])),visited:[1,2,3,4,5]});
  const op={...operation(),kind:'import' as const,sourceHash:'a'.repeat(64),changes:Object.fromEntries(Object.entries(fieldsOf(full)).map(([key,value])=>[key,{value,baseRevision:0,predecessor:null}])),diagnostics:Object.fromEntries(Array.from({length:30},()=>[crypto.randomUUID(),{date,answers:[1,0,1,1,0],score:5}])),runs:Object.fromEntries(Array.from({length:50},()=>{const id=crypto.randomUUID();return [id,run(id)];}))};
  validateSyncOperation(op);assert.equal(Object.keys(op.changes).length+Object.keys(op.diagnostics).length+Object.keys(op.runs).length+2,syncOperationLimits.writes);
});
test('corrupt/malicious operation paths, metadata, unsupported telemetry and sizes fail before any SDK operation',()=>{
  const id=crypto.randomUUID();
  const bad:unknown[]=[null,[],{...operation(),id:'../../users/b'},{...operation(),epoch:0},{...operation(),kind:'admin'},{...operation(),kind:new String('edit')},{...operation(),afterId:'bad'},{...operation(),role:'admin'},
    {...operation(),kind:'import',sourceHash:'bad'}, {...operation(),kind:'reset'},
    {...operation(),changes:{'../role':{value:'admin',baseRevision:0,predecessor:null}}},
    {...operation(),changes:{nickname:{value:'x'.repeat(31),baseRevision:0,predecessor:null}}},
    {...operation(),changes:{nickname:{value:'ok',baseRevision:-1,predecessor:null}}},
    {...operation(),changes:{nickname:{value:'ok',baseRevision:0,predecessor:null,force:true}}},
    {...operation(),diagnostics:Object.fromEntries(Array.from({length:31},()=>[crypto.randomUUID(),{date,answers:[1,0,1,1,0],score:5}]))},
    {...operation(),runs:Object.fromEntries(Array.from({length:51},()=>{const id=crypto.randomUUID();return [id,run(id)];}))},
    {...operation(),runs:{[id]:{...run(id),gameId:'ahorcado-simplex'}}}, {...operation(),runs:{[id]:{...run(id),runId:crypto.randomUUID()}}},
    {...operation(),diagnostics:{[id]:{date,answers:[1,0,1,1,0],score:4}}},
    {...operation(),diagnostics:{'a/b':{date,answers:[1,0,1,1,0],score:5}}},
    {...operation(),kind:'reset',epoch:1000000,changes:{}}];
  for(const op of bad)assert.throws(()=>validateSyncOperation(op),/Operación de sincronización inválida/);
  for(const g of games.filter(g=>g.repo!=='memorama-simplex'))assert.throws(()=>validateSyncOperation({...operation(),runs:{[id]:{...run(id),gameId:g.repo}}}),/Operación de sincronización inválida/);
  validateSyncOperation({...operation(),kind:'reset',changes:{}});
});
