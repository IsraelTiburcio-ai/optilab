import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedActivityUrl} from '../../server/academic/activityUrls';
test('allowlist rechaza esquemas, credenciales, puertos, subdominios, hash, PII y parámetros extra',()=>{
  const id='pznycxd7t21',word='cc167dda64954e3dbb379706dd8348c8';
  for(const [provider,kind,value,resource] of [
    ['learningapps','source','http://learningapps.org/watch?v=pznycxd7t21',id],
    ['learningapps','source','https://user:pass@learningapps.org/watch?v=pznycxd7t21',id],
    ['learningapps','source','https://learningapps.org:8443/watch?v=pznycxd7t21',id],
    ['learningapps','source','https://evil.learningapps.org/watch?v=pznycxd7t21',id],
    ['learningapps','source','https://learningapps.org/watch?v=pznycxd7t21#x',id],
    ['learningapps','source','https://learningapps.org/watch?v=pznycxd7t21&token=secret',id],
    ['learningapps','source','https://learningapps.org/watch?v=other',id],
    ['wordwall','embed','https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35',word],
    ['wordwall','embed','https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0&next=https://evil.example',word],
    ['wordwall','source','https://wordwall.net/resource/22610275/metodo-de-m-grande?x=1',word],
  ] as const)assert.equal(approvedActivityUrl(provider,value,kind,resource),null,`${provider} ${kind} ${value}`);
  assert.ok(approvedActivityUrl('learningapps','https://learningapps.org/watch?v=pznycxd7t21','source',id));
  assert.ok(approvedActivityUrl('wordwall','https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0','embed',word));
});
