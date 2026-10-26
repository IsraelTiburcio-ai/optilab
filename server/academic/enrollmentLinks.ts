import {randomBytes,timingSafeEqual} from 'node:crypto';
import type {Actor,Data,Input,Scope} from './contracts';
import {activeContext,type Reader} from './authorization';
import {groupPath,hash} from './repository';
import {context,millis} from './models';
import {exact,integer,identifier} from './validation';
import {ApiError,conflict,unavailableInvite} from './errors';
import {plan,type Plan} from './plans';
import type {Clock} from './invitations';
import {membershipState,admissionWrites} from './memberships';
import {profileDocument,type AuthIdentity} from './profiles';
import {playerDocument,reservation,tagPath} from './playerModel';
export const enrollmentLinkPath=(s:Scope)=>`${groupPath(s)}/enrollmentLink/current`;
function linkDocument(raw:Data|null,s:Scope):Data|null {
  if(!raw)return null;
  if(!exact(raw,['schemaVersion','courseId','termId','groupId','inviteId','tokenHash','revision','status','createdAt','expiresAt','createdBy','acceptedCount','windowStartedAt','windowCount'])||raw.schemaVersion!==2||
    raw.courseId!==s.courseId||raw.termId!==s.termId||raw.groupId!==s.groupId||!identifier(raw.inviteId)||typeof raw.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(raw.tokenHash)||
    !integer(raw.revision,1,2147483646)||!['active','revoked'].includes(raw.status)||!identifier(raw.createdBy,128)||!Number.isFinite(millis(raw.createdAt))||!Number.isFinite(millis(raw.expiresAt))||millis(raw.expiresAt)<=millis(raw.createdAt)||
    !integer(raw.acceptedCount,0,Number.MAX_SAFE_INTEGER)||!integer(raw.windowStartedAt,0,Number.MAX_SAFE_INTEGER)||!integer(raw.windowCount,0,30))throw conflict();
  return raw;
}
export async function currentEnrollmentLink(r:Reader,s:Scope):Promise<Data>{
  const d=linkDocument(await r.get(enrollmentLinkPath(s)),s);
  return {link:d?{revision:d.revision,status:d.status==='revoked'?'revoked':millis(d.expiresAt)<=Date.now()?'expired':'active',expiresAt:d.expiresAt.toDate().toISOString()}:null};
}
export async function rotateEnrollmentLink(r:Reader,s:Scope,actor:Actor,i:Input,clock:Clock):Promise<Plan>{
  const old=linkDocument(await r.get(enrollmentLinkPath(s)),s);if((old?.revision??0)!==i.expectedVersion)throw conflict();
  const secret=randomBytes(32).toString('base64url'),inviteId=crypto.randomUUID(),now=clock.now(),version=(old?.revision??0)+1;
  const data={...context(s),inviteId,tokenHash:hash(secret),revision:version,status:'active',createdAt:clock.timestamp(now),expiresAt:clock.timestamp(now+i.expiresInSeconds!*1000),
    createdBy:actor.uid,acceptedCount:0,windowStartedAt:now,windowCount:0};
  return plan({outcome:'enrollment-link-created',inviteId,version,tokenAvailable:true},[{path:enrollmentLinkPath(s),data}],
    [{scope:s,action:old?'enrollment-link-rotated':'enrollment-link-created',subjectUid:null,version}],secret);
}
export async function revokeEnrollmentLink(r:Reader,s:Scope,i:Input):Promise<Plan>{
  const d=linkDocument(await r.get(enrollmentLinkPath(s)),s);if(!d||d.revision!==i.expectedVersion)throw conflict();
  if(d.status==='revoked')return plan({outcome:'already-revoked',version:d.revision});
  return plan({outcome:'enrollment-link-revoked',version:d.revision+1},[{path:enrollmentLinkPath(s),data:{...d,status:'revoked',revision:d.revision+1}}],
    [{scope:s,action:'enrollment-link-revoked',subjectUid:null,version:d.revision+1}]);
}
export async function validateRedemption(r:Reader,s:Scope,i:Input,clock:Clock):Promise<Data>{
  await activeContext(r,s);
  const d=linkDocument(await r.get(enrollmentLinkPath(s)),s);
  if(!d||d.inviteId!==i.inviteId||d.status!=='active'||millis(d.expiresAt)<=clock.now()||!timingSafeEqual(Buffer.from(d.tokenHash,'hex'),Buffer.from(hash(i.token!),'hex')))throw unavailableInvite();
  const state=await membershipState(r,s,i.uid!);
  if(state.m&&!state.active&&(!Number.isFinite(millis(state.detail.lastRevokedAt))||millis(d.createdAt)<=millis(state.detail.lastRevokedAt)))throw unavailableInvite();
  return d;
}
export async function redeemInvitation(r:Reader,s:Scope,actor:Actor,i:Input,auth:AuthIdentity,clock:Clock,commandId:string):Promise<Plan>{
  const d=await validateRedemption(r,s,{...i,uid:actor.uid},clock),state=await membershipState(r,s,actor.uid);
  const p=profileDocument(await r.get(`academicProfiles/${actor.uid}`),actor.uid),player=playerDocument(await r.get(`playerIdentities/${actor.uid}`),actor.uid);
  if(!p||!player)throw new ApiError(409,'ONBOARDING_REQUIRED','Completa tu bienvenida antes de inscribirte.');
  const reserved=reservation(await r.get(tagPath(player.normalizedGamertag)),player.normalizedGamertag);
  if(!reserved||reserved.uid!==actor.uid||reserved.status!=='reserved')throw conflict();
  if(state.active)return plan({outcome:'already-member',uid:actor.uid,version:state.detail.revision});
  const now=clock.now(),reset=now-d.windowStartedAt>=10000,windowStartedAt=reset?now:d.windowStartedAt,windowCount=reset?0:d.windowCount;
  // A short rolling fairness window, NOT a lifetime admissions/class-size cap.
  if(windowCount>=30)throw new ApiError(429,'RATE_LIMIT','Espera unos segundos antes de volver a intentarlo.');
  const writes=admissionWrites(state,s,actor.uid,actor.label,d.inviteId,clock,commandId);
  writes.push({path:enrollmentLinkPath(s),data:{...d,acceptedCount:d.acceptedCount+1,windowStartedAt,windowCount:windowCount+1}});
  if(p.email!==auth.email||p.emailVerified!==auth.emailVerified)writes.push({path:`academicProfiles/${actor.uid}`,data:{...p,...auth,revision:p.revision+1,updatedAt:clock.time()}});
  return plan({outcome:'membership-active',uid:actor.uid,version:state.detail.revision+1},writes,
    [{scope:s,action:'membership-redeemed',subjectUid:actor.uid,version:state.detail.revision+1}]);
}
