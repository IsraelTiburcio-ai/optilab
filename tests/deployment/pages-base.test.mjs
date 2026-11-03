import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pagesBase} from '../../scripts/pages-base.mjs';
import {accountActionUrl} from '../../src/deployment/accountActionUrl.ts';

test('Pages base selects exact root-domain target and preserves legacy project path',()=>{
  assert.equal(pagesBase('optilab.club'),'/');
  assert.equal(pagesBase(undefined),'/optilab/');
  assert.equal(pagesBase(''),'/optilab/');
  assert.equal(pagesBase('github-pages'),'/optilab/');
  for(const target of ['evil.example','optilab.club/','OPTI LAB','/'])assert.throws(()=>pagesBase(target),/Unsupported/);
});
test('Pages workflow pins the canonical CNAME and custom-domain root build',async()=>{
  const workflow=await readFile(new URL('../../.github/workflows/deploy.yml',import.meta.url),'utf8');
  assert.match(workflow,/OPTILAB_PAGES_TARGET: optilab\.club/);
  assert.equal((await readFile(new URL('../../public/CNAME',import.meta.url),'utf8')).trim(),'optilab.club');
});
test('Auth action callbacks preserve the HashRouter on legacy and custom roots',()=>{
  assert.equal(accountActionUrl('/','https://optilab.club'),'https://optilab.club/#/cuenta');
  assert.equal(accountActionUrl('/optilab/','https://israeltiburcio-ai.github.io'),'https://israeltiburcio-ai.github.io/optilab/#/cuenta');
});
