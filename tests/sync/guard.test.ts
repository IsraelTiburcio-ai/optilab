import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {firestoreTransport} from '../../src/progress/transport';
import type {Firestore} from 'firebase/firestore';
test('transport rejects production project before constructing references or any request',()=>{
  assert.throws(()=>firestoreTransport({app:{options:{projectId:'optilab-cd829'}}} as Firestore,'a',()=>true),/Solo se admite/);
});
for(const name of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])test(`launcher rejects inherited ${name}`,()=>{
  const result=spawnSync(process.execPath,['scripts/test-sync.mjs'],{encoding:'utf8',env:{...process.env,[name]:'production.invalid:443'}});
  assert.notEqual(result.status,0);assert.match(result.stderr,/without overrides or inherited emulator hosts/);
});
test('launcher rejects a real project override',()=>{
  const env={...process.env};delete env.FIRESTORE_EMULATOR_HOST;delete env.FIREBASE_AUTH_EMULATOR_HOST;
  const result=spawnSync(process.execPath,['scripts/test-sync.mjs','--project','optilab-cd829'],{encoding:'utf8',env});
  assert.notEqual(result.status,0);assert.match(result.stderr,/without overrides or inherited emulator hosts/);
});
test('integration suite refuses missing or remote endpoints before initializing any app',()=>{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.FIREBASE_AUTH_EMULATOR_HOST;
  env.FIRESTORE_EMULATOR_HOST='firestore.googleapis.com:443';
  const result=spawnSync(process.execPath,['--import','tsx','--test','tests/sync/integration.test.ts'],{encoding:'utf8',env,timeout:10000});
  assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/requires BOTH isolated loopback emulators/);
});
