import type {Actor,Input,Scope} from './contracts';
import type {Reader} from './authorization';
import {contextData} from './authorization';
import {coursePath,groupPath,hash,scopeKey,termPath} from './repository';
import {conflict,denied} from './errors';
import {plan,type Plan} from './plans';
export async function createTerm(r:Reader,actor:Actor,input:Input,commandId:string):Promise<Plan> {
  const termId=`t_${hash(commandId).slice(0,32)}`,path=termPath(input.courseId!,termId);
  if(await r.get(path))throw conflict();
  return plan({outcome:'term-created',termId},[{path,data:{schemaVersion:1,courseId:input.courseId!,termId,title:input.title!,status:'active'}}]);
}
export async function createGroup(r:Reader,actor:Actor,input:Input,commandId:string):Promise<Plan> {
  const s:Scope={courseId:input.courseId!,termId:input.termId!,groupId:`g_${hash(commandId).slice(0,32)}`},path=groupPath(s);
  const [term,existing]=await Promise.all([r.get(termPath(s.courseId,s.termId)),r.get(path)]);
  if(!contextData(term,s,'term'))throw denied();if(existing)throw conflict();
  return plan({outcome:'group-created',...s},[
    {path,data:{schemaVersion:1,...s,title:input.title!,status:'active'}},
    {path:`${path}/staff/${actor.uid}`,data:{schemaVersion:1,...s,uid:actor.uid,status:'active'}},
    {path:`${path}/administration/${actor.uid}`,data:{schemaVersion:2,...s,uid:actor.uid,status:'active',manageInvitations:true,manageMembers:true,readHistory:true}},
    {path:`${path}/settings/current`,data:{schemaVersion:2,...s,revision:0}},
    {path:`users/${actor.uid}/teachingScopes/${scopeKey(s)}`,data:{schemaVersion:2,...s,uid:actor.uid,status:'active'}},
  ],[{scope:s,action:'group-created',subjectUid:actor.uid,version:1}]);
}
