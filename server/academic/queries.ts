import type {Actor,Input,Operation,Scope,Data} from './contracts';
import {scopeOf,identifier,exact,integer} from './validation';
import {activeContext,contextData,grant,type Policy} from './authorization';
import {type AcademicReadView,coursePath,groupPath,scopeKey,hash} from './repository';
import {ownProfile,teacherProfile} from './profiles';
import {ownPlayer,tagAvailability} from './players';
import {currentEnrollmentLink} from './enrollmentLinks';
import {invitation,request,publicInvite,publicRequest,scoped,roster,millis,details} from './models';
import {ApiError,denied,conflict} from './errors';
export async function readOperation(repo:AcademicReadView,policy:Policy,actor:Actor,operation:Operation,input:Input):Promise<Data> {
  if(operation==='getAcademicProfile')return ownProfile(repo,actor.uid);
  if(operation==='getPlayerIdentity')return ownPlayer(repo,actor.uid);
  if(operation==='gamertagAvailability')return tagAvailability(repo,actor.uid,input.gamertag!);
  if(operation==='myScopes') {
    // Course creation capabilities authorize bounded discovery of periods, not groups.
    if(input.courseId) {
      const capabilities=await courseCapabilities(repo,policy,actor.uid,input.courseId);
      if(!capabilities.createTerms&&!capabilities.createGroups)throw denied();
      const rows=await repo.page(`${coursePath(input.courseId)}/terms`,input.limit!,input.cursor);
      const periods=rows.map(({id,data})=>{if(!identifier(id)||!contextData(data,{courseId:input.courseId!,termId:id,groupId:'unused'},'term'))throw conflict();
        return {courseId:input.courseId,termId:id,title:data.title};});
      return {items:[],periods,nextCursor:rows.length===input.limit?rows.at(-1)!.id:null};
    }
    const kind=input.kind!,rows=await repo.page(`users/${actor.uid}/${kind==='teacher'?'teachingScopes':'enrollments'}`,input.limit!,input.cursor);
    const result:Data[]=[];
    for(const row of rows) {
      const p=row.data;
      if(!exact(p,['schemaVersion','courseId','termId','groupId','uid','status'])||p.schemaVersion!==2||p.uid!==actor.uid||
        !identifier(p.courseId)||!identifier(p.termId)||!identifier(p.groupId)||!['active','revoked'].includes(p.status))throw conflict();
      const s:Scope={courseId:p.courseId,termId:p.termId,groupId:p.groupId};
      if(row.id!==scopeKey(s))throw conflict();
      try {
        await activeContext(repo,s);
        if(kind==='teacher')await policy.group(repo,actor.uid,s);
        else {
          const [cg,gg]=await Promise.all([repo.get(`${coursePath(s.courseId)}/members/${actor.uid}`),repo.get(`${groupPath(s)}/members/${actor.uid}`)]);
          if(!grant(cg,actor.uid,s,false)||(!grant(gg,actor.uid,s,true)&&!grant(gg,actor.uid,s,true,'revoked')))throw denied();
          p.status=gg!.status;
        }
        const metadata=await repo.get(groupPath(s));
        if(kind==='teacher') {
          const caps=await repo.get(`${groupPath(s)}/administration/${actor.uid}`);
          const course=await repo.get(coursePath(s.courseId)),term=await repo.get(`${coursePath(s.courseId)}/terms/${s.termId}`);
          result.push({...s,status:p.status,title:metadata!.title,courseTitle:course!.title,termTitle:term!.title,
            capabilities:{manageMembers:caps!.manageMembers,manageInvitations:caps!.manageInvitations,readHistory:caps!.readHistory,...await courseCapabilities(repo,policy,actor.uid,s.courseId)}});
        } else result.push({...s,status:p.status,title:metadata!.title});
      }catch(e){if(!(e instanceof ApiError&&e.status===403))throw e;}
    }
    return {items:result,nextCursor:rows.length===input.limit?rows.at(-1)!.id:null};
  }
  const s=scopeOf(input),root=groupPath(s);
  if(operation==='groupEnrollmentLink'){await policy.group(repo,actor.uid,s,'manageInvitations');return currentEnrollmentLink(repo,s);}
  if(operation==='requestStatus') {
    const requestId=input.inviteId?hash(`${input.inviteId}:${actor.uid}`):input.requestId!;
    const raw=await repo.get(`${root}/membershipRequests/${requestId}`);
    if(input.inviteId&&(!raw||raw.uid!==actor.uid))throw new ApiError(404,'NOT_FOUND','Solicitud no disponible.');
    if(!raw||raw.uid!==actor.uid) {
      try{await policy.group(repo,actor.uid,s,'manageMembers');}catch{throw new ApiError(404,'NOT_FOUND','Solicitud no disponible.');}
    }
    const data=request(raw,s,requestId);
    const member=await repo.get(`${root}/members/${data.uid}`);
    const membershipStatus=grant(member,data.uid,s,true)?'active':grant(member,data.uid,s,true,'revoked')?'revoked':'none';
    const courseMember=await repo.get(`${coursePath(s.courseId)}/members/${data.uid}`);
    let accessAllowed=false;try{await activeContext(repo,s);accessAllowed=membershipStatus==='active'&&grant(courseMember,data.uid,s,false);}catch{/* archived/suspended scope is not active access */}
    let invitationState='unavailable';
    try{const inv=invitation(await repo.get(`${root}/invitations/${data.inviteId}`),s,data.inviteId);
      invitationState=inv.status==='revoked'?'revoked':millis(inv.expiresAt)<=Date.now()?'expired':inv.acceptedCount>=inv.maxUses?'exhausted':'active';
    }catch{/* No hash/secret or malformed invitation data leaves this endpoint. */}
    return {...publicRequest(data),membershipStatus,accessAllowed,invitationState};
  }
  const cap=operation==='groupInvitations'?'manageInvitations':operation==='membershipEvents'?'readHistory':'manageMembers';
  await policy.group(repo,actor.uid,s,cap);
  const name=operation==='roster'?'roster':operation==='groupInvitations'?'invitations':operation==='groupRequests'?'membershipRequests':'membershipEvents';
  const rows=await repo.page(`${root}/${name}`,input.limit!,input.cursor,operation==='groupRequests'?input.status:undefined);
  const items:Data[]=[];
  for(const {id,data} of rows) {
    if(name==='invitations')items.push(publicInvite(invitation(data,s,id)));
    else if(name==='membershipRequests'){const req=request(data,s,id);items.push({...publicRequest(req),academicProfile:await teacherProfile(repo,s,req.uid,req.status==='pending'?req:undefined)});}
    else if(name==='roster') {
      roster(data,s,id);
      const member=await repo.get(`${root}/members/${id}`);
      if(!grant(member,id,s,true,data.status)||!['active','revoked'].includes(data.status))throw conflict();
      const rawDetail=await repo.get(`${root}/membershipDetails/${id}`);
      if(!rawDetail)throw conflict();
      const detail=details(rawDetail,s,id);
      items.push({uid:id,label:data.label,labelSource:data.labelSource,status:data.status,revision:detail.revision,academicProfile:await teacherProfile(repo,s,id)});
    } else {
      if(!exact(data,['schemaVersion','courseId','termId','groupId','eventId','commandId','actorUid','action','subjectUid','version','createdAt'])||!scoped(data,s)||data.eventId!==id||
        !identifier(data.actorUid,128)||typeof data.action!=='string'||!identifier(data.commandId)||
        !(data.subjectUid===null||identifier(data.subjectUid,128))||!integer(data.version,0,2147483647)||!Number.isFinite(millis(data.createdAt)))throw conflict();
      items.push({eventId:id,commandId:data.commandId,actorUid:data.actorUid,action:data.action,subjectUid:data.subjectUid,version:data.version,createdAt:data.createdAt.toDate().toISOString()});
    }
  }
  return {items,nextCursor:rows.length===input.limit?rows.at(-1)!.id:null};
}
async function courseCapabilities(repo:AcademicReadView,policy:Policy,uid:string,courseId:string) {
  const result={createTerms:false,createGroups:false};
  for(const cap of ['createTerms','createGroups'] as const)try{await policy.course(repo,uid,courseId,cap);result[cap]=true;}
  catch(e){if(!(e instanceof ApiError&&e.status===403))throw e;}
  return result;
}
