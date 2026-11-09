import {validOriginalResult,isResultPilot} from '../../src/integration/originalResults.js';
import {validResult} from '../../src/integration/protocol.js';
import type {Actor,Data,Input,Scope} from './contracts.js';
import {activeContext,grant,type Reader,type Policy} from './authorization.js';
import {coursePath,groupPath,hash,type AcademicReadView} from './repository.js';
import {scopeOf,exact,integer} from './validation.js';
import {denied,conflict} from './errors.js';
import {plan} from './plans.js';
import {millis} from './models.js';
import type {AcademicTransaction} from './repository.js';
import {ownPlayer} from './players.js';
import {profileDocument} from './profiles.js';
import {playerDocument} from './playerModel.js';
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
export async function configureParticipation(r:AcademicReadView,policy:Policy,actor:Actor,i:Input,time:()=>unknown){const s=scopeOf(i);await policy.group(r,actor.uid,s,'manageMembers');const path=`${groupPath(s)}/rankingControl/current`,old=controlDocument(await r.get(path),s);if((old?.revision??0)!==i.expectedVersion)throw conflict();const result=plan({outcome:'group-participation-configured',revision:(old?.revision??0)+1},[{path,data:{schemaVersion:1,...s,enabled:i.enabled,revision:(old?.revision??0)+1,updatedBy:actor.uid,updatedAt:time()}}]);result.invalidations=[s];return result;}
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
 const result=plan({outcome:'group-activity-projected',count:1},[{path,data:{schemaVersion:1,uid:actor.uid,...s,activities,updatedAt:time()}}]);result.invalidations=[s];return result;
}
async function allRows(r:Pick<AcademicReadView,'get'|'page'>,path:string):Promise<{id:string;data:Data}[]>{
 const rows:{id:string;data:Data}[]=[];let cursor:string|undefined;
 for(let page=0;page<20;page++){const batch=await r.page(path,50,cursor);rows.push(...batch);if(batch.length<50)return rows;cursor=batch.at(-1)!.id;}
 return rows;
}
type RankingBase={board:Data;aliases:Map<string,string>};
const rankingCache=new Map<string,{expires:number;value:RankingBase}>();
const rankingInflight=new Map<string,Promise<RankingBase>>();
let rankingEpoch=0;
const rankingKey=(s:Scope)=>`${s.courseId}/${s.termId}/${s.groupId}`;
export function invalidateRankingCache(scope?:Scope){rankingEpoch++;if(!scope){rankingCache.clear();rankingInflight.clear();return;}rankingCache.delete(rankingKey(scope));rankingInflight.delete(rankingKey(scope));}
function withSelf(base:RankingBase,uid:string):Data{const row=(base.board.rows as Data[]).find(item=>item.alias===base.aliases.get(uid))??null;return {...base.board,self:row};}
async function buildGroupRanking(r:Pick<AcademicReadView,'get'|'page'>,s:Scope,teacherView:boolean):Promise<RankingBase>{
 const group=await r.get(groupPath(s)),control=controlDocument(await r.get(`${groupPath(s)}/rankingControl/current`),s),groupTitle=typeof group?.title==='string'?group.title:'';
 if(control?.enabled===false)return {aliases:new Map(),board:{scope:s,enabled:false,controlRevision:control?.revision??0,criterion:'unique-group-openings-v1',trust:'client-reported-participation',truncated:false,rows:[],self:null,groupTitle}};
 const {members,truncated}=await activeMembers(r,s),rows:{alias:string;fullName:string;gamertag:string|null;participation:number;position:number|null}[]=[];const aliasesByUid=new Map<string,string>();
 const [aliasRows,participationRows]=await Promise.all([allRows(r,`${groupPath(s)}/rankingAliases`),allRows(r,`${groupPath(s)}/participation`)]);
 const aliasMap=new Map(aliasRows.map(row=>[row.id,row.data])),participationMap=new Map(participationRows.map(row=>[row.id,row.data]));
 await Promise.all(members.map(async member=>{
  const stored=aliasMap.get(member.uid)??null;
  if(stored&&(!exact(stored,['schemaVersion','courseId','termId','groupId','uid','alias'])||stored.schemaVersion!==1||stored.courseId!==s.courseId||stored.termId!==s.termId||stored.groupId!==s.groupId||stored.uid!==member.uid||typeof stored.alias!=='string'||!/^Explorador-[a-f0-9]{32}$/.test(stored.alias)))throw conflict();
  const alias=stored?.alias??'Explorador-'+hash(`${s.courseId}:${s.termId}:${s.groupId}:${member.uid}`).slice(0,32);aliasesByUid.set(member.uid,alias);
  const [profileRaw,playerRaw]=await Promise.all([r.get(`academicProfiles/${member.uid}`),r.get(`playerIdentities/${member.uid}`)]);
  const profile=profileDocument(profileRaw,member.uid),player=playerDocument(playerRaw,member.uid);
  const fullName=typeof profile?.fullName==='string'?profile.fullName.trim():'';
  const gamertag=typeof player?.gamertag==='string'?player.gamertag:null;
  const projected=participationDocument(participationMap.get(member.uid)??null,member.uid,s);
  const count=Object.values(projected?.activities??{}).filter((v:any)=>v?.opened===true).length;
  rows.push({alias,fullName,gamertag,participation:count,position:null});
 }));
 rows.sort((a,b)=>b.participation-a.participation||a.alias.localeCompare(b.alias,'es'));let previous=-1,position=0;rows.forEach((row,index)=>{if(row.participation!==previous)position=index+1;previous=row.participation;row.position=truncated?null:position;});
 return {aliases:aliasesByUid,board:{scope:s,enabled:true,controlRevision:control?.revision??0,criterion:'unique-group-openings-v1',trust:'client-reported-participation',truncated,rows,self:null,groupTitle}};
}
export async function groupRanking(r:Pick<AcademicReadView,'get'|'page'>,policy:Policy,actor:Actor,i:Input){
 const s=scopeOf(i);let teacherView=false;try{await policy.group(r,actor.uid,s,'readHistory');teacherView=true;}catch(e){if((e as {status?:number}).status!==403)throw e;await student(r,actor.uid,s);}
 if(!teacherView){const key=rankingKey(s),cached=rankingCache.get(key);if(cached&&cached.expires>Date.now())return withSelf(cached.value,actor.uid);
  const pending=rankingInflight.get(key);if(pending)return withSelf(await pending,actor.uid);
  const epoch=rankingEpoch,request=buildGroupRanking(r,s,false);rankingInflight.set(key,request);
  try{const base=await request;if(epoch===rankingEpoch)rankingCache.set(key,{expires:Date.now()+5000,value:base});return withSelf(base,actor.uid);}finally{rankingInflight.delete(key);}
 }
 return (await buildGroupRanking(r,s,true)).board;
}
export async function syncAdmission(r:AcademicReadView,actor:Actor){
 const [control,grantDoc]=await Promise.all([r.get('syncProductionControl/current'),r.get(`syncPilotMembers/${actor.uid}`)]);
 const active=!control||(exact(control,['version','readsEnabled','writesEnabled'])&&control.version===1&&control.readsEnabled===true&&control.writesEnabled===true);
 return actor.emailVerified===true&&active&&(!grantDoc||typeof grantDoc.status==='string'&&grantDoc.status!=='erased')?{allowed:true,mode:'production',expiresAt:null}:{allowed:false,mode:null,expiresAt:null};
}
