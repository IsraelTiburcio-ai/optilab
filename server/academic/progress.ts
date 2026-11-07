import type {Actor,Data,Input,Scope} from './contracts.js';
import type {Policy} from './authorization.js';
import {grant} from './authorization.js';
import type {AcademicReadView} from './repository.js';
import {coursePath,groupPath} from './repository.js';
import {roster,millis} from './models.js';
import {teacherProfile} from './profiles.js';
import {catalogGyms,gameById} from './catalog.js';
import {participationDocument} from './participation.js';

type SignalKind='opened'|'declared'|'reported'|'completed';
interface Activity {
  explicit:Set<string>;opened:Set<string>;declared:Set<string>;reported:Set<string>;completed:Set<string>;last:number|null;truncated:boolean;
}
interface ActiveMember {uid:string;label:string}
const blankActivity=():Activity=>({explicit:new Set(),opened:new Set(),declared:new Set(),reported:new Set(),completed:new Set(),last:null,truncated:false});
const inPeriod=(at:number,from:number|null,to:number)=>Number.isFinite(at)&&(from===null||at>=from)&&at<=to;
const countGames=(games:string[],set:Set<string>)=>games.reduce((total,id)=>total+(set.has(id)?1:0),0);
const attemptId=/^[-A-Za-z0-9_:]{1,160}$/;
const attemptResultKeys=['reason','correct','total','attempts','errors','durationMs','timeouts','score','accuracy','matchedPairs','totalPairs','elapsedMs','completed'];
const attemptNumbers=['correct','total','attempts','errors','durationMs','timeouts','score','accuracy','matchedPairs','totalPairs','elapsedMs'];

export async function groupProgress(repo:AcademicReadView,policy:Policy,actor:Actor,input:Input,attemptLimit=200):Promise<Data> {
  const s:Scope={courseId:input.courseId!,termId:input.termId!,groupId:input.groupId!};
  await policy.group(repo,actor.uid,s,'readHistory');
  const now=Date.now(),days=input.periodDays??30;
  const from=days===0?null:now-days*86400000;
  const period={days,from:from===null?null:new Date(from).toISOString(),to:new Date(now).toISOString()};
  const {members,truncated}=await activeMembers(repo,s);
  const students=await Promise.all(members.map(async member=>{
    const [profile,activity,projection]=await Promise.all([teacherProfile(repo,s,member.uid),readActivity(repo,member.uid,from,now,attemptLimit,s),repo.get(`${groupPath(s)}/participation/${member.uid}`)]);
    if(projection&&participationDocument(projection,member.uid,s)){for(const [id,fact] of Object.entries(projection.activities??{}) as [string,Data][]){const at=millis(fact.lastActivityAt);for(const kind of ['opened','declared','reported','completed'] as const)if(fact[kind]===true&&inPeriod(millis(fact[kind+'At']),from,now))activity[kind].add(id);if(fact.declared===true&&inPeriod(millis(fact.declaredAt),from,now))activity.explicit.add(id);if(inPeriod(at,from,now))activity.last=Math.max(activity.last??0,at);}}
    return {
      uid:member.uid,name:profile?.fullName??member.label,email:profile?.email??null,
      emailVerified:profile?.emailVerified===true,gamertag:profile?.gameIdentity?.nickname??null,
      lastActivityAt:activity.last===null?null:new Date(activity.last).toISOString(),
      manualDeclaredGames:activity.explicit.size,opened:activity.opened.size,declared:activity.declared.size,reported:activity.reported.size,validated:0,
      practicedGames:new Set([...activity.declared,...activity.completed].filter(id=>gameById.has(id))).size,completedGames:activity.completed.size,pendingGames:Math.max(0,28-new Set([...activity.declared,...activity.completed].filter(id=>gameById.has(id))).size),
      gyms:catalogGyms.map(gym=>({gymId:gym.gymId,opened:countGames(gym.games,activity.opened),
        declared:countGames(gym.games,activity.declared),reported:countGames(gym.games,activity.reported),
        completed:countGames(gym.games,activity.completed),practiced:countGames(gym.games,new Set([...activity.declared,...activity.completed])),pending:Math.max(0,gym.totalGames-countGames(gym.games,new Set([...activity.declared,...activity.completed])))})),
      activity,
    };
  }));
  const explicit=new Set<string>(),opened=new Set<string>(),declared=new Set<string>(),reported=new Set<string>(),completed=new Set<string>();
  for(const student of students) {
    for(const id of student.activity.explicit)explicit.add(id);
    for(const id of student.activity.opened)opened.add(id);
    for(const id of student.activity.declared)declared.add(id);
    for(const id of student.activity.reported)reported.add(id);
    for(const id of student.activity.completed)completed.add(id);
  }
  const externalActivities=[];
  const externalIds=[...new Set(students.flatMap(student=>[...student.activity.opened,...student.activity.declared,...student.activity.reported,...student.activity.completed]))].filter(id=>!gameById.has(id));
  for(const activityId of externalIds){const assignment=await repo.get(`${groupPath(s)}/groupActivities/${activityId}`);let title='Actividad de clase archivada',provider='external';
    if(assignment?.courseId===s.courseId&&assignment.termId===s.termId&&assignment.groupId===s.groupId&&Number.isInteger(assignment.definitionRevision)&&assignment.definitionRevision>0){const revision=await repo.get(`${coursePath(s.courseId)}/activities/${activityId}/revisions/${assignment.definitionRevision}`);if(revision?.groupIds?.includes(s.groupId)&&typeof revision.title==='string'){title=revision.title;provider=revision.provider;}}
    externalActivities.push({activityId,title,provider,opened:students.filter(row=>row.activity.opened.has(activityId)).length,declared:students.filter(row=>row.activity.explicit.has(activityId)).length,reported:students.filter(row=>row.activity.reported.has(activityId)).length,completed:students.filter(row=>row.activity.completed.has(activityId)).length,validated:0});
  }
  return {
    externalActivities,scope:s,
    period,
    generatedAt:period.to,
    studentsTotal:students.length,
    studentsActive:students.filter(student=>student.activity.last!==null||student.activity.opened.size||student.activity.declared.size||student.activity.reported.size||student.activity.completed.size).length,
    activityDataTruncated:students.some(student=>student.activity.truncated),
    activities:{manualDeclared:explicit.size,practiced:new Set([...declared,...completed]).size,opened:opened.size,declared:declared.size,reported:reported.size,completed:completed.size,validated:0},
    gyms:catalogGyms.map(gym=>({gymId:gym.gymId,title:gym.title,totalGames:gym.totalGames,
      opened:countGames(gym.games,opened),practiced:countGames(gym.games,new Set([...declared,...completed])),reported:countGames(gym.games,reported),
      completed:countGames(gym.games,completed)})),
    students:students.map(({activity: _activity,...student})=>student),
    truncated,
  };
}

