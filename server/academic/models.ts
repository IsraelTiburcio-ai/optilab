import type {Data,Scope} from './contracts';
import {exact,identifier,integer,isRecord} from './validation';
import {conflict,unavailableInvite} from './errors';
import {scopeKey,hash} from './repository';
export const context=(s:Scope)=>({schemaVersion:2,...s});
export function scoped(d:Data|null,s:Scope):d is Data{return !!d&&d.schemaVersion===2&&d.courseId===s.courseId&&d.termId===s.termId&&d.groupId===s.groupId;}
export const millis=(v:unknown):number=>v&&typeof v==='object'&&'toMillis' in v&&typeof v.toMillis==='function'?v.toMillis():NaN;
export function invitation(d:Data|null,s:Scope,id:string):Data {
  if(!scoped(d,s)||!exact(d,['schemaVersion','courseId','termId','groupId','inviteId','tokenHash','status','revision','createdAt','expiresAt','maxUses','acceptedCount','pendingCount','maxPending','createdBy'])||
    d.inviteId!==id||typeof d.tokenHash!=='string'||!/^[0-9a-f]{64}$/.test(d.tokenHash)||!['active','revoked'].includes(d.status)||
    !integer(d.revision,1,2147483646)||!integer(d.maxUses,1,100)||!integer(d.acceptedCount,0,d.maxUses)||!integer(d.maxPending,1,100)||
    !integer(d.pendingCount,0,d.maxPending)||!identifier(d.createdBy,128)||!Number.isFinite(millis(d.createdAt))||!Number.isFinite(millis(d.expiresAt))||millis(d.expiresAt)<=millis(d.createdAt))throw unavailableInvite();
  return d;
}
export function request(d:Data|null,s:Scope,id:string):Data {
  if(!scoped(d,s)||!exact(d,['schemaVersion','courseId','termId','groupId','requestId','inviteId','uid','label','status','revision','createdAt','decidedAt','decidedBy'])||
    d.requestId!==id||!identifier(d.inviteId)||!identifier(d.uid,128)||id!==hash(`${d.inviteId}:${d.uid}`)||typeof d.label!=='string'||d.label.length>80||
    !['pending','approved','rejected'].includes(d.status)||!integer(d.revision,1,2147483646)||!Number.isFinite(millis(d.createdAt))||
    !(d.decidedAt===null||Number.isFinite(millis(d.decidedAt)))||!(d.decidedBy===null||identifier(d.decidedBy,128))||
    (d.status==='pending'?(d.decidedAt!==null||d.decidedBy!==null):(d.decidedAt===null||d.decidedBy===null)))throw conflict();
  return d;
}
export function roster(d:Data|null,s:Scope,uid:string):Data {
  if(!exact(d,['schemaVersion','courseId','termId','groupId','uid','label','labelSource','status'])||!scoped(d,s)||d.uid!==uid||
    typeof d.label!=='string'||d.label.length>80||d.labelSource!=='self-chosen'||!['active','revoked'].includes(d.status))throw conflict();
  return d;
}
export function details(d:Data|null,s:Scope,uid:string):Data {
  if(!d)return {...context(s),uid,revision:0,lastAdmissionId:null,lastInvitationId:null,lastRevokedAt:null,updatedAt:null};
  if(!scoped(d,s)||!exact(d,['schemaVersion','courseId','termId','groupId','uid','revision','lastAdmissionId','lastInvitationId','lastRevokedAt','updatedAt'])||
    d.uid!==uid||!integer(d.revision,1,2147483646)||!(d.lastAdmissionId===null||identifier(d.lastAdmissionId))||
    !(d.lastInvitationId===null||identifier(d.lastInvitationId))||!(d.lastRevokedAt===null||Number.isFinite(millis(d.lastRevokedAt)))||!Number.isFinite(millis(d.updatedAt)))throw conflict();
  return d;
}
export function membershipIndex(d:Data|null,c:string,uid:string):Data {
  if(!d)return {schemaVersion:2,courseId:c,uid,activeScopes:{}};
  if(!exact(d,['schemaVersion','courseId','uid','activeScopes'])||d.schemaVersion!==2||d.courseId!==c||d.uid!==uid||!isRecord(d.activeScopes)||Object.keys(d.activeScopes).length>100)throw conflict();
  for(const [key,value] of Object.entries(d.activeScopes)) {
    if(!exact(value,['termId','groupId'])||!identifier(value.termId)||!identifier(value.groupId)||scopeKey({courseId:c,...value as {termId:string;groupId:string}})!==key)throw conflict();
  }
  return d;
}
export function multipleGroups(d:Data|null,courseId:string):boolean {
  if(!exact(d,['schemaVersion','courseId','allowMultipleGroupsPerTerm'])||d.schemaVersion!==2||d.courseId!==courseId||typeof d.allowMultipleGroupsPerTerm!=='boolean')throw conflict();
  return d.allowMultipleGroupsPerTerm;
}
export const publicInvite=(d:Data)=>({inviteId:d.inviteId,status:d.status,revision:d.revision,expiresAt:d.expiresAt.toDate().toISOString(),
  maxUses:d.maxUses,acceptedCount:d.acceptedCount,pendingCount:d.pendingCount,maxPending:d.maxPending});
export const publicRequest=(d:Data)=>({requestId:d.requestId,inviteId:d.inviteId,uid:d.uid,label:d.label,status:d.status,revision:d.revision,
  createdAt:d.createdAt.toDate().toISOString()});
