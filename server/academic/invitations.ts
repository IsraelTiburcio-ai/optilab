import {randomBytes,timingSafeEqual} from 'node:crypto';
import type {Actor,Input,Scope} from './contracts';
import type {Reader} from './authorization';
import {activeContext,grant} from './authorization';
import {context,details,invitation,request,millis} from './models';
import {conflict,unavailableInvite} from './errors';
import {coursePath,groupPath,hash} from './repository';
import {plan,type Plan} from './plans';
export interface Clock {now:()=>number;time:()=>unknown;timestamp:(n:number)=>unknown}
export function liveInvite(d:Record<string,any>,clock:Clock) {
  if(d.status!=='active'||millis(d.expiresAt)<=clock.now()||d.acceptedCount>=d.maxUses)throw unavailableInvite();
}
export async function createInvitation(r:Reader,s:Scope,actor:Actor,input:Input,clock:Clock,reissue=false):Promise<Plan> {
  const writes:Plan['writes']=[];
  if(reissue) {
    const old=invitation(await r.get(`${groupPath(s)}/invitations/${input.inviteId}`),s,input.inviteId!);
    if(old.revision!==input.expectedVersion)throw conflict();
    writes.push({path:`${groupPath(s)}/invitations/${old.inviteId}`,data:{...old,status:'revoked',revision:old.revision+1}});
  }
  const inviteId=crypto.randomUUID(),secret=randomBytes(32).toString('base64url'),created=clock.now();
  writes.push({path:`${groupPath(s)}/invitations/${inviteId}`,data:{...context(s),inviteId,tokenHash:hash(secret),status:'active',revision:1,
    createdAt:clock.timestamp(created),expiresAt:clock.timestamp(created+input.expiresInSeconds!*1000),maxUses:input.maxUses!,
    acceptedCount:0,pendingCount:0,maxPending:input.maxPending!,createdBy:actor.uid}});
  return plan({outcome:'invitation-created',inviteId,version:1,tokenAvailable:true},writes,[{scope:s,action:reissue?'invitation-reissued':'invitation-created',subjectUid:null,version:1}],secret);
}
export async function revokeInvitation(r:Reader,s:Scope,input:Input):Promise<Plan> {
  const path=`${groupPath(s)}/invitations/${input.inviteId}`,d=invitation(await r.get(path),s,input.inviteId!);
  if(d.revision!==input.expectedVersion)throw conflict();
  if(d.status==='revoked')return plan({outcome:'already-revoked',inviteId:d.inviteId,version:d.revision});
  return plan({outcome:'invitation-revoked',inviteId:d.inviteId,version:d.revision+1},[{path,data:{...d,status:'revoked',revision:d.revision+1}}],
    [{scope:s,action:'invitation-revoked',subjectUid:null,version:d.revision+1}]);
}
export async function requestMembership(r:Reader,s:Scope,actor:Actor,input:Input,clock:Clock):Promise<Plan> {
  const root=groupPath(s),d=invitation(await r.get(`${root}/invitations/${input.inviteId}`),s,input.inviteId!);
  if(!timingSafeEqual(Buffer.from(d.tokenHash,'hex'),Buffer.from(hash(input.token!),'hex')))throw unavailableInvite();
  liveInvite(d,clock);try{await activeContext(r,s);}catch{throw unavailableInvite();}
  const requestId=hash(`${input.inviteId}:${actor.uid}`),path=`${root}/membershipRequests/${requestId}`;
  const [existing,member,detail,courseMember]=await Promise.all([r.get(path),r.get(`${root}/members/${actor.uid}`),r.get(`${root}/membershipDetails/${actor.uid}`),r.get(`${coursePath(s.courseId)}/members/${actor.uid}`)]);
  if(courseMember&&!grant(courseMember,actor.uid,s,false))throw unavailableInvite();
  if(grant(member,actor.uid,s,true))return plan({outcome:'already-member'});
  if(member&&!grant(member,actor.uid,s,true,'revoked'))throw unavailableInvite();
  if(member) {
    const history=details(detail,s,actor.uid);
    if(!Number.isFinite(millis(history.lastRevokedAt))||millis(d.createdAt)<=millis(history.lastRevokedAt))throw unavailableInvite();
  }
  if(existing) {const req=request(existing,s,requestId);return plan({outcome:'request-exists',requestId:req.requestId});}
  if(d.pendingCount>=d.maxPending)throw unavailableInvite();
  const data={...context(s),requestId,inviteId:d.inviteId,uid:actor.uid,label:actor.label,status:'pending',revision:1,
    createdAt:clock.time(),decidedAt:null,decidedBy:null};
  return plan({outcome:'request-pending',requestId,version:1},[{path,data},{path:`${root}/invitations/${d.inviteId}`,data:{...d,pendingCount:d.pendingCount+1,revision:d.revision+1}}],
    [{scope:s,action:'membership-requested',subjectUid:actor.uid,version:1}]);
}
