import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {emulatorAdmin,type EmulatorAdmin} from '../../server/academic/sdk';
import {localConfig} from '../../server/academic/config';
import {seedFixtures} from '../../server/academic/bootstrap';
import {AcademicRepository,type Metrics} from '../../server/academic/repository';
import {AcademicService} from '../../server/academic/service';

let sdk:EmulatorAdmin;
before(async()=>{sdk=await emulatorAdmin();});
after(async()=>{if(sdk)await sdk.close();});

test('60 synthetic students: concurrent Home ranking is coalesced and bounded',async()=>{
 const config=localConfig(process.env),f=await seedFixtures(sdk,'fixture-password-123'),scope={courseId:f.courseId,termId:f.termId,groupId:f.groups.a},repo=new AcademicRepository(sdk.db),games=['system-lab','model-match','ruta-de-metas','lp-factory','ahorcado-simplex','ordena-simplex','rompecabezas-simplex','caza-el-pivote'],stamp=sdk.timestamp(Date.now()),batch=sdk.db.batch();
 const students=Array.from({length:60},(_,i)=>({uid:`perf-student-${String(i).padStart(3,'0')}`,label:`Alumno sintético ${String(i+1).padStart(2,'0')}`}));
 for(let i=0;i<students.length;i++){
  const {uid,label}=students[i];
  batch.set(sdk.db.doc(`courses/${f.courseId}/members/${uid}`),{schemaVersion:1,courseId:f.courseId,uid,status:'active'});
  batch.set(sdk.db.doc(`courses/${f.courseId}/terms/${f.termId}/groups/${f.groups.a}/members/${uid}`),{schemaVersion:1,...scope,uid,status:'active'});
  batch.set(sdk.db.doc(`courses/${f.courseId}/terms/${f.termId}/groups/${f.groups.a}/roster/${uid}`),{schemaVersion:2,...scope,uid,label,labelSource:'self-chosen',status:'active'});
  const activities=Object.fromEntries(games.slice(0,i%8).map(gameId=>[gameId,{opened:true,openedAt:stamp,lastActivityAt:stamp}]));
  batch.set(sdk.db.doc(`courses/${f.courseId}/terms/${f.termId}/groups/${f.groups.a}/participation/${uid}`),{schemaVersion:1,...scope,uid,activities,updatedAt:stamp});
 }
 await batch.commit();
 const call=async(actor:{uid:string;label:string})=>{const start=performance.now();let metrics:Metrics|null=null;const service=new AcademicService(repo,sdk,config.maxTtlSeconds,{onMetrics:(_op,m)=>{metrics=m;}});try{const result=await service.execute({...actor,emailVerified:true},'groupRanking',scope);return {ok:true,ms:performance.now()-start,metrics,rows:result.rows.length};}catch(error){return {ok:false,ms:performance.now()-start,metrics,error:(error as Error).message};}};
 const summarize=(results:Array<Awaited<ReturnType<typeof call>>>)=>{const ok=results.filter(row=>row.ok),times=ok.map(row=>row.ms).sort((a,b)=>a-b),p95=times[Math.min(times.length-1,Math.floor((times.length-1)*.95))]??0,totalReads=ok.reduce((sum,row)=>sum+(row.metrics?.documentReadAttempts??0),0);return {ok:ok.length,errors:results.length-ok.length,p95,totalReads,writes:ok.reduce((sum,row)=>sum+(row.metrics?.committedWrites??0),0)};};
 const cold=summarize(await Promise.all(students.map(call))),warm=summarize(await Promise.all(students.map(call)));
 assert.equal(cold.errors,0);assert.equal(warm.errors,0);assert.equal(cold.ok,60);assert.equal(warm.ok,60);assert.ok(cold.p95<20000,`cold p95 ${cold.p95}`);assert.ok(warm.p95<5000,`warm p95 ${warm.p95}`);assert.ok(cold.totalReads<5000,`cold reads ${cold.totalReads}`);assert.ok(warm.totalReads<2000,`warm reads ${warm.totalReads}`);assert.equal(cold.writes,0);assert.equal(warm.writes,0);
 console.log(JSON.stringify({students:60,cold,warm}));
});
