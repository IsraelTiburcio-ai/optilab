import type {Actor,Data,Input,Scope} from './contracts';
import type {Policy} from './authorization';
import {grant} from './authorization';
import type {AcademicReadView} from './repository';
import {coursePath,groupPath} from './repository';
import {roster,millis} from './models';
import {teacherProfile} from './profiles';
import {catalogGyms,gameById} from './catalog';

type SignalKind='opened'|'declared'|'reported'|'completed';
interface Activity {
  opened:Set<string>;declared:Set<string>;reported:Set<string>;completed:Set<string>;last:number|null;truncated:boolean;
}
interface ActiveMember {uid:string;label:string}
const blankActivity=():Activity=>({opened:new Set(),declared:new Set(),reported:new Set(),completed:new Set(),last:null,truncated:false});
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
    const [profile,activity]=await Promise.all([teacherProfile(repo,s,member.uid),readActivity(repo,member.uid,from,now,attemptLimit)]);
    return {
      uid:member.uid,name:profile?.fullName??member.label,email:profile?.email??null,
      emailVerified:profile?.emailVerified===true,gamertag:profile?.gameIdentity?.nickname??null,
      lastActivityAt:activity.last===null?null:new Date(activity.last).toISOString(),
      opened:activity.opened.size,declared:activity.declared.size,reported:activity.reported.size,validated:0,
      practicedGames:activity.declared.size,completedGames:activity.completed.size,
      gyms:catalogGyms.map(gym=>({gymId:gym.gymId,opened:countGames(gym.games,activity.opened),
        declared:countGames(gym.games,activity.declared),reported:countGames(gym.games,activity.reported),
        completed:countGames(gym.games,activity.completed)})),
      activity,
    };
  }));
  const opened=new Set<string>(),declared=new Set<string>(),reported=new Set<string>(),completed=new Set<string>();
  for(const student of students) {
    for(const id of student.activity.opened)opened.add(id);
    for(const id of student.activity.declared)declared.add(id);
    for(const id of student.activity.reported)reported.add(id);
    for(const id of student.activity.completed)completed.add(id);
  }
  return {
    scope:s,
    period,
    generatedAt:period.to,
    studentsTotal:students.length,
    studentsActive:students.filter(student=>student.activity.last!==null||student.activity.opened.size||student.activity.declared.size||student.activity.reported.size||student.activity.completed.size).length,
    activityDataTruncated:students.some(student=>student.activity.truncated),
    activities:{opened:opened.size,declared:declared.size,reported:reported.size,completed:completed.size,validated:0},
    gyms:catalogGyms.map(gym=>({gymId:gym.gymId,title:gym.title,totalGames:gym.totalGames,
      opened:countGames(gym.games,opened),practiced:countGames(gym.games,declared),reported:countGames(gym.games,reported),
      completed:countGames(gym.games,completed)})),
    students:students.map(({activity: _activity,...student})=>student),
    truncated,
  };
}

async function activeMembers(repo:AcademicReadView,s:Scope):Promise<{members:ActiveMember[];truncated:boolean}> {
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

async function readActivity(repo:AcademicReadView,uid:string,from:number|null,to:number,attemptLimit=200):Promise<Activity> {
  const result=blankActivity();
  const [head,attempts]=await Promise.all([
    repo.get(`users/${uid}/sync/current`),
    repo.page(`users/${uid}/reportedAttempts`,attemptLimit),
  ]);
  result.truncated=attempts.length===attemptLimit;
  const signal=(kind:SignalKind,gameId:string,at:number)=>{
    if(!inPeriod(at,from,to)||!gameById.has(gameId))return;
    result[kind].add(gameId);
    result.last=result.last===null?at:Math.max(result.last,at);
  };
  const touch=(at:number)=>{if(inPeriod(at,from,to))result.last=result.last===null?at:Math.max(result.last,at);};
  // Consents are independent from the progress head: attempt events remain visible
  // for a student who has never created users/{uid}/sync/current.
  for(const {id,data} of attempts) {
    if(!validAttempt(data,id,uid))continue;
    const at=Date.parse(data.observedAt);
    if(data.kind==='reported') {
      signal('reported',data.activityId,at);
      if(data.result&&data.result.completed===true)signal('completed',data.activityId,at);
    } else signal(data.kind as 'opened'|'declared',data.activityId,at);
  }
  if(!head||!Number.isInteger(head.epoch)||head.epoch<1||head.epoch>1000000||
    (head.uid!==undefined&&head.uid!==uid)||(head.schemaVersion!==undefined&&head.schemaVersion!==2))return result;
  const epoch=head.epoch as number;
  const [fields,runs,diagnostics]=await Promise.all([
    repo.page(`users/${uid}/epochs/${epoch}/fields`,40),
    repo.page(`users/${uid}/epochs/${epoch}/gameRuns`,50),
    repo.page(`users/${uid}/epochs/${epoch}/diagnostics`,50),
  ]);
  for(const {id,data} of fields) {
    if(!id.startsWith('practice--'))continue;
    signal('declared',id.slice(10),millis(data?.value));
  }
  for(const {data} of runs) {
    if(typeof data?.gameId!=='string')continue;
    const at=millis(data?.date);
    signal('reported',data.gameId,at);
    if(data.result&&data.result.completed===true)signal('completed',data.gameId,at);
  }
  for(const {data} of diagnostics) {
    const at=millis(data?.date);
    touch(at);
    // A diagnostic is a reported result only when it carries explicit game identity;
    // it is never a completion without a completed result field.
    if(typeof data?.gameId==='string')signal('reported',data.gameId,at);
  }
  return result;
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
