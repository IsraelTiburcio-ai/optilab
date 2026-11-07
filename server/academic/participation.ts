import {validOriginalResult,isResultPilot} from '../../src/integration/originalResults.js';
import {validResult} from '../../src/integration/protocol.js';
import type {Actor,Data,Input,Scope} from './contracts.js';
import {activeContext,grant,type Reader,type Policy} from './authorization.js';
import {coursePath,groupPath,type AcademicReadView} from './repository.js';
import {scopeOf,exact,integer} from './validation.js';
import {denied,conflict} from './errors.js';
import {plan} from './plans.js';
import {millis} from './models.js';
import {ownPlayer} from './players.js';
import {activeMembers} from './progress.js';
import {gameById} from './catalog.js';
import {validActivityId} from '../../src/attempts/model.js';
export async function student(r:Reader,uid:string,s:Scope){await activeContext(r,s);const [c,g]=await Promise.all([r.get(`${coursePath(s.courseId)}/members/${uid}`),r.get(`${groupPath(s)}/members/${uid}`)]);if(!grant(c,uid,s,false)||!grant(g,uid,s,true))throw denied();}
const preferencePath=(s:Scope,uid:string)=>`${groupPath(s)}/rankingPreferences/${uid}`;
function preference(d:Data|null,uid:string,s:Scope){if(d&&(!exact(d,['schemaVersion','uid','courseId','termId','groupId','enabled','revision','updatedAt'])||d.schemaVersion!==1||d.uid!==uid||d.courseId!==s.courseId||d.termId!==s.termId||d.groupId!==s.groupId||typeof d.enabled!=='boolean'||!integer(d.revision,1,2147483646)||!Number.isFinite(millis(d.updatedAt))))throw conflict();return d;}
export async function rankingPreference(r:AcademicReadView,actor:Actor,i:Input){const s=scopeOf(i);await student(r,actor.uid,s);const p=preference(await r.get(preferencePath(s,actor.uid)),actor.uid,s);return {enabled:p?.enabled??false,revision:p?.revision??0};}
function controlDocument(d:Data|null,s:Scope){
 if(d&&(!exact(d,['schemaVersion','courseId','termId','groupId','enabled','revision','updatedBy','updatedAt'])||d.schemaVersion!==1||d.courseId!==s.courseId||d.termId!==s.termId||d.groupId!==s.groupId||typeof d.enabled!=='boolean'||!integer(d.revision,1,2147483646)||typeof d.updatedBy!=='string'||!d.updatedBy||!Number.isFinite(millis(d.updatedAt))))throw conflict();return d;
}
export function participationDocument(d:Data|null,uid:string,s:Scope){
 if(!d)return null;
 if(!exact(d,['schemaVersion','uid','courseId','termId','groupId','activities','updatedAt'])||d.schemaVersion!==1||d.uid!==uid||d.courseId!==s.courseId||d.termId!==s.termId||d.groupId!==s.groupId||!Number.isFinite(millis(d.updatedAt))||!d.activities||typeof d.activities!=='object'||Array.isArray(d.activities)||Object.keys(d.activities).length>300)throw conflict();
 for(const [id,f] of Object.entries(d.activities) as [string,Data][]){if(!validActivityId(id)||!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).some(k=>!['opened','declared','reported','completed','openedAt','declaredAt','reportedAt','completedAt','lastActivityAt'].includes(k))||!Number.isFinite(millis(f.lastActivityAt))||!['opened','declared','reported'].some(k=>f[k]===true)||['opened','declared','reported','completed'].some(k=>f[k]!==undefined&&f[k]!==true)||f.completed===true&&f.reported!==true||['opened','declared','reported','completed'].some(k=>f[k]===true? !Number.isFinite(millis(f[k+'At']))||millis(f[k+'At'])>millis(f.lastActivityAt):f[k+'At']!==undefined))throw conflict();}
 return d;
}
export async function configureParticipation(r:AcademicReadView,policy:Policy,actor:Actor,i:Input,time:()=>unknown){const s=scopeOf(i);await policy.group(r,actor.uid,s,'manageMembers');const path=`${groupPath(s)}/rankingControl/current`,old=controlDocument(await r.get(path),s);if((old?.revision??0)!==i.expectedVersion)throw conflict();return plan({outcome:'group-participation-configured',revision:(old?.revision??0)+1},[{path,data:{schemaVersion:1,...s,enabled:i.enabled,revision:(old?.revision??0)+1,updatedBy:actor.uid,updatedAt:time()}}]);}
export async function setRankingParticipation(r:AcademicReadView,actor:Actor,i:Input,time:()=>unknown){const s=scopeOf(i);await student(r,actor.uid,s);const gate=controlDocument(await r.get(`${groupPath(s)}/rankingControl/current`),s);if(i.enabled&&gate?.enabled===false)throw denied();const current=preference(await r.get(preferencePath(s,actor.uid)),actor.uid,s);if((current?.revision??0)!==i.expectedVersion)throw conflict();if(i.enabled&&!(await ownPlayer(r,actor.uid)).identity)throw conflict();return plan({outcome:'ranking-preference-saved',revision:(current?.revision??0)+1},[{path:preferencePath(s,actor.uid),data:{schemaVersion:1,uid:actor.uid,...s,enabled:i.enabled,revision:(current?.revision??0)+1,updatedAt:time()}}]);}
export async function recordGroupActivity(r:AcademicReadView,actor:Actor,i:Input,time:()=>unknown){
 const s=scopeOf(i);await student(r,actor.uid,s);if(!(await syncAdmission(r,actor)).allowed)throw denied();const event=await r.get(`users/${actor.uid}/reportedAttempts/${i.activityId}--${i.attemptId}`);
 if(!event||event.version!==1||event.uid!==actor.uid||event.id!==i.attemptId||event.activityId!==i.activityId||!['opened','declared','reported'].includes(event.kind)||event.trust!==(event.kind==='reported'?'client-report':'declaration')||!exact(event.context,['courseId','termId','groupId'])||event.context.courseId!==s.courseId||event.context.termId!==s.termId||event.context.groupId!==s.groupId||!Number.isFinite(millis(event.serverReceivedAt)))throw denied();
 if(event.kind==='reported'&&gameById.has(i.activityId!)){const {completed:completion,...result}=event.result??{};if(i.activityId==='memorama-simplex'?!validResult(event.result):!isResultPilot(i.activityId!)||!validOriginalResult(result,i.activityId!)||completion!==(result.reason==='completed'))throw denied();}
 if(!gameById.has(i.activityId!)){const a=await r.get(`${groupPath(s)}/groupActivities/${i.activityId}`);if(!a||a.activityId!==i.activityId||a.groupId!==s.groupId||a.courseId!==s.courseId||a.termId!==s.termId||a.definitionRevision<1||!['published','hidden','archived'].includes(a.status))throw denied();if(event.kind==='reported'){const revision=await r.get(`${coursePath(s.courseId)}/activities/${i.activityId}/revisions/${a.definitionRevision}`);if(revision?.provider!=='learningapps'||revision.sourceUrl!=='https://learningapps.org/watch?v=pznycxd7t21'||revision.embedUrl!=='https://learningapps.org/show.php?id=pznycxd7t21'||event.result?.completed!==true)throw denied();}}
 const path=`${groupPath(s)}/participation/${actor.uid}`,old=participationDocument(await r.get(path),actor.uid,s);
 const activities={...old?.activities},previous=activities[i.activityId!]??{},completed=event.kind==='reported'&&event.result?.completed===true&&event.result?.reason!=='time-limit';
 const latest=(old:unknown)=>millis(old)>millis(event.serverReceivedAt)?old:event.serverReceivedAt;
 const value={...previous,[event.kind]:true,[event.kind+'At']:latest(previous[event.kind+'At']),...completed?{completed:true,completedAt:latest(previous.completedAt)}:{},lastActivityAt:latest(previous.lastActivityAt)};
 // Monotonic facts, never scores. Replaying a stored event cannot inflate participation.
 if(previous[event.kind]===true&&(!completed||previous.completed===true)&&millis(previous[event.kind+'At'])>=millis(event.serverReceivedAt))return plan({outcome:'activity-already-projected',count:0});
 if(millis(previous.lastActivityAt)>millis(value.lastActivityAt))value.lastActivityAt=previous.lastActivityAt;
 activities[i.activityId!]=value;if(Object.keys(activities).length>300)throw conflict();
 return plan({outcome:'group-activity-projected',count:1},[{path,data:{schemaVersion:1,uid:actor.uid,...s,activities,updatedAt:time()}}]);
}
export async function groupRanking(r:AcademicReadView,policy:Policy,actor:Actor,i:Input){
 const s=scopeOf(i);try{await policy.group(r,actor.uid,s,'readHistory');}catch(e){if((e as {status?:number}).status!==403)throw e;await student(r,actor.uid,s);}
 const control=controlDocument(await r.get(`${groupPath(s)}/rankingControl/current`),s);if(control?.enabled===false)return {scope:s,enabled:false,controlRevision:control?.revision??0,criterion:'unique-group-openings-v1',trust:'client-reported-participation',truncated:false,rows:[]};
 const {members,truncated}=await activeMembers(r,s),rows:{alias:string;participation:number;position:number|null}[]=[];
 // Only this group's materialized facts are read; no private profile, email, UID or score is returned.
 for(const member of members){const p=preference(await r.get(preferencePath(s,member.uid)),member.uid,s);if(!p?.enabled)continue;const identity=(await ownPlayer(r,member.uid)).identity;if(!identity)continue;
 const projected=participationDocument(await r.get(`${groupPath(s)}/participation/${member.uid}`),member.uid,s);
 const count=Object.values(projected?.activities??{}).filter((v:any)=>v?.opened===true).length;
 rows.push({alias:identity.gamertag,participation:count,position:null});}
 rows.sort((a,b)=>b.participation-a.participation||a.alias.localeCompare(b.alias,'es'));let previous=-1,position=0;rows.forEach((row,index)=>{if(row.participation!==previous)position=index+1;previous=row.participation;row.position=truncated?null:position;});
 return {scope:s,enabled:true,controlRevision:control?.revision??0,criterion:'unique-group-openings-v1',trust:'client-reported-participation',truncated,rows};
}
export async function syncAdmission(r:AcademicReadView,actor:Actor){
 const [control,grantDoc]=await Promise.all([r.get('syncProductionControl/current'),r.get(`syncPilotMembers/${actor.uid}`)]);
 const active=!control||(exact(control,['version','readsEnabled','writesEnabled'])&&control.version===1&&control.readsEnabled===true&&control.writesEnabled===true);
 return actor.emailVerified===true&&active&&(!grantDoc||typeof grantDoc.status==='string'&&grantDoc.status!=='erased')?{allowed:true,mode:'production',expiresAt:null}:{allowed:false,mode:null,expiresAt:null};
}
