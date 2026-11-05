import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const indexes=JSON.parse(readFileSync(new URL('../../firestore.indexes.json',import.meta.url),'utf8'));
const repository=readFileSync(new URL('../../server/academic/repository.ts',import.meta.url),'utf8');
const progress=readFileSync(new URL('../../server/academic/progress.ts',import.meta.url),'utf8');
test('reportedAttempts keeps wildcard exemption but enables the observedAt descending collection index',()=>{
  assert.deepEqual(indexes.fieldOverrides.find((row:any)=>row.collectionGroup==='reportedAttempts'&&row.fieldPath==='*').indexes,[]);
  assert.deepEqual(indexes.fieldOverrides.find((row:any)=>row.collectionGroup==='reportedAttempts'&&row.fieldPath==='observedAt').indexes,
    [{order:'DESCENDING',queryScope:'COLLECTION'}]);
  assert.match(repository,/orderBy\('observedAt','desc'\)/);
  assert.match(repository,/where\('observedAt','>=',fromISO\)/);
  assert.match(repository,/where\('observedAt','<=',toISO\)/);
  assert.match(repository,/limit\(limit\)/);
  assert.match(progress,/attemptLimit=200/);
});
