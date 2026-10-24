import type {Actor,Data,Input,Scope} from './contracts';
import type {Reader} from './authorization';
import {grant} from './authorization';
import {coursePath,groupPath} from './repository';
import {exact,integer,parseInput} from './validation';
import {millis,invitation,details} from './models';
import {conflict} from './errors';
import {plan,type Plan} from './plans';
export interface AuthIdentity {email:string|null;emailVerified:boolean}
export function profileDocument(raw:Data|null,uid:string):Data|null {
  if(!raw)return null;
  if(!exact(raw,['schemaVersion','uid','revision','fullName','email','emailVerified','shareGameIdentity','nickname','avatarId','companionId','updatedAt'])||raw.schemaVersion!==2||raw.uid!==uid||
    !integer(raw.revision,1,2147483646)||!(raw.email===null||(typeof raw.email==='string'&&raw.email.length<=254&&/^[^\s@]+@[^\s@]+$/.test(raw.email)))||typeof raw.emailVerified!=='boolean'||!Number.isFinite(millis(raw.updatedAt)))throw conflict();
  try{parseInput('updateAcademicProfile',{idempotencyKey:'validation-only-key',expectedVersion:raw.revision,fullName:raw.fullName,shareGameIdentity:raw.shareGameIdentity,nickname:raw.nickname,avatarId:raw.avatarId,companionId:raw.companionId},604800);}catch{throw conflict();}
  return raw;
}
export function publicProfile(raw:Data|null):Data|null {
  if(!raw)return null;
  return {revision:raw.revision,fullName:raw.fullName,nameSource:'self-declared',email:raw.email,emailVerified:raw.emailVerified,
    shareGameIdentity:raw.shareGameIdentity,gameIdentity:raw.shareGameIdentity?{nickname:raw.nickname,avatarId:raw.avatarId,companionId:raw.companionId}:null,updatedAt:raw.updatedAt.toDate().toISOString()};
}
export async function ownProfile(r:Reader,uid:string):Promise<Data> {
  const p=profileDocument(await r.get(`academicProfiles/${uid}`),uid);return {profile:publicProfile(p),revision:p?.revision??0};
}
export async function updateProfile(r:Reader,actor:Actor,input:Input,identity:AuthIdentity,time:()=>unknown):Promise<Plan> {
  if(identity.email!==null&&(identity.email.length>254||!/^[^\s@]+@[^\s@]+$/.test(identity.email)))throw conflict();
  const old=profileDocument(await r.get(`academicProfiles/${actor.uid}`),actor.uid),revision=old?.revision??0;
  if(revision!==input.expectedVersion)throw conflict();
  const data={schemaVersion:2,uid:actor.uid,revision:revision+1,fullName:input.fullName!,...identity,shareGameIdentity:input.shareGameIdentity!,
    nickname:input.nickname!,avatarId:input.avatarId!,companionId:input.companionId!,updatedAt:time()};
  return plan({outcome:'academic-profile-updated',uid:actor.uid,version:revision+1},[{path:`academicProfiles/${actor.uid}`,data}]);
}
/** Caller has already authorized this exact group in the same read snapshot.
 * No fresh identity for former members/rejected requests; never read progress. */
export async function teacherProfile(r:Reader,s:Scope,uid:string,pending?:Data):Promise<Data|null> {
  const [member,courseMember]=await Promise.all([r.get(`${groupPath(s)}/members/${uid}`),r.get(`${coursePath(s.courseId)}/members/${uid}`)]);
  const active=grant(member,uid,s,true)&&grant(courseMember,uid,s,false);
  if(!active){
    if(!pending||pending.status!=='pending'||(courseMember&&!grant(courseMember,uid,s,false)))return null;
    try{
      const inv=invitation(await r.get(`${groupPath(s)}/invitations/${pending.inviteId}`),s,pending.inviteId);
      if(inv.status!=='active'||millis(inv.expiresAt)<=Date.now()||inv.acceptedCount>=inv.maxUses)return null;
      if(member){
        if(!grant(member,uid,s,true,'revoked'))return null;
        const previous=details(await r.get(`${groupPath(s)}/membershipDetails/${uid}`),s,uid);
        if(!Number.isFinite(millis(previous.lastRevokedAt))||millis(inv.createdAt)<=millis(previous.lastRevokedAt)||millis(pending.createdAt)<=millis(previous.lastRevokedAt))return null;
      }
    }catch{return null;}
  }
  return publicProfile(profileDocument(await r.get(`academicProfiles/${uid}`),uid));
}
