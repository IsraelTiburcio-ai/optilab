import type {Actor,Data,Input,Scope} from './contracts.js';
import {activeContext,type Policy,type Reader} from './authorization.js';
import {grant} from './authorization.js';
import {coursePath,groupPath,hash,type AcademicReadView} from './repository.js';
import {ApiError,conflict,denied,invalid} from './errors.js';
import {plan,type Plan} from './plans.js';
import {exact,identifier,integer,scopeOf} from './validation.js';
import {millis} from './models.js';
import {approvedActivityUrl,providerTelemetry,type ActivityProvider} from './activityUrls.js';

const gymIds=[1,2,3,4,5] as const;
const definitionKeys=['schemaVersion','courseId','activityId','provider','resourceId','sourceUrl','embedUrl','title','description','instructions','groupIds','telemetry','status','revision','publishedRevision','createdBy','createdAt','updatedAt','publishedAt'];
const revisionKeys=['schemaVersion','courseId','activityId','provider','resourceId','sourceUrl','embedUrl','title','description','instructions','groupIds','telemetry','revision','publishedBy','publishedAt'];
const assignmentKeys=['schemaVersion','courseId','termId','groupId','activityId','gymId','status','displayOrder','revision','definitionRevision','createdBy','updatedAt','publishedAt'];
const placementKeys=['schemaVersion','courseId','termId','groupId','gymId','orderedActivityIds','revision','updatedBy','updatedAt'];
const activityIdPattern=/^a_[0-9a-f]{32}$/;
const iso=(value:unknown)=>value&&typeof value==='object'&&'toMillis' in value&&typeof value.toMillis==='function'&&Number.isFinite(value.toMillis())?new Date(value.toMillis()).toISOString():null;
const activityPath=(courseId:string,activityId:string)=>`${coursePath(courseId)}/activities/${activityId}`;
const revisionPath=(courseId:string,activityId:string,revision:number)=>`${activityPath(courseId,activityId)}/revisions/${revision}`;
const assignmentPath=(s:Scope,activityId:string)=>`${groupPath(s)}/groupActivities/${activityId}`;
const placementPath=(s:Scope,gymId:number)=>`${groupPath(s)}/activityPlacements/${gymId}`;
const validIds=(value:unknown,max=50):value is string[]=>Array.isArray(value)&&value.length<=max&&new Set(value).size===value.length&&value.every(id=>identifier(id));
const inSet=(value:unknown):value is number=>typeof value==='number'&&(gymIds as readonly number[]).includes(value);
const validTelemetry=(value:unknown)=>exact(value,['opened','completed','accuracy','errors','elapsedMs','evidence'])&&
  ['opened','completed','accuracy','errors','elapsedMs'].every(key=>value[key]===false)&&value.evidence==='none';

