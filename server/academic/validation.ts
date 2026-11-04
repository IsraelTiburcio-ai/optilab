import {invalid,ApiError} from './errors';
import type {Data,Input,Operation,Scope} from './contracts';
import {normalizeGamertag} from './playerModel';
const shapes:Record<Operation,string[]>={
  myScopes:['kind','limit','cursor','courseId'],roster:['courseId','termId','groupId','limit','cursor'],
  requestStatus:['courseId','termId','groupId','requestId','inviteId'],groupInvitations:['courseId','termId','groupId','limit','cursor'],groupProgress:['courseId','termId','groupId','periodDays'],
  activityWorkspace:['courseId','termId','groupId'],publishedGroupActivities:['courseId','termId','groupId'],publishedActivity:['courseId','termId','groupId','activityId'],
  saveActivityDraft:['courseId','termId','groupId','groupIds','activityId','expectedVersion','idempotencyKey','provider','resourceId','sourceUrl','embedUrl','title','description','instructions','gymId'],
  publishActivities:['courseId','termId','groupId','groupIds','activityId','expectedVersion','idempotencyKey'],
  reorderActivities:['courseId','termId','groupId','gymId','orderedActivityIds','expectedVersion','idempotencyKey'],
  moveActivity:['courseId','termId','groupId','activityId','gymId','expectedVersion','idempotencyKey'],
  setActivityStatus:['courseId','termId','groupId','activityId','status','expectedVersion','idempotencyKey'],
  membershipEvents:['courseId','termId','groupId','limit','cursor'],groupRequests:['courseId','termId','groupId','limit','cursor','status'],
  createInvitation:['courseId','termId','groupId','idempotencyKey','expiresInSeconds','maxUses','maxPending'],
  reissueInvitation:['courseId','termId','groupId','inviteId','expectedVersion','idempotencyKey','expiresInSeconds','maxUses','maxPending'],
  revokeInvitation:['courseId','termId','groupId','inviteId','expectedVersion','idempotencyKey'],
  requestMembership:['courseId','termId','groupId','inviteId','token','idempotencyKey'],
  approveMembership:['courseId','termId','groupId','requestId','expectedVersion','idempotencyKey'],
  rejectMembership:['courseId','termId','groupId','requestId','expectedVersion','idempotencyKey'],
  revokeMembership:['courseId','termId','groupId','uid','expectedVersion','idempotencyKey'],
  transferMembership:['courseId','termId','groupId','destinationGroupId','uid','expectedVersion','idempotencyKey'],
  createTerm:['courseId','title','idempotencyKey'],createGroup:['courseId','termId','title','idempotencyKey'],
  getAcademicProfile:[],updateAcademicProfile:['idempotencyKey','expectedVersion','fullName','shareGameIdentity','nickname','avatarId','companionId'],
  getPlayerIdentity:[],gamertagAvailability:['gamertag'],
  savePlayerIdentity:['idempotencyKey','expectedVersion','expectedProfileVersion','fullName','gamertag','avatarId','companionId','shareGameIdentity'],
  groupEnrollmentLink:['courseId','termId','groupId'],
  rotateEnrollmentLink:['courseId','termId','groupId','idempotencyKey','expectedVersion','expiresInSeconds'],
  revokeEnrollmentLink:['courseId','termId','groupId','idempotencyKey','expectedVersion'],
  redeemInvitation:['courseId','termId','groupId','inviteId','token','idempotencyKey'],
};
export function isRecord(v:unknown):v is Data{return !!v&&typeof v==='object'&&!Array.isArray(v);}
export function exact(v:unknown,keys:string[]):v is Data{return isRecord(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
export function identifier(value:unknown,max=80):value is string{return typeof value==='string'&&new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value);}
export function integer(v:unknown,min:number,max:number):v is number{return Number.isInteger(v)&&(v as number)>=min&&(v as number)<=max;}
export function parseInput(name:string,value:unknown,maxTtl:number):{operation:Operation;input:Input} {
  if(!Object.hasOwn(shapes,name))throw new ApiError(404,'NOT_FOUND','Operación no disponible.');
  const operation=name as Operation,keys=shapes[operation];
  if(!isRecord(value)||Object.keys(value).some(k=>!keys.includes(k)))throw invalid();
  const optional=['limit','cursor','kind','status','periodDays',...(operation==='myScopes'?['courseId']:[]),...(operation==='requestStatus'?['requestId','inviteId']:[]),...(operation==='saveActivityDraft'?['activityId','expectedVersion']:[])];
  for(const key of keys)if(!optional.includes(key)&&!Object.hasOwn(value,key))throw invalid();
  for(const key of ['courseId','termId','groupId','destinationGroupId','inviteId','requestId'])if(key in value&&!identifier(value[key]))throw invalid();
  for(const key of ['uid','cursor'])if(key in value&&!identifier(value[key],128))throw invalid();
  if('idempotencyKey' in value&&(!identifier(value.idempotencyKey)||value.idempotencyKey.length<16))throw invalid();
  if('expectedVersion' in value&&!integer(value.expectedVersion,0,2147483646))throw invalid();
  if('expectedProfileVersion' in value&&!integer(value.expectedProfileVersion,0,2147483646))throw invalid();
  if('gamertag' in value)try{normalizeGamertag(value.gamertag);}catch{throw invalid();}
  if('expiresInSeconds' in value&&!integer(value.expiresInSeconds,1,maxTtl))throw invalid();
  if('periodDays' in value&&!integer(value.periodDays,0,365))throw invalid();
  if('maxUses' in value&&!integer(value.maxUses,1,100))throw invalid();
  if('maxPending' in value&&!integer(value.maxPending,1,100))throw invalid();
  if('limit' in value&&!integer(value.limit,1,operation==='myScopes'?20:50))throw invalid();
  if('kind' in value&&!['student','teacher'].includes(value.kind))throw invalid();
  if(operation==='myScopes'&&value.courseId&&value.kind!=='teacher')throw invalid();
  if(operation==='requestStatus'&&!!value.requestId===!!value.inviteId)throw invalid();
  if(operation==='updateAcademicProfile'){
    if(typeof value.fullName!=='string'||value.fullName!==value.fullName.trim()||value.fullName.length<3||value.fullName.length>120||/[\u0000-\u001f\u007f]/.test(value.fullName)||typeof value.shareGameIdentity!=='boolean')throw invalid();
    if(!(value.nickname===null||(typeof value.nickname==='string'&&value.nickname===value.nickname.trim()&&value.nickname.length>=1&&value.nickname.length<=30&&!/[\u0000-\u001f\u007f]/.test(value.nickname))))throw invalid();
    if(!(value.avatarId===null||(typeof value.avatarId==='string'&&/^avatar-0[1-6]$/.test(value.avatarId)))||!(value.companionId===null||['nexo','poli','piv','dua','brio'].includes(value.companionId)))throw invalid();
    if(!value.shareGameIdentity&&[value.nickname,value.avatarId,value.companionId].some(v=>v!==null))throw invalid();
  }
  if(operation==='savePlayerIdentity'){
    if(typeof value.fullName!=='string'||value.fullName!==value.fullName.trim()||value.fullName.length<3||value.fullName.length>120||/[\u0000-\u001f\u007f]/.test(value.fullName)||typeof value.shareGameIdentity!=='boolean'||
      typeof value.avatarId!=='string'||!/^avatar-0[1-6]$/.test(value.avatarId)||!['nexo','poli','piv','dua','brio'].includes(value.companionId))throw invalid();
  }
  if('status' in value&&!(operation==='setActivityStatus'?['hidden','archived'].includes(value.status):['pending','approved','rejected'].includes(value.status)))throw invalid();
  if('title' in value&&(typeof value.title!=='string'||value.title.trim().length<1||value.title.length>120||/[\u0000-\u001f]/.test(value.title)))throw invalid();
  if('token' in value&&(typeof value.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.token)||Buffer.from(value.token,'base64url').length!==32))throw invalid();
  if('activityId' in value&&(typeof value.activityId!=='string'||!identifier(value.activityId,128)))throw invalid();
  if('groupIds' in value&&(!Array.isArray(value.groupIds)||value.groupIds.length<1||value.groupIds.length>20||new Set(value.groupIds).size!==value.groupIds.length||value.groupIds.some(id=>typeof id!=='string'||!identifier(id))))throw invalid();
  if('orderedActivityIds' in value&&(!Array.isArray(value.orderedActivityIds)||value.orderedActivityIds.length>50||new Set(value.orderedActivityIds).size!==value.orderedActivityIds.length||value.orderedActivityIds.some(id=>typeof id!=='string'||!identifier(id))))throw invalid();
  if('gymId' in value&&!integer(value.gymId,1,5))throw invalid();
  if('provider' in value&&!['wordwall','learningapps'].includes(value.provider))throw invalid();
  if('resourceId' in value&&(typeof value.resourceId!=='string'||value.resourceId.length>80))throw invalid();
  if('sourceUrl' in value&&(typeof value.sourceUrl!=='string'||value.sourceUrl.length>1000))throw invalid();
  if('embedUrl' in value&&(typeof value.embedUrl!=='string'||value.embedUrl.length>1000))throw invalid();
  if('description' in value&&(typeof value.description!=='string'||value.description.length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.description)))throw invalid();
  if('instructions' in value&&(typeof value.instructions!=='string'||value.instructions.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.instructions)))throw invalid();
  if(operation==='saveActivityDraft'&&(!('groupIds' in value)||!('gymId' in value)||!('title' in value)||!('description' in value)||!('instructions' in value)||!('provider' in value)||!('resourceId' in value)||!('sourceUrl' in value)||!('embedUrl' in value)))throw invalid();
  return {operation,input:{...value,limit:value.limit??(operation==='myScopes'?20:50),kind:value.kind??'student'}};
}
export const scopeOf=(input:Input):Scope=>({courseId:input.courseId!,termId:input.termId!,groupId:input.groupId!});
