import type {Actor,Data,Operation,Input} from './contracts';
import type {AcademicTransaction} from './repository';
import {groupPath,hash} from './repository';
import {context} from './models';
import type {Plan} from './plans';
export function commitPlan(tx:AcademicTransaction,actor:Actor,operation:Operation,input:Input,commandId:string,fingerprint:string,plan:Plan,time:()=>unknown):Data {
  for(const write of plan.writes)tx.set(write.path,write.data);
  for(const event of plan.events) {
    const eventId=hash(`${commandId}:${JSON.stringify(event.scope)}:${event.action}`);
    tx.set(`${groupPath(event.scope)}/membershipEvents/${eventId}`,{...context(event.scope),eventId,commandId,actorUid:actor.uid,
      action:event.action,subjectUid:event.subjectUid,version:event.version,createdAt:time()});
  }
  const result={...plan.result,commandId,operation};
  tx.set(`academicAudit/${commandId}`,{schemaVersion:2,actorUid:actor.uid,operation,commandId,
    scope:{courseId:input.courseId??null,termId:input.termId??plan.result.termId??null,groupId:input.groupId??plan.result.groupId??null},createdAt:time()});
  // Secret intentionally absent from receipt and audit, including retry/lost ACK.
  tx.set(`academicOperations/${commandId}`,{schemaVersion:2,actorUid:actor.uid,operation,fingerprint,result:{...result,tokenAvailable:false},createdAt:time()});
  return {...result,replayed:false,...(plan.secret?{token:plan.secret}:{} )};
}