export function definition(d:Data|null,courseId:string,activityId:string):Data {
  if(!d||!exact(d,definitionKeys)||d.schemaVersion!==1||d.courseId!==courseId||d.activityId!==activityId||
    !['wordwall','learningapps'].includes(d.provider)||typeof d.resourceId!=='string'||typeof d.title!=='string'||
    d.title.length<1||d.title.length>120||typeof d.description!=='string'||d.description.length>500||
    typeof d.instructions!=='string'||d.instructions.length>1000||!validIds(d.groupIds,20)||
    !validTelemetry(d.telemetry)||!['draft','published','archived'].includes(d.status)||
    !integer(d.revision,1,2147483646)||!(d.publishedRevision===null||integer(d.publishedRevision,1,d.revision))||
    !identifier(d.createdBy,128)||!Number.isFinite(millis(d.createdAt))||!Number.isFinite(millis(d.updatedAt))||
    !(d.publishedAt===null||Number.isFinite(millis(d.publishedAt))))throw conflict();
  if(!approvedActivityUrl(d.provider as ActivityProvider,d.sourceUrl,'source',d.resourceId)||
    !approvedActivityUrl(d.provider as ActivityProvider,d.embedUrl,'embed',d.resourceId))throw conflict();
  return d;
}
export function revision(d:Data|null,courseId:string,activityId:string,number:number):Data {
  if(!d||!exact(d,revisionKeys)||d.schemaVersion!==1||d.courseId!==courseId||d.activityId!==activityId||d.revision!==number||
    !['wordwall','learningapps'].includes(d.provider)||typeof d.resourceId!=='string'||typeof d.title!=='string'||
    d.title.length<1||d.title.length>120||typeof d.description!=='string'||d.description.length>500||
    typeof d.instructions!=='string'||d.instructions.length>1000||!validIds(d.groupIds,20)||!validTelemetry(d.telemetry)||
    !identifier(d.publishedBy,128)||!Number.isFinite(millis(d.publishedAt))||
    !approvedActivityUrl(d.provider as ActivityProvider,d.sourceUrl,'source',d.resourceId)||
    !approvedActivityUrl(d.provider as ActivityProvider,d.embedUrl,'embed',d.resourceId))throw conflict();
  return d;
}
export function assignment(d:Data|null,s:Scope,activityId:string):Data {
  if(!d||!exact(d,assignmentKeys)||d.schemaVersion!==1||d.courseId!==s.courseId||d.termId!==s.termId||d.groupId!==s.groupId||
    d.activityId!==activityId||!inSet(d.gymId)||!['draft','published','hidden','archived'].includes(d.status)||
    !integer(d.displayOrder,0,100)||!integer(d.revision,1,2147483646)||!integer(d.definitionRevision,0,2147483646)||
    !identifier(d.createdBy,128)||!Number.isFinite(millis(d.updatedAt))||!(d.publishedAt===null||Number.isFinite(millis(d.publishedAt))))throw conflict();
  return d;
}
export function placement(d:Data|null,s:Scope,gymId:number):Data {
  if(!d)return {schemaVersion:1,...s,gymId,orderedActivityIds:[],revision:0,updatedBy:null,updatedAt:null};
  if(!exact(d,placementKeys)||d.schemaVersion!==1||d.courseId!==s.courseId||d.termId!==s.termId||d.groupId!==s.groupId||
    d.gymId!==gymId||!validIds(d.orderedActivityIds,50)||!integer(d.revision,0,2147483646)||
    !(d.updatedBy===null||identifier(d.updatedBy,128))||!(d.updatedAt===null||Number.isFinite(millis(d.updatedAt))))throw conflict();
  return d;
}
async function authorizedGroups(r:Reader,policy:Policy,actor:Actor,input:Input):Promise<Scope[]> {
  const current=scopeOf(input),ids=input.groupIds;
  if(!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>!identifier(id))||!ids.includes(input.groupId!))throw invalid();
  const groups=ids.map(groupId=>({courseId:input.courseId!,termId:input.termId!,groupId}));
  for(const group of groups)await policy.group(r,actor.uid,group,'manageMembers');
  return groups;
}
async function studentGroup(r:Reader,uid:string,s:Scope) {
  await activeContext(r,s);
  const [courseMember,groupMember]=await Promise.all([r.get(`${coursePath(s.courseId)}/members/${uid}`),r.get(`${groupPath(s)}/members/${uid}`)]);
  if(!grant(courseMember,uid,s,false)||!grant(groupMember,uid,s,true))throw denied();
}
const publicView=(d:Data,a:Data)=>({activityId:d.activityId,provider:d.provider,sourceUrl:d.sourceUrl,embedUrl:d.embedUrl,
  title:d.title,description:d.description,instructions:d.instructions,telemetry:d.telemetry,
  gymId:a.gymId,revision:d.revision});

