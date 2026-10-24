import type {Actor,Input,Scope,Data} from './contracts';
import {grant,type Reader} from './authorization';
import {context,details,invitation,request,membershipIndex,multipleGroups,millis,roster as rosterData} from './models';
import {coursePath,groupPath,scopeKey} from './repository';
import {conflict,denied} from './errors';
import {plan,type Plan} from './plans';
import {liveInvite,type Clock} from './invitations';
const memberGrant=(s:Scope,uid:string,status:string)=>({schemaVersion:1,...s,uid,status});
const pointer=(s:Scope,uid:string,status:string)=>({...context(s),uid,status});
async function membershipState(r:Reader,s:Scope,uid:string) {
  const root=groupPath(s),c=coursePath(s.courseId);
  const [m,d,i,cm,settings]=await Promise.all([r.get(`${root}/members/${uid}`),r.get(`${root}/membershipDetails/${uid}`),
    r.get(`${c}/academicMemberships/${uid}`),r.get(`${c}/members/${uid}`),r.get(`${c}/academicSettings/current`)]);
  if(m&&!grant(m,uid,s,true)&&!grant(m,uid,s,true,'revoked'))throw conflict();
  if(cm&&!grant(cm,uid,s,false))throw denied(); // A group teacher cannot undo a course suspension.
  const detail=details(d,s,uid),index=membershipIndex(i,s.courseId,uid),multi=multipleGroups(settings,s.courseId);
  const active=grant(m,uid,s,true),indexed=!!index.activeScopes[scopeKey(s)];
  if(active!==indexed||(m&&!d))throw conflict();
  return {m,detail,index,cm,multi,active};
}
export async function decideMembership(r:Reader,s:Scope,actor:Actor,input:Input,clock:Clock,approve:boolean,commandId:string):Promise<Plan> {
  const root=groupPath(s),req=request(await r.get(`${root}/membershipRequests/${input.requestId}`),s,input.requestId!);
  if(req.revision!==input.expectedVersion||req.status!=='pending')throw conflict();
  const inv=invitation(await r.get(`${root}/invitations/${req.inviteId}`),s,req.inviteId);
  if(inv.pendingCount<1)throw conflict();
  if(approve)liveInvite(inv,clock);
  const state=await membershipState(r,s,req.uid);
  if(approve&&state.m&&!state.active&&(!Number.isFinite(millis(state.detail.lastRevokedAt))||millis(inv.createdAt)<=millis(state.detail.lastRevokedAt)))throw conflict();
  if(approve&&!state.active&&!state.multi&&Object.values(state.index.activeScopes).some((v:any)=>v.termId===s.termId))throw conflict();
  const writes:Plan['writes']=[{path:`${root}/membershipRequests/${req.requestId}`,data:{...req,status:approve?'approved':'rejected',revision:req.revision+1,decidedAt:clock.time(),decidedBy:actor.uid}},
    {path:`${root}/invitations/${inv.inviteId}`,data:{...inv,revision:inv.revision+1,pendingCount:inv.pendingCount-1,acceptedCount:inv.acceptedCount+(approve&&!state.active?1:0)}}];
  let version=state.detail.revision;
  if(approve&&!state.active) {
    if(Object.keys(state.index.activeScopes).length>=100)throw conflict();version++;
    writes.push({path:`${root}/members/${req.uid}`,data:memberGrant(s,req.uid,'active')},
      {path:`${root}/membershipDetails/${req.uid}`,data:{...state.detail,revision:version,lastAdmissionId:commandId,lastInvitationId:inv.inviteId,updatedAt:clock.time()}},
      {path:`${coursePath(s.courseId)}/academicMemberships/${req.uid}`,data:{...state.index,activeScopes:{...state.index.activeScopes,[scopeKey(s)]:{termId:s.termId,groupId:s.groupId}}}},
      {path:`users/${req.uid}/enrollments/${scopeKey(s)}`,data:pointer(s,req.uid,'active')},
      {path:`${root}/roster/${req.uid}`,data:{...context(s),uid:req.uid,label:req.label,labelSource:'self-chosen',status:'active'}});
    if(!state.cm)writes.push({path:`${coursePath(s.courseId)}/members/${req.uid}`,data:{schemaVersion:1,uid:req.uid,courseId:s.courseId,status:'active'}});
  }
  return plan({outcome:approve?'membership-approved':'membership-rejected',requestId:req.requestId,uid:req.uid,version},writes,
    [{scope:s,action:approve?'membership-approved':'membership-rejected',subjectUid:req.uid,version}]);
}
export async function revokeMembership(r:Reader,s:Scope,input:Input,clock:Clock):Promise<Plan> {
  const uid=input.uid!,root=groupPath(s),state=await membershipState(r,s,uid);
  if(state.detail.revision!==input.expectedVersion||!state.m)throw conflict();
  if(!state.active)return plan({outcome:'already-revoked',uid,version:state.detail.revision});
  const scopes={...state.index.activeScopes};delete scopes[scopeKey(s)];const version=state.detail.revision+1;
  const roster=rosterData(await r.get(`${root}/roster/${uid}`),s,uid);
  if(roster.status!=='active')throw conflict();
  return plan({outcome:'membership-revoked',uid,version},[
    {path:`${root}/members/${uid}`,data:memberGrant(s,uid,'revoked')},
    {path:`${root}/membershipDetails/${uid}`,data:{...state.detail,revision:version,lastRevokedAt:clock.timestamp(clock.now()),updatedAt:clock.time()}},
    {path:`${coursePath(s.courseId)}/academicMemberships/${uid}`,data:{...state.index,activeScopes:scopes}},
    {path:`users/${uid}/enrollments/${scopeKey(s)}`,data:pointer(s,uid,'revoked')},
    {path:`${root}/roster/${uid}`,data:{...roster,status:'revoked'}},
  ],[{scope:s,action:'membership-revoked',subjectUid:uid,version}]);
}
export async function transferMembership(r:Reader,source:Scope,input:Input,clock:Clock,commandId:string):Promise<Plan> {
  const destination={...source,groupId:input.destinationGroupId!},uid=input.uid!;
  if(source.groupId===destination.groupId)throw conflict();
  const [from,to]=await Promise.all([membershipState(r,source,uid),membershipState(r,destination,uid)]);
  if(!from.active||from.detail.revision!==input.expectedVersion)throw conflict();
  const revoked=await revokeMembership(r,source,input,clock),scopes={...from.index.activeScopes};delete scopes[scopeKey(source)];
  if(!to.multi&&Object.values(scopes).some((v:any)=>v.termId===source.termId&&v.groupId!==destination.groupId))throw conflict();
  scopes[scopeKey(destination)]={termId:destination.termId,groupId:destination.groupId};
  const roster=await r.get(`${groupPath(source)}/roster/${uid}`);
  const version=to.active?to.detail.revision:to.detail.revision+1;
  // Replace the one course index write from the revocation, not competing partial updates.
  const writes=revoked.writes.filter(w=>w.path!==`${coursePath(source.courseId)}/academicMemberships/${uid}`);
  writes.push({path:`${coursePath(source.courseId)}/academicMemberships/${uid}`,data:{...from.index,activeScopes:scopes}},
    {path:`users/${uid}/enrollments/${scopeKey(destination)}`,data:pointer(destination,uid,'active')});
  if(!to.active)writes.push({path:`${groupPath(destination)}/members/${uid}`,data:memberGrant(destination,uid,'active')},
    {path:`${groupPath(destination)}/membershipDetails/${uid}`,data:{...to.detail,revision:version,lastAdmissionId:commandId,updatedAt:clock.time()}},
    {path:`${groupPath(destination)}/roster/${uid}`,data:{...context(destination),uid,label:roster!.label,labelSource:'self-chosen',status:'active'}});
  return plan({outcome:'membership-transferred',uid,sourceVersion:from.detail.revision+1,destinationVersion:version},writes,
    [{scope:source,action:'transfer-out',subjectUid:uid,version:from.detail.revision+1},{scope:destination,action:'transfer-in',subjectUid:uid,version}]);
}
