import type {Actor,Data,Input,Scope} from './contracts';
import type {Policy} from './authorization';
import {grant} from './authorization';
import type {AcademicReadView} from './repository';
import {coursePath,groupPath} from './repository';
import {roster,millis} from './models';
import {teacherProfile} from './profiles';
import {catalogGyms,gameById} from './catalog';

type SignalKind='opened'|'declared'|'reported';
interface Activity {
  opened:Set<string>;declared:Set<string>;reported:Set<string>;last:number|null;
}
interface ActiveMember {uid:string;label:string}
const blankActivity=():Activity=>({opened:new Set(),declared:new Set(),reported:new Set(),last:null});
const inPeriod=(at:number,from:number|null,to:number)=>Number.isFinite(at)&&(from===null||at>=from)&&at<=to;
const countGames=(games:string[],set:Set<string>)=>games.reduce((total,id)=>total+(set.has(id)?1:0),0);

export async function groupProgress(repo:AcademicReadView,policy:Policy,actor:Actor,input:Input):Promise<Data> {
  const s:Scope={courseId:input.courseId!,termId:input.termId!,groupId:input.groupId!};
  await policy.group(repo,actor.uid,s,'manageMembers');
  const now=Date.now(),days=input.periodDays??30;
  const from=days===0?null:now-days*86400000;
  const period={days,from:from===null?null:new Date(from).toISOString(),to:new Date(now).toISOString()};
  const {members,truncated}=await activeMembers(repo,s);
  const students=await Promise.all(members.map(async member=>{
    const [profile,activity]=await Promise.all([teacherProfile(repo,s,member.uid),readActivity(repo,member.uid,from,now)]);
    return {
      uid:member.uid,name:profile?.fullName??member.label,email:profile?.email??null,
      emailVerified:profile?.emailVerified===true,gamertag:profile?.gameIdentity?.nickname??null,
      lastActivityAt:activity.last===null?null:new Date(activity.last).toISOString(),
      opened:activity.opened.size,declared:activity.declared.size,reported:activity.reported.size,validated:0,
      practicedGames:activity.declared.size,completedGames:activity.reported.size,
      gyms:catalogGyms.map(gym=>({gymId:gym.gymId,opened:countGames(gym.games,activity.opened),
        declared:countGames(gym.games,activity.declared),reported:countGames(gym.games,activity.reported)})),
      activity,
    };
  }));
  const opened=new Set<string>(),declared=new Set<string>(),reported=new Set<string>();
  for(const student of students) {
    for(const id of student.activity.opened)opened.add(id);
    for(const id of student.activity.declared)declared.add(id);
    for(const id of student.activity.reported)reported.add(id);
  }
  return {
    scope:s,
    period,
    generatedAt:period.to,
    studentsTotal:students.length,
    studentsActive:students.filter(student=>student.activity.last!==null||student.activity.opened.size||student.activity.declared.size||student.activity.reported.size).length,
    activities:{opened:opened.size,declared:declared.size,reported:reported.size,validated:0},
    gyms:catalogGyms.map(gym=>({gymId:gym.gymId,title:gym.title,totalGames:gym.totalGames,
      opened:countGames(gym.games,opened),practiced:countGames(gym.games,declared),completed:countGames(gym.games,reported)})),
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

async function readActivity(repo:AcademicReadView,uid:string,from:number|null,to:number):Promise<Activity> {
  const result=blankActivity();
  const head=await repo.get(`users/${uid}/sync/current`);
  if(!head||!Number.isInteger(head.epoch)||head.epoch<1||head.epoch>1000000||
    (head.uid!==undefined&&head.uid!==uid)||(head.schemaVersion!==undefined&&head.schemaVersion!==2))return result;
  const epoch=head.epoch as number;
  const signal=(kind:SignalKind,gameId:string,at:number)=>{
    if(!inPeriod(at,from,to)||!gameById.has(gameId))return;
    result[kind].add(gameId);
    result.last=result.last===null?at:Math.max(result.last,at);
  };
  const touch=(at:number)=>{if(inPeriod(at,from,to))result.last=result.last===null?at:Math.max(result.last,at);};
  const [fields,runs,diagnostics,attempts]=await Promise.all([
    repo.page(`users/${uid}/epochs/${epoch}/fields`,40),
    repo.page(`users/${uid}/epochs/${epoch}/gameRuns`,50),
    repo.page(`users/${uid}/epochs/${epoch}/diagnostics`,50),
    repo.page(`users/${uid}/reportedAttempts`,2000),
  ]);
  for(const {id,data} of fields) {
    if(!id.startsWith('practice--'))continue;
    signal('declared',id.slice(10),millis(data?.value));
  }
  for(const {data} of runs) {
    if(typeof data?.gameId!=='string')continue;
    signal('reported',data.gameId,millis(data?.date));
  }
  for(const {data} of diagnostics) {
    const at=millis(data?.date);
    if(typeof data?.gameId==='string')signal('reported',data.gameId,at);
    else touch(at);
  }
  for(const {data} of attempts) {
    if(typeof data?.activityId!=='string'||!['opened','declared','reported'].includes(data?.kind))continue;
    const at=typeof data.observedAt==='string'?Date.parse(data.observedAt):millis(data?.observedAt);
    if(Number.isFinite(at))signal(data.kind as SignalKind,data.activityId,at);
  }
  return result;
}