export async function activityWorkspace(r:AcademicReadView,policy:Policy,actor:Actor,input:Input):Promise<Data> {
  const s=scopeOf(input);await policy.group(r,actor.uid,s,'manageMembers');
  const [definitionRows,assignmentRows,placements]=await Promise.all([
    r.page(`${coursePath(s.courseId)}/activities`,50),
    r.page(`${groupPath(s)}/groupActivities`,50),
    Promise.all(gymIds.map((gymId:any)=>r.get(placementPath(s,gymId)))),
  ]);
  const definitions=definitionRows.map(({id,data})=>definition(data,s.courseId,id))
    .filter(d=>Array.isArray(d.groupIds)&&d.groupIds.includes(s.groupId))
    .map(d=>({...d,createdAt:iso(d.createdAt),updatedAt:iso(d.updatedAt),publishedAt:iso(d.publishedAt)}));
  const assignments=assignmentRows.map(({id,data})=>assignment(data,s,id))
    .map(a=>({...a,updatedAt:iso(a.updatedAt),publishedAt:iso(a.publishedAt)}));
  return {definitions,assignments,placements:gymIds.map((gymId:any)=>{const p=placement(placements[gymId-1]??null,s,gymId);
    return {...p,updatedAt:iso(p.updatedAt)};})};
}
export async function publishedGroupActivities(r:AcademicReadView,actor:Actor,input:Input):Promise<Data> {
  const s=scopeOf(input);await studentGroup(r,actor.uid,s);
  const gyms=[];
  for(const gymId of gymIds){
    const p=placement(await r.get(placementPath(s,gymId)),s,gymId),activities=[];
    for(const activityId of p.orderedActivityIds){
      const a=assignment(await r.get(assignmentPath(s,activityId)),s,activityId);
      if(a.status!=='published'||a.gymId!==gymId)continue;
      const rev=revision(await r.get(revisionPath(s.courseId,activityId,a.definitionRevision)),s.courseId,activityId,a.definitionRevision);
      activities.push(publicView(rev,a));
    }
    gyms.push({gymId,activities});
  }
  return {gyms};
}
export async function publishedActivity(r:AcademicReadView,actor:Actor,input:Input):Promise<Data> {
  const s=scopeOf(input);await studentGroup(r,actor.uid,s);
  const a=assignment(await r.get(assignmentPath(s,input.activityId!)),s,input.activityId!);
  if(a.status!=='published')throw new ApiError(404,'NOT_FOUND','La actividad no está publicada.');
  const rev=revision(await r.get(revisionPath(s.courseId,a.activityId,a.definitionRevision)),s.courseId,a.activityId,a.definitionRevision);
  return publicView(rev,a);
}

