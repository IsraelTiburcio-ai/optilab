import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approvedActivityUrl,validatedActivity,iframePolicy} from '../../src/activities/urls';
import {publicActivity,publicGymActivities} from '../../src/activities/catalog';
import {observedCompletion} from '../../src/activities/messages';
const la=publicActivity('learningapps-formulas-simplex')!.activity,ww=publicActivity('wordwall-metodo-m-grande')!.activity;
test('catalog additions remain separate from original games and gym placements',()=>{
  assert.equal(publicGymActivities(3).length,2);assert.equal(publicGymActivities(1).length,0);
  assert.equal('gymId' in la,false);assert.equal(publicActivity('private-course-activity'),null);
  assert.equal(publicActivity(la.activityId,[{activityId:la.activityId,gymId:3,status:'withdrawn'}]),null);
});
test('only strict public provider URLs, resource identities and permitted params are accepted',()=>{
  for(const a of [la,ww]){assert.ok(validatedActivity(a));assert.ok(approvedActivityUrl(a.provider,a.embedUrl,'embed',a.resourceId));}
  for(const value of ['javascript:alert(1)','data:text/html,unsafe','http://learningapps.org/show.php?id=pznycxd7t21',
    'https://learningapps.org.evil.example/show.php?id=pznycxd7t21','https://evil.learningapps.org/show.php?id=pznycxd7t21','https://learningаpps.org/show.php?id=pznycxd7t21',
    'https://user:password@learningapps.org/show.php?id=pznycxd7t21','https://learningapps.org:8443/show.php?id=pznycxd7t21',
    la.embedUrl+'&uid=student',la.embedUrl+'&id=pznycxd7t21',la.embedUrl+'#data',la.embedUrl.replace('pznycxd7t21','otherresource'),la.embedUrl+' ',
    'https://learningapps.org\\@evil.example/show.php?id=pznycxd7t21'])assert.equal(approvedActivityUrl('learningapps',value,'embed',la.resourceId),null);
  for(const value of [ww.embedUrl+'&score=100',ww.embedUrl.replace('themeId=66','themeId=66&themeId=1'),ww.embedUrl.replace('templateId=35','templateId=x'),ww.embedUrl.replace('/es/embed/','/es/resource/'),ww.embedUrl.replace('wordwall.net','wordwall.net.evil.example')])assert.equal(approvedActivityUrl('wordwall',value,'embed',ww.resourceId),null);
  for(const slug of ['%2F..%2Fadmin','%252fadmin','%0afoo','%3Cscript%3E','bad%'])assert.equal(approvedActivityUrl('wordwall','https://wordwall.net/resource/123/'+slug,'source',ww.resourceId),null);
});
test('iframe policies deny navigation, popups, downloads and devices; referrer is omitted',()=>{
  for(const a of [la,ww]){const policy=iframePolicy(a.provider);assert.equal(policy.referrerPolicy,'no-referrer');assert.equal(policy.sandbox,'allow-scripts allow-same-origin allow-forms');assert.ok(!policy.sandbox.includes('allow-top-navigation'));assert.ok(!policy.sandbox.includes('popups'));}
});
test('only specifically observed LearningApps signals with the active direct window are accepted',()=>{
  const windowMarker={},state={active:true,sessionId:'session-a',activeSessionId:'session-a',frameWindow:windowMarker,sourceUrl:la.embedUrl};
  const event={origin:'https://learningapps.org',source:windowMarker,data:'AppSolved|pznycxd7t21|100|4|0'};
  assert.equal(observedCompletion(event,la,state),'AppSolved');assert.equal(observedCompletion({...event,data:'AppCompleted|pznycxd7t21|4|0'},la,state),'AppCompleted');
  for(const patch of [{origin:'null'},{origin:'https://learningapps.org.evil.example'},{origin:'http://learningapps.org'},{source:{}},{source:null},
    {data:{type:'AppSolved',score:100}},{data:null},{data:[]},{data:'AppSolved|otherresource|100|4|0'},{data:'AppSolved|pznycxd7t21|50|4|0'},
    {data:'AppSolved|pznycxd7t21|100|4|1'},{data:'AppCompleted|pznycxd7t21|-1|0'},{data:'AppReady'},{data:'game:completed'},{data:'A'.repeat(1000)}])assert.equal(observedCompletion({...event,...patch},la,state),null);
  for(const patch of [{active:false},{activeSessionId:'session-b'},{frameWindow:null},{sourceUrl:ww.embedUrl}])assert.equal(observedCompletion(event,la,{...state,...patch}),null);
  assert.equal(observedCompletion(event,ww,{...state,sourceUrl:ww.embedUrl}),null);
});
