import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planUid} from '../../server/pilot/plan.mjs';
test('opaque ranking alias mappings are included in the UID export and deletion plan',()=>{
 const path='courses/c/terms/t/groups/g/rankingAliases/a',doc={path,data:{schemaVersion:1,courseId:'c',termId:'t',groupId:'g',uid:'a',alias:'Explorador-'+ 'a'.repeat(32)},version:1};
 const own=planUid('a',[doc]),other=planUid('b',[doc]);assert.deepEqual(own.owned.map(d=>d.path),[path]);assert.equal(own.documents[0].data.alias,doc.data.alias);assert.equal(other.owned.length,0);
});
