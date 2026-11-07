import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runPreflight} from '../../scripts/pilot-preflight.mjs';
const manifest={projectId:'optilab-cd829',teacherUid:'synthetic_teacher_uid_001',course:{id:'synthetic-course',title:'Optimización I'},term:{id:'synthetic-term',title:'2026-2'},group:{id:'synthetic-group',title:'Pilot'}};
test('pilot preflight validates index, ESM, Pages and the 10-document plan without remote calls',async()=>{
  const result=await runPreflight({remote:false,manifest});
  assert.equal(result.ok,true,JSON.stringify(result.checks.filter(check=>!check.ok)));
  assert.ok(result.checks.find(check=>check.name==='reportedAttempts.observedAt collection DESC index')?.ok);
  assert.ok(result.checks.find(check=>check.name==='pilot plan is exactly 10 documents and dry-run')?.ok);
  assert.ok(result.checks.find(check=>check.name==='Pages workflow enables academic production')?.ok);
});

test('Pages deploy workflow persists the exact production academic frontend flags',()=>{
  const workflow=readFileSync('.github/workflows/deploy.yml','utf8');
  assert.match(workflow,/VITE_PROGRESS_SYNC: production/);
  assert.match(workflow,/VITE_ACADEMIC_API_MODE: production/);
  assert.match(workflow,/VITE_ACADEMIC_API_URL: https:\/\/optilab-api\.vercel\.app\/api/);
  assert.match(workflow,/VITE_ACADEMIC_APP_ORIGIN: https:\/\/optilab\.club/);
});
