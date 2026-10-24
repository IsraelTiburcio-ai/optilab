import type {Data,Scope} from './contracts';
import {exact} from './validation';
import {denied} from './errors';
import {coursePath,groupPath,termPath} from './repository';
export interface Reader {get(path:string):Promise<Data|null>}
export type GroupCapability='manageInvitations'|'manageMembers'|'readHistory';
export function contextData(d:Data|null,s:Scope,kind:'course'|'term'|'group'):boolean {
  const keys=['schemaVersion','courseId','title','status',...(kind!=='course'?['termId']:[]),...(kind==='group'?['groupId']:[])];
  return exact(d,keys)&&d.schemaVersion===1&&d.courseId===s.courseId&&d.status==='active'&&typeof d.title==='string'&&d.title.length<=120&&
    (kind==='course'||d.termId===s.termId)&&(kind!=='group'||d.groupId===s.groupId);
}
export function grant(d:Data|null,uid:string,s:Scope,group:boolean,status='active'):boolean {
  return exact(d,['schemaVersion','uid','courseId','status',...(group?['termId','groupId']:[])])&&d.schemaVersion===1&&d.uid===uid&&d.courseId===s.courseId&&d.status===status&&
    (!group||(d.termId===s.termId&&d.groupId===s.groupId));
}
export async function activeContext(r:Reader,s:Scope) {
  const [c,t,g]=await Promise.all([r.get(coursePath(s.courseId)),r.get(termPath(s.courseId,s.termId)),r.get(groupPath(s))]);
  if(!contextData(c,s,'course')||!contextData(t,s,'term')||!contextData(g,s,'group'))throw denied();
}
export async function authorizeGroup(r:Reader,uid:string,s:Scope,cap?:GroupCapability) {
  await activeContext(r,s);
  const [cg,gg,caps]=await Promise.all([r.get(`${coursePath(s.courseId)}/staff/${uid}`),r.get(`${groupPath(s)}/staff/${uid}`),r.get(`${groupPath(s)}/administration/${uid}`)]);
  if(!grant(cg,uid,s,false)||!grant(gg,uid,s,true)||!exact(caps,['schemaVersion','uid','courseId','termId','groupId','status','manageInvitations','manageMembers','readHistory'])||
    caps.schemaVersion!==2||caps.uid!==uid||caps.courseId!==s.courseId||caps.termId!==s.termId||caps.groupId!==s.groupId||caps.status!=='active'||
    !['manageInvitations','manageMembers','readHistory'].every(k=>typeof caps[k]==='boolean')||(cap!==undefined&&caps[cap]!==true))throw denied();
}
export async function authorizeCourse(r:Reader,uid:string,courseId:string,cap:'createTerms'|'createGroups') {
  const s={courseId,termId:'unused',groupId:'unused'};
  const [c,staff,caps]=await Promise.all([r.get(coursePath(courseId)),r.get(`${coursePath(courseId)}/staff/${uid}`),r.get(`${coursePath(courseId)}/administration/${uid}`)]);
  if(!contextData(c,s,'course')||!grant(staff,uid,s,false)||!exact(caps,['schemaVersion','uid','courseId','status','createTerms','createGroups'])||
    caps.schemaVersion!==2||caps.uid!==uid||caps.courseId!==courseId||caps.status!=='active'||typeof caps.createTerms!=='boolean'||typeof caps.createGroups!=='boolean'||!caps[cap])throw denied();
}
export interface Policy {group:typeof authorizeGroup;course:typeof authorizeCourse}
export const policy:Policy={group:authorizeGroup,course:authorizeCourse};
