import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pagesBase} from '../../scripts/pages-base.mjs';
import {accountActionUrl} from '../../src/deployment/accountActionUrl.ts';
import {latestPagesDeploymentAllowed} from '../../scripts/single-operator-pages-guard.mjs';

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

test('Pages workflows share one non-canceling mutex and ON checks newer deployments',async()=>{
  const deploy=await readFile(new URL('../../.github/workflows/deploy.yml',import.meta.url),'utf8');
  const single=await readFile(new URL('../../.github/workflows/single-operator-frontend.yml',import.meta.url),'utf8');
  const pilot=await readFile(new URL('../../.github/workflows/pilot-frontend.yml',import.meta.url),'utf8');
  for(const workflow of [deploy,single,pilot]){
    assert.match(workflow,/concurrency:\s*\n\s*group: pages\s*\n\s*cancel-in-progress: false/);
    assert.doesNotMatch(workflow,/cancel-in-progress: true/);
  }
  assert.match(deploy,/VITE_PROGRESS_SYNC: disabled/);
  assert.match(single,/deployments: read/);
  assert.match(single,/single-operator-pages-guard\.mjs/);
  const guard=single.indexOf('single-operator-pages-guard.mjs');
  const publish=single.indexOf('uses: actions/deploy-pages@v4');
  assert.ok(guard>0&&guard<publish,'ON guard must run before deploy-pages');
  const build=single.slice(single.indexOf('  build:'),single.indexOf('  deploy:'));
  const deploySection=single.slice(single.indexOf('  deploy:'));
  assert.doesNotMatch(build,/environment:\s*\n\s*name: github-pages/,'build guard must not own a Pages environment');
  assert.match(deploySection,/environment:\s*\n\s*name: github-pages/);
});
test('Pages ON guard blocks a deployment newer than the receipt and malformed metadata',()=>{
  const receipt={observedAt:'2026-01-01T00:00:00.000Z'};
  assert.equal(latestPagesDeploymentAllowed([],receipt).allowed,true);
  const old={id:1,environment:'github-pages',created_at:'2025-12-31T23:59:59Z',sha:'a'.repeat(40)};
  assert.equal(latestPagesDeploymentAllowed([old],receipt).allowed,true);
  const newer={...old,id:2,created_at:'2026-01-01T00:00:01Z'};
  assert.throws(()=>latestPagesDeploymentAllowed([newer],receipt),/newer Pages deployment/);
  for(const latest of [null,{},[old,newer],[{...old,environment:'production'}],[{...old,id:0}],[{...old,created_at:'not-a-date'}]])
    assert.throws(()=>latestPagesDeploymentAllowed(latest,receipt));
  assert.throws(()=>latestPagesDeploymentAllowed([old],{observedAt:'bad'}));
});
test('Auth action callbacks preserve the HashRouter on legacy and custom roots',()=>{
  assert.equal(accountActionUrl('/','https://optilab.club'),'https://optilab.club/#/cuenta');
  assert.equal(accountActionUrl('/optilab/','https://israeltiburcio-ai.github.io'),'https://israeltiburcio-ai.github.io/optilab/#/cuenta');
});
