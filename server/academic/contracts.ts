export interface Scope {courseId:string;termId:string;groupId:string}
export interface Actor {emailVerified?:boolean;uid:string;label:string}
export type Operation='configureParticipation'|'syncAdmission'|'rankingPreference'|'rankingVisibility'|'setRankingVisibility'|'groupRanking'|'setRankingParticipation'|'recordGroupActivity'|'myScopes'|'roster'|'requestStatus'|'groupInvitations'|'membershipEvents'|'groupRequests'|
  'createInvitation'|'reissueInvitation'|'revokeInvitation'|'requestMembership'|'approveMembership'|'rejectMembership'|
  'revokeMembership'|'transferMembership'|'createTerm'|'createGroup'|'getAcademicProfile'|'updateAcademicProfile'|
  'getPlayerIdentity'|'gamertagAvailability'|'savePlayerIdentity'|'groupEnrollmentLink'|'rotateEnrollmentLink'|'revokeEnrollmentLink'|'redeemInvitation'|'groupProgress'|
  'activityWorkspace'|'teacherPublishedGroupActivities'|'publishedGroupActivities'|'publishedActivity'|'saveActivityDraft'|'publishActivities'|'saveGymLayout'|'reorderActivities'|'moveActivity'|'setActivityStatus';
export interface Input extends Partial<Scope> {
  enabled?:boolean;attemptId?:string;idempotencyKey?:string;expectedVersion?:number;inviteId?:string;requestId?:string;uid?:string;
  token?:string;expiresInSeconds?:number;maxUses?:number;maxPending?:number;periodDays?:number;
  destinationGroupId?:string;title?:string;limit?:number;cursor?:string;kind?:'student'|'teacher';status?:string;mode?:'anonymous'|'name'|'gamertag';
  fullName?:string;shareGameIdentity?:boolean;nickname?:string|null;avatarId?:string|null;companionId?:string|null;
  gamertag?:string;expectedProfileVersion?:number;
  groupIds?:string[];activityId?:string;provider?:string;resourceId?:string;sourceUrl?:string;embedUrl?:string|null;hiddenOriginalGameIds?:string[];externalVisibility?:{activityId:string;expectedVersion:number;visible:boolean}[];
  description?:string;instructions?:string;gymId?:number;orderedActivityIds?:string[];
}
export const reads=new Set<Operation>(['syncAdmission','rankingPreference','rankingVisibility','groupRanking','myScopes','roster','requestStatus','groupInvitations','membershipEvents','groupRequests','getAcademicProfile','getPlayerIdentity','gamertagAvailability','groupEnrollmentLink','groupProgress','activityWorkspace','teacherPublishedGroupActivities','publishedGroupActivities','publishedActivity']);
export type Data=Record<string,any>;
