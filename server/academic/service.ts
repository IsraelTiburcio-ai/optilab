import type {Actor,Input,Operation,Data} from './contracts';
import {reads} from './contracts';
import {scopeOf,parseInput,exact,isRecord,identifier,integer} from './validation';
import {AcademicRepository,groupPath,hash,type Metrics} from './repository';
import {policy as defaultPolicy,type Policy,type Reader} from './authorization';
import {ApiError,conflict} from './errors';
import {createInvitation,revokeInvitation,requestMembership,type Clock} from './invitations';
import {decideMembership,revokeMembership,transferMembership} from './memberships';
import {createTerm,createGroup} from './creation';
import {readOperation} from './queries';
import {commitPlan} from './audit';
import {request} from './models';
import type {EmulatorAdmin} from './sdk';
export interface ServiceOptions {
  /** Test-only policy seam for mutation control. Never configured from HTTP/env. */
  policy?:Policy;
  /** Operator fixture hook to revoke a grant between preflight and transaction. */
  afterPreflight?:(operation:Operation,actor:Actor)=>Promise<void>;
  onMetrics?:(operation:string,metrics:Metrics)=>void;
}
export class AcademicService {
  private policy:Policy;private clock:Clock;
  constructor(private repo:AcademicRepository,private sdk:EmulatorAdmin,private maxTtl:number,private options:ServiceOptions={}) {
    this.policy=options.policy??defaultPolicy;this.clock={now:()=>Date.now(),time:sdk.time,timestamp:sdk.timestamp};
  }
  private async authorize(r:Reader,actor:Actor,op:Operation,i:Input) {
    if(op==='requestMembership')return; // Secret/context validation in the handler; receipt is private to this actor.
    if(op==='createTerm'||op==='createGroup')return this.policy.course(r,actor.uid,i.courseId!,op==='createTerm'?'createTerms':'createGroups');
    const s=scopeOf(i),cap=['createInvitation','reissueInvitation','revokeInvitation'].includes(op)?'manageInvitations':'manageMembers';
    await this.policy.group(r,actor.uid,s,cap);
    if(op==='transferMembership')await this.policy.group(r,actor.uid,{...s,groupId:i.destinationGroupId!},'manageMembers');
  }
  async execute(actor:Actor,name:string,value:unknown):Promise<Data> {
    return this.repo.measure(()=>this.perform(actor,name,value),m=>this.options.onMetrics?.(name,m));
  }
  private async perform(actor:Actor,name:string,value:unknown):Promise<Data> {
    const {operation:op,input:i}=parseInput(name,value,this.maxTtl);
    // Authorization, metadata and page rows share one read-only snapshot.
    if(reads.has(op))return this.repo.readTransaction(view=>readOperation(view,this.policy,actor,op,i));
    await this.authorize(this.repo,actor,op,i);
    let verifiedTarget:string|null=null;
    if(op==='approveMembership') {
      const s=scopeOf(i),req=request(await this.repo.get(`${groupPath(s)}/membershipRequests/${i.requestId}`),s,i.requestId!);
      try{const user=await this.sdk.auth.getUser(req.uid);if(user.disabled)throw new Error('disabled');verifiedTarget=user.uid;}catch{throw conflict();}
    }
    await this.options.afterPreflight?.(op,actor);
    const commandId=hash(`${actor.uid}:${i.idempotencyKey}`),fingerprint=hash(canonical({operation:op,input:i}));
    return this.repo.transaction(async tx=>{
      // Mandatory fresh checks INSIDE the transaction, including receipt replays.
      await this.authorize(tx,actor,op,i);
      const receipt=await tx.get(`academicOperations/${commandId}`);
      if(receipt) {
        if(!exact(receipt,['schemaVersion','actorUid','operation','fingerprint','result','createdAt'])||receipt.schemaVersion!==2||receipt.actorUid!==actor.uid||receipt.operation!==op||receipt.fingerprint!==fingerprint)throw conflict();
        const result=receipt.result,allowed=['outcome','inviteId','requestId','uid','version','sourceVersion','destinationVersion','termId','courseId','groupId','commandId','operation','tokenAvailable'];
        if(!isRecord(result)||Object.keys(result).some(k=>!allowed.includes(k))||result.commandId!==commandId||result.operation!==op||typeof result.outcome!=='string'||result.outcome.length>80||result.tokenAvailable!==false)throw conflict();
        for(const key of ['inviteId','requestId','uid','termId','courseId','groupId'])if(key in result&&!identifier(result[key],128))throw conflict();
        for(const key of ['version','sourceVersion','destinationVersion'])if(key in result&&!integer(result[key],0,2147483647))throw conflict();
        return {...receipt.result,replayed:true,tokenAvailable:false};
      }
      const s=scopeOf(i);
      if(verifiedTarget!==null) {
        const req=request(await tx.get(`${groupPath(s)}/membershipRequests/${i.requestId}`),s,i.requestId!);
        if(req.uid!==verifiedTarget)throw conflict();
      }
      const p=op==='createInvitation'||op==='reissueInvitation'?await createInvitation(tx,s,actor,i,this.clock,op==='reissueInvitation'):
        op==='revokeInvitation'?await revokeInvitation(tx,s,i):
        op==='requestMembership'?await requestMembership(tx,s,actor,i,this.clock):
        op==='approveMembership'||op==='rejectMembership'?await decideMembership(tx,s,actor,i,this.clock,op==='approveMembership',commandId):
        op==='revokeMembership'?await revokeMembership(tx,s,i,this.clock):
        op==='transferMembership'?await transferMembership(tx,s,i,this.clock,commandId):
        op==='createTerm'?await createTerm(tx,actor,i,commandId):op==='createGroup'?await createGroup(tx,actor,i,commandId):null;
      if(!p)throw new ApiError(404,'NOT_FOUND','Operación no disponible.');
      return commitPlan(tx,actor,op,i,commandId,fingerprint,p,this.sdk.time);
    });
  }
}
function canonical(value:unknown):string{return JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
