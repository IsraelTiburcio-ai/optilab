import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('the emitted server and every shared transitive dependency load in native Node ESM without tsx resolution',()=>{
 const result=spawnSync(process.execPath,['scripts/test-server-esm.mjs'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/NATIVE_ESM_PASS/);
});
