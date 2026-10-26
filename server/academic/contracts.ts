export interface Scope {courseId:string;termId:string;groupId:string}
export interface Actor {uid:string;label:string}
export type Operation='myScopes'|'roster'|'requestStatus'|'groupInvitations'|'membershipEvents'|'groupRequests'|
  'createInvitation'|'reissueInvitation'|'revokeInvitation'|'requestMembership'|'approveMembership'|'rejectMembership'|
  'revokeMembership'|'transferMembership'|'createTerm'|'createGroup'|'getAcademicProfile'|'updateAcademicProfile'|
  'getPlayerIdentity'|'gamertagAvailability'|'savePlayerIdentity'|'groupEnrollmentLink'|'rotateEnrollmentLink'|'revokeEnrollmentLink'|'redeemInvitation';
export interface Input extends Partial<Scope> {
  idempotencyKey?:string;expectedVersion?:number;inviteId?:string;requestId?:string;uid?:string;
  token?:string;expiresInSeconds?:number;maxUses?:number;maxPending?:number;
  destinationGroupId?:string;title?:string;limit?:number;cursor?:string;kind?:'student'|'teacher';status?:string;
  fullName?:string;shareGameIdentity?:boolean;nickname?:string|null;avatarId?:string|null;companionId?:string|null;
  gamertag?:string;expectedProfileVersion?:number;
}
export const reads=new Set<Operation>(['myScopes','roster','requestStatus','groupInvitations','membershipEvents','groupRequests','getAcademicProfile','getPlayerIdentity','gamertagAvailability','groupEnrollmentLink']);
export type Data=Record<string,any>;
