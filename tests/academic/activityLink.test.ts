import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveActivityLink} from '../../src/academic/activityLink';
test('resuelve LearningApps a source/embed canónicos sin pedir IDs',()=>{
  const resolved=resolveActivityLink('https://learningapps.org/watch?v=pznycxd7t21');
  assert.deepEqual(resolved,{provider:'learningapps',resourceId:'pznycxd7t21',sourceUrl:'https://learningapps.org/watch?v=pznycxd7t21',embedUrl:'https://learningapps.org/show.php?id=pznycxd7t21',title:'',externalOnly:false});
});
test('detecta Wordwall público y ofrece apertura externa sin inventar embed',()=>{
  const resolved=resolveActivityLink('https://wordwall.net/es/resource/22610275/metodo-de-m-grande');
  assert.equal(resolved?.provider,'wordwall');assert.equal(resolved?.resourceId,'22610275');
  assert.equal(resolved?.sourceUrl,'https://wordwall.net/es/resource/22610275/metodo-de-m-grande');
  assert.equal(resolved?.embedUrl,null);assert.equal(resolved?.externalOnly,true);assert.equal(resolved?.title,'metodo de m grande');
});
test('rechaza HTML, hosts ajenos, embed y URLs con credenciales o parámetros',()=>{
  for(const value of ['<iframe src="https://wordwall.net/es/embed/x"></iframe>','https://evil.example/resource/1/x','https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=1','https://wordwall.net/resource/1/x?token=secret','https://learningapps.org/watch?v=short'])assert.equal(resolveActivityLink(value),null,value);
});
