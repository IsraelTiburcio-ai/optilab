export interface Scope {courseId:string;termId:string;groupId:string}
export interface Capabilities {manageMembers:boolean;manageInvitations:boolean;readHistory:boolean;createTerms:boolean;createGroups:boolean}
export interface TeachingScope extends Scope {title:string;courseTitle:string;termTitle:string;status:'active'|'revoked';capabilities:Capabilities}
export interface Period {courseId:string;termId:string;title:string}
export interface Page<T> {items:T[];nextCursor:string|null}
export interface Discovery extends Page<TeachingScope> {periods?:Period[]}
export interface Member {uid:string;label:string;labelSource:'self-chosen';status:'active'|'revoked';revision:number}
export interface Request {requestId:string;inviteId:string;uid:string;label:string;status:'pending'|'approved'|'rejected';revision:number;createdAt:string}
export interface Invitation {inviteId:string;status:'active'|'revoked';revision:number;expiresAt:string;maxUses:number;acceptedCount:number;pendingCount:number;maxPending:number}
export interface MutationResult {outcome:string;commandId:string;operation:string;replayed:boolean;tokenAvailable?:boolean;token?:string;inviteId?:string;termId?:string;groupId?:string;version?:number}
type Command={idempotencyKey:string};type CAS={expectedVersion:number};
type InviteFields={expiresInSeconds:number;maxUses:number;maxPending:number};
export interface Api {
  myScopes:{input:{kind:'teacher';limit?:number;cursor?:string;courseId?:string};output:Discovery};
  roster:{input:Scope&{limit?:number;cursor?:string};output:Page<Member>};
  groupRequests:{input:Scope&{limit?:number;cursor?:string;status?:Request['status']};output:Page<Request>};
  groupInvitations:{input:Scope&{limit?:number;cursor?:string};output:Page<Invitation>};
  createInvitation:{input:Scope&Command&InviteFields;output:MutationResult};
  reissueInvitation:{input:Scope&Command&InviteFields&CAS&{inviteId:string};output:MutationResult};
  revokeInvitation:{input:Scope&Command&CAS&{inviteId:string};output:MutationResult};
  approveMembership:{input:Scope&Command&CAS&{requestId:string};output:MutationResult};
  rejectMembership:{input:Scope&Command&CAS&{requestId:string};output:MutationResult};
  revokeMembership:{input:Scope&Command&CAS&{uid:string};output:MutationResult};
  transferMembership:{input:Scope&Command&CAS&{uid:string;destinationGroupId:string};output:MutationResult};
  createTerm:{input:Command&{courseId:string;title:string};output:MutationResult};
  createGroup:{input:Command&{courseId:string;termId:string;title:string};output:MutationResult};
}
export type CommandName=Exclude<keyof Api,'myScopes'|'roster'|'groupRequests'|'groupInvitations'>;