export async function activeMembers(repo:AcademicReadView,s:Scope):Promise<{members:ActiveMember[];truncated:boolean}> {
  const root=groupPath(s),members:ActiveMember[]=[];
  let cursor:string|undefined;
  for(;;) {
    const rows=await repo.page(`${root}/roster`,50,cursor);
    for(const {id,data} of rows) {
      const row=roster(data,s,id);
      if(row.status!=='active')continue;
      if(members.length===100)return {members,truncated:true};
      const [member,courseMember]=await Promise.all([repo.get(`${root}/members/${id}`),repo.get(`${coursePath(s.courseId)}/members/${id}`)]);
      if(!grant(member,id,s,true)||!grant(courseMember,id,s,false))continue;
      members.push({uid:id,label:row.label});
    }
    if(rows.length<50)return {members,truncated:false};
    cursor=rows.at(-1)!.id;
  }
}

async function readActivity(repo:AcademicReadView,uid:string,from:number|null,to:number,attemptLimit=200,scope?:Scope):Promise<Activity> {
  const result=blankActivity();
  const attempts=await repo.attempts(`users/${uid}/reportedAttempts`,attemptLimit,from===null?null:new Date(from).toISOString(),new Date(to).toISOString());
  result.truncated=attempts.length===attemptLimit;
  const signal=(kind:SignalKind,gameId:string,at:number)=>{
    if(!inPeriod(at,from,to)||!gameById.has(gameId))return;
    result[kind].add(gameId);
    result.last=result.last===null?at:Math.max(result.last,at);
  };
  // Consents are independent from the progress head: attempt events remain visible
  // for a student who has never created users/{uid}/sync/current.
  for(const {id,data} of attempts) {
    if(!validAttempt(data,id,uid))continue;
    if(!scope||!validAttemptContext(data.context)||data.context.courseId!==scope.courseId||data.context.termId!==scope.termId||data.context.groupId!==scope.groupId)continue;
    const at=Date.parse(data.observedAt);
    if(data.kind==='reported') {
      signal('reported',data.activityId,at);
      if(data.result&&data.result.completed===true)signal('completed',data.activityId,at);
    } else {signal(data.kind as 'opened'|'declared',data.activityId,at);if(data.kind==='declared'&&inPeriod(at,from,to))result.explicit.add(data.activityId);}
  }
  return result;
}

function validAttemptContext(value:unknown):value is {courseId:string;termId:string;groupId:string} {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;const context=value as Record<string,unknown>;
  return Object.keys(context).length===3&&['courseId','termId','groupId'].every(key=>typeof context[key]==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(context[key] as string));
}
function validAttempt(data:Data,docId:string,uid:string):boolean {
  if(!data||data.version!==1||data.uid!==uid||typeof data.id!=='string'||!attemptId.test(data.id)||
    typeof data.activityId!=='string'||!gameById.has(data.activityId)||
    !['opened','declared','reported'].includes(data.kind)||
    data.trust!==(data.kind==='reported'?'client-report':'declaration')||
    docId!==`${data.activityId}--${data.id}`||
    typeof data.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(data.observedAt)||
    !Number.isFinite(Date.parse(data.observedAt)))return false;
  if(data.kind!=='reported'&&data.result!==undefined)return false;
  return data.result===undefined||validAttemptResult(data.result);
}

function validAttemptResult(value:unknown):boolean {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const result=value as Record<string,unknown>;
  if(Object.keys(result).some(key=>!attemptResultKeys.includes(key)))return false;
  if(result.reason!==undefined&&result.reason!=='completed'&&result.reason!=='time-limit')return false;
  if(result.completed!==undefined&&typeof result.completed!=='boolean')return false;
  return attemptNumbers.every(key=>result[key]===undefined||
    (typeof result[key]==='number'&&Number.isSafeInteger(result[key])&&result[key]>=0));
}