export async function saveActivityDraft(r:Reader,policy:Policy,actor:Actor,input:Input,commandId:string,time:()=>unknown):Promise<Plan> {
  const groups=await authorizedGroups(r,policy,actor,input),now=time();
  const id=input.activityId??`a_${hash(commandId).slice(0,32)}`;
  const existing=input.activityId?definition(await r.get(activityPath(input.courseId!,id)),input.courseId!,id):null;
  if(input.activityId&&!existing)throw conflict();
  if(existing&&!existing.groupIds.includes(input.groupId!))throw denied();
  if(existing&&input.expectedVersion!==existing.revision)throw conflict();
  const urls={sourceUrl:approvedActivityUrl(input.provider as ActivityProvider,input.sourceUrl!,'source',input.resourceId!),
    embedUrl:approvedActivityUrl(input.provider as ActivityProvider,input.embedUrl!,'embed',input.resourceId!)};
  if(!urls.sourceUrl||!urls.embedUrl)throw invalid();
  const revisionNumber=(existing?.revision??0)+1;
  const data={schemaVersion:1,courseId:input.courseId!,activityId:id,provider:input.provider,resourceId:input.resourceId,
    ...urls,title:input.title,description:input.description,instructions:input.instructions,groupIds:groups.map(group=>group.groupId),
    telemetry:providerTelemetry(),status:'draft',revision:revisionNumber,
    publishedRevision:existing?.publishedRevision??null,createdBy:existing?.createdBy??actor.uid,
    createdAt:existing?.createdAt??now,updatedAt:now,publishedAt:existing?.publishedAt??null};
  const writes:Plan['writes']=[{path:activityPath(input.courseId!,id),data}];
  for(const group of groups){
    const old=await r.get(assignmentPath(group,id));
    if(!old){
      writes.push({path:assignmentPath(group,id),data:{schemaVersion:1,...group,activityId:id,gymId:input.gymId,status:'draft',displayOrder:0,
        revision:1,definitionRevision:0,createdBy:actor.uid,updatedAt:now,publishedAt:null}});
    }else{
      const current=assignment(old,group,id);
      if(current.status==='draft')writes.push({path:assignmentPath(group,id),data:{...current,gymId:input.gymId,revision:current.revision+1,updatedAt:now}});
    }
  }
  return plan({outcome:'activity-draft-saved',activityId:id,revision:revisionNumber,status:'draft',count:groups.length},writes);
}
export async function publishActivities(r:Reader,policy:Policy,actor:Actor,input:Input,time:()=>unknown):Promise<Plan> {
  const groups=await authorizedGroups(r,policy,actor,input),now=time(),id=input.activityId!;
  const d=definition(await r.get(activityPath(input.courseId!,id)),input.courseId!,id);
  if(input.expectedVersion!==d.revision||!Array.isArray(input.groupIds)||input.groupIds.some(group=>!d.groupIds.includes(group)))throw conflict();
  const content={schemaVersion:1,courseId:d.courseId,activityId:d.activityId,provider:d.provider,resourceId:d.resourceId,
    sourceUrl:d.sourceUrl,embedUrl:d.embedUrl,title:d.title,description:d.description,instructions:d.instructions,
    groupIds:d.groupIds,telemetry:d.telemetry,revision:d.revision,publishedBy:actor.uid,publishedAt:now};
  const oldRevision=await r.get(revisionPath(d.courseId,id,d.revision));
  if(oldRevision){
    const previous=revision(oldRevision,d.courseId,id,d.revision);
    const {publishedBy:_publishedBy,publishedAt:_publishedAt,...comparable}=previous;
    const {publishedBy:_expectedBy,publishedAt:_expectedAt,...expected}=content;
    if(JSON.stringify(comparable)!==JSON.stringify(expected))throw conflict();
  }
  const writes:Plan['writes']=[];
  if(!oldRevision)writes.push({path:revisionPath(d.courseId,id,d.revision),data:content});
  for(const group of groups){
    const a=assignment(await r.get(assignmentPath(group,id)),group,id);
    if(a.status==='archived')throw conflict();
    const p=placement(await r.get(placementPath(group,a.gymId)),group,a.gymId);
    const ordered=p.orderedActivityIds.includes(id)?p.orderedActivityIds:[...p.orderedActivityIds,id];
    if(ordered.length>50)throw conflict();
    writes.push({path:assignmentPath(group,id),data:{...a,status:'published',definitionRevision:d.revision,revision:a.revision+1,publishedAt:now,updatedAt:now}});
    if(ordered.join('|')!==p.orderedActivityIds.join('|'))writes.push({path:placementPath(group,a.gymId),data:{...p,orderedActivityIds:ordered,revision:p.revision+1,updatedBy:actor.uid,updatedAt:now}});
  }
  writes.push({path:activityPath(d.courseId,id),data:{...d,status:'published',publishedRevision:d.revision,publishedAt:now,updatedAt:now}});
  return plan({outcome:'activities-published',activityId:id,revision:d.revision,status:'published',count:groups.length},writes);
}
export async function reorderActivities(r:AcademicReadView,policy:Policy,actor:Actor,input:Input,time:()=>unknown):Promise<Plan> {
  const s=scopeOf(input);await policy.group(r,actor.uid,s,'manageMembers');
  const p=placement(await r.get(placementPath(s,input.gymId!)),s,input.gymId!);
  if(input.expectedVersion!==p.revision||!validIds(input.orderedActivityIds,50))throw conflict();
  const rows=await r.page(`${groupPath(s)}/groupActivities`,50);
  const assignments=new Map(rows.map(({id,data})=>[id,assignment(data,s,id)]));
  const published=[...assignments.values()].filter(a=>a.status==='published'&&a.gymId===input.gymId).map(a=>a.activityId);
  if(new Set(published).size!==(input.orderedActivityIds?.length??0)||published.some(id=>!input.orderedActivityIds!.includes(id)))throw conflict();
  const now=time(),writes:Plan['writes']=[{path:placementPath(s,input.gymId!),data:{...p,orderedActivityIds:input.orderedActivityIds,revision:p.revision+1,updatedBy:actor.uid,updatedAt:now}}];
  input.orderedActivityIds!.forEach((id:string,index:number)=>{const a=assignments.get(id)!;writes.push({path:assignmentPath(s,id),data:{...a,displayOrder:index,revision:a.revision+1,updatedAt:now}});});
  return plan({outcome:'activities-reordered',placementRevision:p.revision+1,count:input.orderedActivityIds!.length},writes);
}
export async function moveActivity(r:Reader,policy:Policy,actor:Actor,input:Input,time:()=>unknown):Promise<Plan> {
  const s=scopeOf(input);await policy.group(r,actor.uid,s,'manageMembers');
  const a=assignment(await r.get(assignmentPath(s,input.activityId!)),s,input.activityId!);
  if(input.expectedVersion!==a.revision||!inSet(input.gymId))throw conflict();
  if(a.gymId===input.gymId)return plan({outcome:'already-moved',activityId:a.activityId,gymId:a.gymId,revision:a.revision});
  const now=time(),writes:Plan['writes']=[{path:assignmentPath(s,a.activityId),data:{...a,gymId:input.gymId,revision:a.revision+1,updatedAt:now}}];
  if(a.status==='published'){
    const source=placement(await r.get(placementPath(s,a.gymId)),s,a.gymId);
    const target=placement(await r.get(placementPath(s,input.gymId!)),s,input.gymId!);
    const sourceIds=source.orderedActivityIds.filter((id:string)=>id!==a.activityId),targetIds=target.orderedActivityIds.includes(a.activityId)?target.orderedActivityIds:[...target.orderedActivityIds,a.activityId];
    if(targetIds.length>50)throw conflict();
    if(sourceIds.join('|')!==source.orderedActivityIds.join('|'))writes.push({path:placementPath(s,a.gymId),data:{...source,orderedActivityIds:sourceIds,revision:source.revision+1,updatedBy:actor.uid,updatedAt:now}});
    if(targetIds.join('|')!==target.orderedActivityIds.join('|'))writes.push({path:placementPath(s,input.gymId!),data:{...target,orderedActivityIds:targetIds,revision:target.revision+1,updatedBy:actor.uid,updatedAt:now}});
  }
  return plan({outcome:'activity-moved',activityId:a.activityId,gymId:input.gymId,revision:a.revision+1},writes);
}
export async function setActivityStatus(r:Reader,policy:Policy,actor:Actor,input:Input,time:()=>unknown):Promise<Plan> {
  const s=scopeOf(input);await policy.group(r,actor.uid,s,'manageMembers');
  if(!['hidden','archived'].includes(input.status!))throw invalid();
  const a=assignment(await r.get(assignmentPath(s,input.activityId!)),s,input.activityId!);
  if(input.expectedVersion!==a.revision)throw conflict();
  const now=time(),writes:Plan['writes']=[{path:assignmentPath(s,a.activityId),data:{...a,status:input.status,revision:a.revision+1,updatedAt:now}}];
  if(a.status==='published'){
    const p=placement(await r.get(placementPath(s,a.gymId)),s,a.gymId);
    if(p.orderedActivityIds.includes(a.activityId))writes.push({path:placementPath(s,a.gymId),data:{...p,orderedActivityIds:p.orderedActivityIds.filter((id:string)=>id!==a.activityId),revision:p.revision+1,updatedBy:actor.uid,updatedAt:now}});
  }
  return plan({outcome:'activity-status-changed',activityId:a.activityId,status:input.status,revision:a.revision+1},writes);
}
