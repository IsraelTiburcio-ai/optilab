import {test} from 'node:test';
import assert from 'node:assert/strict';
import {append,empty,decode,type Attempt} from '../../src/attempts/model';
import {admissionWatch,setAdmission,clearAdmission} from '../../src/progress/admissionSignal';
import {participationDocument} from '../../server/academic/participation';
const scope={courseId:'demo-course',termId:'demo-term',groupId:'demo-group'};
test('contexto estricto, eventos repetidos conservan fecha original y payloads contradictorios se rechazan',()=>{
 const e:Attempt={version:1,id:'session:open',activityId:'a_'+'a'.repeat(32),kind:'opened',trust:'declaration',observedAt:'2026-11-07T00:00:00Z',context:scope};
 const ledger=append(empty(),e);assert.equal(append(ledger,{...e,observedAt:'2026-11-07T00:01:00Z'}),ledger);assert.deepEqual(decode(JSON.stringify(ledger)),ledger);
 assert.throws(()=>append(ledger,{...e,context:{...scope,groupId:'other'}}));assert.throws(()=>append(empty(),{...e,context:{...scope,uid:'other'} as any}));assert.throws(()=>append(empty(),{...e,activityId:'arbitrary-score'}));
});
test('admisión: sin fábrica/red previa, aislamiento UID, pausa, reconexión y liberación',()=>{
 let created=0,closed=0;const factory=()=>{created++;return {watch:()=>()=>{closed++;}};};
 const stop=admissionWatch('synthetic-a',factory,()=>{},()=>{});assert.equal(created,0);setAdmission('synthetic-b',true);assert.equal(created,0);setAdmission('synthetic-a',true);assert.equal(created,1);setAdmission('synthetic-a',true);assert.equal(created,1);setAdmission('synthetic-a',false);assert.equal(closed,1);setAdmission('synthetic-a',true);assert.equal(created,2);stop();assert.equal(closed,2);setAdmission('synthetic-a',false);setAdmission('synthetic-a',true);assert.equal(created,2);clearAdmission('synthetic-a');clearAdmission('synthetic-b');
});
test('proyecciones corruptas o de otro grupo nunca inflan el ranking',()=>{
 const value={schemaVersion:1,uid:'synthetic-a',...scope,updatedAt:{toMillis:()=>Date.now()},activities:{'system-lab':{opened:true,openedAt:{toMillis:()=>Date.now()-1},lastActivityAt:{toMillis:()=>Date.now()}}}};assert.equal(participationDocument(value,'synthetic-a',scope),value);
 for(const patch of [{groupId:'other'},{activities:{invented:{opened:true,lastActivityAt:{toMillis:()=>Date.now()}}}},{activities:{'system-lab':{completed:true,lastActivityAt:{toMillis:()=>Date.now()}}}},{activities:{'system-lab':{opened:true,score:999,lastActivityAt:{toMillis:()=>Date.now()}}}}])assert.throws(()=>participationDocument({...value,...patch},'synthetic-a',scope));
});

import {activityPath,orderedVisible} from '../../src/activities/navigation';
import {academicPath} from '../../server/academic/repository';
test('siguiente actividad respeta orden mixto, ocultos, IDs ajenos y contexto',()=>{
 const external={activityId:'a_'+'a'.repeat(32)} as any;
 assert.deepEqual(orderedVisible(3,{orderedActivityIds:['memorama-simplex',external.activityId,'unknown'],hiddenOriginalGameIds:['rompecabezas-simplex']},[external]).slice(0,2),['memorama-simplex',external.activityId]);
 assert.ok(!orderedVisible(3,{orderedActivityIds:['rompecabezas-simplex','system-lab'],hiddenOriginalGameIds:['rompecabezas-simplex']},[]).includes('system-lab'));
 assert.ok(!orderedVisible(3,{orderedActivityIds:[],hiddenOriginalGameIds:['rompecabezas-simplex']},[]).includes('rompecabezas-simplex'));
 assert.equal(activityPath(external.activityId,scope),'/grupo/demo-course/demo-term/demo-group/actividad/'+external.activityId);
 assert.match(activityPath('memorama-simplex',scope),/^\/jugar\/memorama-simplex\?courseId=/);
});
test('rutas de intentos aceptan IDs reales con dos puntos, nunca traversal o escrituras a controles',()=>{
 assert.equal(academicPath('users/demo-user/reportedAttempts/memorama-simplex--session:open'),'users/demo-user/reportedAttempts/memorama-simplex--session:open');
 assert.throws(()=>academicPath('users/demo-user/reportedAttempts/../../other'));assert.throws(()=>academicPath('arbitrary/path'));
});
import {planUid} from '../../server/pilot/plan.mjs';
test('exportación y borrado administrativo existentes incluyen proyecciones y consentimiento derivados por UID',()=>{
 const uid='synthetic-owner',root='courses/demo-course/terms/demo-term/groups/demo-group';
 const plan=planUid(uid,[{path:`${root}/participation/${uid}`,data:{uid,...scope},version:'1'},{path:`${root}/rankingPreferences/${uid}`,data:{uid,...scope,enabled:false},version:'1'},{path:`${root}/participation/another`,data:{uid:'another'},version:'1'}]);
 assert.equal(plan.owned.length,2);assert.equal(plan.review.length,0);assert.ok(plan.owned.every((d:any)=>d.path.endsWith('/'+uid)));
});
