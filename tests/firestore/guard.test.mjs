import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

for (const host of [undefined, 'firestore.googleapis.com:443', 'localhost:8085']) {
  test(`test module fails closed before initialization for host ${host ?? '(unset)'}`,()=>{
    const env={...process.env};
    delete env.NODE_TEST_CONTEXT; // Execute a real child runner rather than inherit its parent's harness.
    if(host===undefined)delete env.FIRESTORE_EMULATOR_HOST;
    else env.FIRESTORE_EMULATOR_HOST=host;
    const result=spawnSync(process.execPath,['--test','tests/firestore/security.test.mjs'],{env,encoding:'utf8',timeout:10000});
    assert.notEqual(result.status,0);
    assert.match(result.stdout+result.stderr,/require the isolated emulator/);
  });
}
test('launcher refuses inherited emulator host',()=>{
  const result=spawnSync(process.execPath,['scripts/test-firestore.mjs'],{
    env:{...process.env,FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'},encoding:'utf8',timeout:10000,
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/without arguments or a pre-existing emulator host/);
});
test('launcher refuses project overrides',()=>{
  const env={...process.env}; delete env.FIRESTORE_EMULATOR_HOST;
  const result=spawnSync(process.execPath,['scripts/test-firestore.mjs','--project','optilab-cd829'],{env,encoding:'utf8',timeout:10000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/without arguments or a pre-existing emulator host/);
});
