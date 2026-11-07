import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,serverTimestamp} from 'firebase/firestore';
import {firestoreHost,firestorePort} from '../emulator-endpoints.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost)throw Error('Demo emulator required');
let env;const path=id=>`users/general-a/reportedAttempts/memorama-simplex--${id}`,event=id=>({version:1,uid:'general-a',id,activityId:'memorama-simplex',kind:'opened',trust:'declaration',observedAt:'2026-01-01T00:00:00.000Z',serverReceivedAt:serverTimestamp()});
const admin=(path,data)=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),data));
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-optilab-general-production',firestore:{host:'127.0.0.1',port:firestorePort,rules:readFileSync('firestore.production.rules','utf8')}});await env.clearFirestore();});
after(async()=>{await env.cleanup();});
test('generated production source is exact and preserves all academic routes',()=>{assert.equal(spawnSync(process.execPath,['scripts/build-production-rules.mjs']).status,0);const start='    function course(c) {';assert.equal(readFileSync('firestore.production.rules','utf8').split(start)[1],readFileSync('firestore.rules','utf8').split(start)[1]);});
test('verified owner needs no pilot membership or temporal window; other UID and unverified remain denied',async()=>{
 const a=env.authenticatedContext('general-a',{email_verified:true}).firestore();await assertSucceeds(setDoc(doc(a,path('first')),event('first')));
 await assertFails(getDoc(doc(env.authenticatedContext('general-b',{email_verified:true}).firestore(),path('first'))));
 await assertFails(setDoc(doc(env.authenticatedContext('general-a',{email_verified:false}).firestore(),path('unverified')),event('unverified')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),path('first'))));
 await assertFails(setDoc(doc(a,'syncProductionControl/current'),{version:1,readsEnabled:true,writesEnabled:true}));
 await assertFails(setDoc(doc(a,'courses/other/terms/other/groups/other/participation/general-a'),{uid:'general-a'}));
});
test('retired pilot expiry does not block normal accounts; erasure fence and emergency pause remain effective',async()=>{
 const a=env.authenticatedContext('general-a',{email_verified:true}).firestore();await admin('syncPilotMembers/general-a',{status:'expired'});await assertSucceeds(setDoc(doc(a,path('normal')),event('normal')));
 await admin('syncProductionControl/current',{version:1,readsEnabled:true,writesEnabled:false});await assertSucceeds(getDoc(doc(a,path('first'))));await assertFails(setDoc(doc(a,path('paused')),event('paused')));
 await admin('syncProductionControl/current',{version:1,readsEnabled:false,writesEnabled:false});await assertFails(getDoc(doc(a,path('first'))));
 await admin('syncProductionControl/current',{version:1,readsEnabled:true,writesEnabled:true});await admin('syncPilotMembers/general-a',{status:'erased'});await assertFails(getDoc(doc(a,path('first'))));await assertFails(setDoc(doc(a,path('erased')),event('erased')));
});
