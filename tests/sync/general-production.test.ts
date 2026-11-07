import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {ProgressEngine} from '../../src/progress/engine';import {firestoreTransport} from '../../src/progress/transport';import {MemoryStorage} from '../../src/progress/storage';import {emptyProgress,withEvolution} from '../../src/progress/model';import {games} from '../../src/data';
import {firestoreHost,firestorePort} from '../emulator-endpoints.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!==firestoreHost)throw Error('Isolated emulator required');
test('general verified-owner Rules support full atomic legacy recovery without pilot grants and preserve the write budget',async()=>{
 const config={projectId:'demo-optilab-sync',firestore:{host:'127.0.0.1',port:firestorePort,rules:readFileSync('firestore.production.rules','utf8')}},env=await initializeTestEnvironment(config),uid='general-budget-'+crypto.randomUUID();
 const engine=new ProgressEngine(uid,new MemoryStorage(),firestoreTransport(env.authenticatedContext(uid,{email_verified:true}).firestore() as any,uid,()=>true),5);
 const wait=async(check:()=>boolean)=>{const end=Date.now()+20000;while(!check()){if(Date.now()>end)throw Error('GENERAL_RECOVERY_TIMEOUT');await new Promise(r=>setTimeout(r,25));}};
 try{engine.start();await wait(()=>engine.getSnapshot().ready);const date='2026-01-01T00:00:00.000Z';
 const progress=withEvolution({...emptyProgress(),nickname:'Recuperación ficticia',avatarId:'avatar-06',companionId:'brio',visited:[1,2,3,4,5],practiced:Object.fromEntries(games.map(g=>[g.repo,date])),route:games.map(g=>g.repo),evolutionCelebratedStage:3,results:Array.from({length:30},(_,i)=>({date:new Date(Date.parse(date)+i*1000).toISOString(),answers:[1,0,1,1,0],score:5})),gameResults:Array.from({length:50},()=>({gameId:'memorama-simplex' as const,runId:crypto.randomUUID(),date,completed:true as const,matchedPairs:8,totalPairs:8,attempts:10,errors:2,elapsedMs:1000,accuracy:80}))});
 await engine.importRaw(JSON.stringify(progress));await wait(()=>['synced','error'].includes(engine.getSnapshot().status));const view=engine.getSnapshot();assert.equal(view.error,'');assert.equal(Object.keys(view.progress.practiced).length,28);assert.equal(view.progress.gameResults.length,50);assert.equal(view.progress.results.length,30);assert.equal(view.progress.evolutionMilestones.length,2);
 }finally{engine.dispose();await env.cleanup();const base=await initializeTestEnvironment({...config,firestore:{...config.firestore,rules:readFileSync('firestore.rules','utf8')}});await base.cleanup();}
});
