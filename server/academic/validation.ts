import {invalid,ApiError} from './errors';
import type {Data,Input,Operation,Scope} from './contracts';
const shapes:Record<Operation,string[]>={
  myScopes:['kind','limit','cursor','courseId'],roster:['courseId','termId','groupId','limit','cursor'],
  requestStatus:['courseId','termId','groupId','requestId'],groupInvitations:['courseId','termId','groupId','limit','cursor'],
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
};
export function isRecord(v:unknown):v is Data{return !!v&&typeof v==='object'&&!Array.isArray(v);}
export function exact(v:unknown,keys:string[]):v is Data{return isRecord(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));}
export function identifier(value:unknown,max=80):value is string{return typeof value==='string'&&new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value);}
export function integer(v:unknown,min:number,max:number):v is number{return Number.isInteger(v)&&(v as number)>=min&&(v as number)<=max;}
export function parseInput(name:string,value:unknown,maxTtl:number):{operation:Operation;input:Input} {
  if(!Object.hasOwn(shapes,name))throw new ApiError(404,'NOT_FOUND','Operación no disponible.');
  const operation=name as Operation,keys=shapes[operation];
  if(!isRecord(value)||Object.keys(value).some(k=>!keys.includes(k)))throw invalid();
  const optional=['limit','cursor','kind','status',...(operation==='myScopes'?['courseId']:[])];
  for(const key of keys)if(!optional.includes(key)&&!Object.hasOwn(value,key))throw invalid();
  for(const key of ['courseId','termId','groupId','destinationGroupId','inviteId','requestId'])if(key in value&&!identifier(value[key]))throw invalid();
  for(const key of ['uid','cursor'])if(key in value&&!identifier(value[key],128))throw invalid();
  if('idempotencyKey' in value&&(!identifier(value.idempotencyKey)||value.idempotencyKey.length<16))throw invalid();
  if('expectedVersion' in value&&!integer(value.expectedVersion,0,2147483646))throw invalid();
  if('expiresInSeconds' in value&&!integer(value.expiresInSeconds,1,maxTtl))throw invalid();
  if('maxUses' in value&&!integer(value.maxUses,1,100))throw invalid();
  if('maxPending' in value&&!integer(value.maxPending,1,100))throw invalid();
  if('limit' in value&&!integer(value.limit,1,operation==='myScopes'?20:50))throw invalid();
  if('kind' in value&&!['student','teacher'].includes(value.kind))throw invalid();
  if(operation==='myScopes'&&value.courseId&&value.kind!=='teacher')throw invalid();
  if('status' in value&&!['pending','approved','rejected'].includes(value.status))throw invalid();
  if('title' in value&&(typeof value.title!=='string'||value.title.trim().length<1||value.title.length>120||/[\u0000-\u001f]/.test(value.title)))throw invalid();
  if('token' in value&&(typeof value.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.token)||Buffer.from(value.token,'base64url').length!==32))throw invalid();
  return {operation,input:{...value,limit:value.limit??(operation==='myScopes'?20:50),kind:value.kind??'student'}};
}
export const scopeOf=(input:Input):Scope=>({courseId:input.courseId!,termId:input.termId!,groupId:input.groupId!});
