export interface Scope {courseId:string;termId:string;groupId:string}
export interface Capabilities {manageMembers:boolean;manageInvitations:boolean;readHistory:boolean;createTerms:boolean;createGroups:boolean}
export interface StudentScope extends Scope {title:string;status:'active'|'revoked'}
export interface TeachingScope extends StudentScope {courseTitle:string;termTitle:string;capabilities:Capabilities}
export interface Period {courseId:string;termId:string;title:string}
export interface Page<T> {items:T[];nextCursor:string|null}
export interface Discovery extends Page<StudentScope> {periods?:Period[]}
export interface AcademicProfile {revision:number;fullName:string;nameSource:'self-declared';email:string|null;emailVerified:boolean;shareGameIdentity:boolean;
  gameIdentity:{nickname:string|null;avatarId:string|null;companionId:string|null}|null;updatedAt:string}
export interface Member {uid:string;label:string;labelSource:'self-chosen';status:'active'|'revoked';revision:number;academicProfile?:AcademicProfile|null}
export interface Request {requestId:string;inviteId:string;uid:string;label:string;status:'pending'|'approved'|'rejected';revision:number;createdAt:string;academicProfile?:AcademicProfile|null}
export interface RequestStatus extends Request {membershipStatus:'active'|'revoked'|'none';accessAllowed:boolean;invitationState:'active'|'expired'|'revoked'|'exhausted'|'unavailable'}
export interface Invitation {inviteId:string;status:'active'|'revoked';revision:number;expiresAt:string;maxUses:number;acceptedCount:number;pendingCount:number;maxPending:number}
export interface MutationResult {outcome:string;commandId:string;operation:string;replayed:boolean;tokenAvailable?:boolean;token?:string;inviteId?:string;requestId?:string;termId?:string;groupId?:string;version?:number}
type Command={idempotencyKey:string};type CAS={expectedVersion:number};
type InviteFields={expiresInSeconds:number;maxUses:number;maxPending:number};
export interface Api {
  myScopes:{input:{kind:'teacher'|'student';limit?:number;cursor?:string;courseId?:string};output:Discovery};
  getAcademicProfile:{input:Record<string,never>;output:{profile:AcademicProfile|null;revision:number}};
  updateAcademicProfile:{input:Command&CAS&{fullName:string;shareGameIdentity:boolean;nickname:string|null;avatarId:string|null;companionId:string|null};output:MutationResult};
  requestMembership:{input:Scope&Command&{inviteId:string;token:string};output:MutationResult};
  requestStatus:{input:Scope&({requestId:string;inviteId?:never}|{inviteId:string;requestId?:never});output:RequestStatus};
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
export type CommandName=Exclude<keyof Api,'myScopes'|'roster'|'groupRequests'|'groupInvitations'|'getAcademicProfile'|'requestStatus'>;
