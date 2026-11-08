export interface Scope {courseId:string;termId:string;groupId:string}
export interface Capabilities {manageMembers:boolean;manageInvitations:boolean;readHistory:boolean;createTerms:boolean;createGroups:boolean}
export interface StudentScope extends Scope {title:string;status:'active'|'revoked';courseTitle?:string;termTitle?:string}
export interface TeachingScope extends StudentScope {courseTitle:string;termTitle:string;capabilities:Capabilities}
export interface Period {courseId:string;termId:string;title:string}
export interface Page<T> {items:T[];nextCursor:string|null}
export interface Discovery extends Page<StudentScope> {periods?:Period[]}
export interface AcademicProfile {revision:number;fullName:string;nameSource:'self-declared';email:string|null;emailVerified:boolean;shareGameIdentity:boolean;
  gameIdentity:{nickname:string|null;avatarId:string|null;companionId:string|null}|null;updatedAt:string}
export interface Member {uid:string;label:string;labelSource:'self-chosen';status:'active'|'revoked';revision:number;academicProfile?:AcademicProfile|null}
export interface Request {requestId:string;inviteId:string;uid:string;label:string;status:'pending'|'approved'|'rejected';revision:number;createdAt:string;academicProfile?:AcademicProfile|null;membershipStatus?:'active'|'revoked'|'none'}
export interface RequestStatus extends Request {membershipStatus:'active'|'revoked'|'none';accessAllowed:boolean;invitationState:'active'|'expired'|'revoked'|'exhausted'|'unavailable'}
export interface Invitation {inviteId:string;status:'active'|'revoked';revision:number;expiresAt:string;maxUses:number;acceptedCount:number;pendingCount:number;maxPending:number}
export interface MutationResult {outcome:string;commandId:string;operation:string;replayed:boolean;tokenAvailable?:boolean;token?:string;inviteId?:string;requestId?:string;termId?:string;groupId?:string;version?:number;activityId?:string;status?:string;revision?:number;placementRevision?:number;count?:number;gymId?:number}
export interface PlayerIdentity {revision:number;gamertag:string;avatarId:string;companionId:string;updatedAt:string}
export interface EnrollmentLink {revision:number;status:'active'|'expired'|'revoked';expiresAt:string}
export interface GroupProgressGym {gymId:number;title:string;totalGames:number;opened:number;practiced:number;reported:number;completed:number}
export interface GroupProgressStudent {
  uid:string;name:string;email:string|null;emailVerified:boolean;gamertag:string|null;
  pendingGames?:number;manualDeclaredGames?:number;lastActivityAt:string|null;opened:number;declared:number;reported:number;validated:number;
  practicedGames:number;completedGames:number;gyms:Array<{gymId:number;opened:number;declared:number;reported:number;completed:number;practiced?:number;pending?:number}>;
}

export type ActivityProvider='wordwall'|'learningapps';
export interface ActivityTelemetry {opened:boolean;completed:boolean;accuracy:boolean;errors:boolean;elapsedMs:boolean;evidence:'none'|'client-reported'|'provider-measured'|'server-validated'}
export interface ActivityDefinition {
  schemaVersion:1;courseId:string;activityId:string;provider:ActivityProvider;resourceId:string;sourceUrl:string;embedUrl:string|null;
  title:string;description:string;instructions:string;groupIds:string[];telemetry:ActivityTelemetry;
  status:'draft'|'published'|'archived';revision:number;publishedRevision:number|null;
  createdBy:string;createdAt:string;updatedAt:string;publishedAt:string|null;
}
export interface ActivityAssignment {
  schemaVersion:1;courseId:string;termId:string;groupId:string;activityId:string;gymId:number;
  status:'draft'|'published'|'hidden'|'archived';displayOrder:number;revision:number;definitionRevision:number;
  createdBy:string;updatedAt:string;publishedAt:string|null;
}
export interface ActivityPlacement {schemaVersion:1;courseId:string;termId:string;groupId:string;gymId:number;orderedActivityIds:string[];revision:number;updatedBy:string|null;updatedAt:string|null}
export interface GymLayout {schemaVersion:1;courseId:string;termId:string;groupId:string;gymId:number;orderedActivityIds:string[];hiddenOriginalGameIds:string[];revision:number;updatedBy:string|null;updatedAt:string|null}
export interface ActivityWorkspace {definitions:ActivityDefinition[];assignments:ActivityAssignment[];placements:ActivityPlacement[];layouts:GymLayout[]}
export interface PublishedActivity {activityId:string;provider:ActivityProvider;sourceUrl:string;embedUrl:string|null;title:string;description:string;instructions:string;
  telemetry:ActivityTelemetry;gymId:number;revision:number}
export interface PublishedActivities {gyms:Array<{gymId:number;activities:PublishedActivity[];layout:GymLayout}>}

export interface GroupProgress {
  externalActivities?:{activityId:string;title:string;provider:string;opened:number;declared:number;reported:number;completed:number;validated:number}[];
  scope:Scope;period:{days:number;from:string|null;to:string};generatedAt:string;
  studentsTotal:number;studentsActive:number;activityDataTruncated:boolean;
  activities:{manualDeclared?:number;practiced?:number;opened:number;declared:number;reported:number;completed:number;validated:number};
  gyms:GroupProgressGym[];students:GroupProgressStudent[];truncated:boolean;
}
type Command={idempotencyKey:string};type CAS={expectedVersion:number};
type InviteFields={expiresInSeconds:number;maxUses:number;maxPending:number};
export interface Api {
  configureParticipation:{input:Scope&Command&CAS&{enabled:boolean};output:MutationResult};
  syncAdmission:{input:Record<string,never>;output:{allowed:boolean;mode:'private-pilot'|'single-operator-test'|'production'|null;expiresAt:string|null}};
  rankingPreference:{input:Scope;output:{enabled:boolean;revision:number}};
  groupRanking:{input:Scope;output:{scope:Scope;enabled:boolean;controlRevision:number;criterion:'unique-group-openings-v1';trust:'client-reported-participation';truncated:boolean;rows:{alias:string;participation:number;position:number|null}[]}};
  setRankingParticipation:{input:Scope&Command&CAS&{enabled:boolean};output:MutationResult};
  recordGroupActivity:{input:Scope&Command&{activityId:string;attemptId:string};output:MutationResult};
  getPlayerIdentity:{input:Record<string,never>;output:{identity:PlayerIdentity|null}};
  gamertagAvailability:{input:{gamertag:string};output:{available:boolean}};
  savePlayerIdentity:{input:Command&CAS&{expectedProfileVersion:number;fullName:string;gamertag:string;avatarId:string;companionId:string;shareGameIdentity:boolean};output:MutationResult};
  groupEnrollmentLink:{input:Scope;output:{link:EnrollmentLink|null}};
  rotateEnrollmentLink:{input:Scope&Command&CAS&{expiresInSeconds:number};output:MutationResult};
  revokeEnrollmentLink:{input:Scope&Command&CAS;output:MutationResult};
  redeemInvitation:{input:Scope&Command&{inviteId:string;token:string};output:MutationResult};
  myScopes:{input:{kind:'teacher'|'student';limit?:number;cursor?:string;courseId?:string};output:Discovery};
  getAcademicProfile:{input:Record<string,never>;output:{profile:AcademicProfile|null;revision:number}};
  updateAcademicProfile:{input:Command&CAS&{fullName:string;shareGameIdentity:boolean;nickname:string|null;avatarId:string|null;companionId:string|null};output:MutationResult};
  requestMembership:{input:Scope&Command&{inviteId:string;token:string};output:MutationResult};
  requestStatus:{input:Scope&({requestId:string;inviteId?:never}|{inviteId:string;requestId?:never});output:RequestStatus};
  roster:{input:Scope&{limit?:number;cursor?:string};output:Page<Member>};
  groupRequests:{input:Scope&{limit?:number;cursor?:string;status?:Request['status']};output:Page<Request>};
  groupInvitations:{input:Scope&{limit?:number;cursor?:string};output:Page<Invitation>};
  groupProgress:{input:Scope&{periodDays?:number};output:GroupProgress};
  createInvitation:{input:Scope&Command&InviteFields;output:MutationResult};
  reissueInvitation:{input:Scope&Command&InviteFields&CAS&{inviteId:string};output:MutationResult};
  revokeInvitation:{input:Scope&Command&CAS&{inviteId:string};output:MutationResult};
  approveMembership:{input:Scope&Command&CAS&{requestId:string};output:MutationResult};
  rejectMembership:{input:Scope&Command&CAS&{requestId:string};output:MutationResult};
  revokeMembership:{input:Scope&Command&CAS&{uid:string};output:MutationResult};
  transferMembership:{input:Scope&Command&CAS&{uid:string;destinationGroupId:string};output:MutationResult};
  createTerm:{input:Command&{courseId:string;title:string};output:MutationResult};
  createGroup:{input:Command&{courseId:string;termId:string;title:string};output:MutationResult};
  activityWorkspace:{input:Scope;output:ActivityWorkspace};
  teacherPublishedGroupActivities:{input:Scope;output:PublishedActivities};
  publishedGroupActivities:{input:Scope;output:PublishedActivities};
  publishedActivity:{input:Scope&{activityId:string};output:PublishedActivity};
  saveActivityDraft:{input:Scope&Command&{groupIds:string[];activityId?:string;expectedVersion?:number;provider:ActivityProvider;resourceId:string;sourceUrl:string;embedUrl:string|null;title:string;description:string;instructions:string;gymId:number};output:MutationResult};
  publishActivities:{input:Scope&Command&{groupIds:string[];activityId:string;expectedVersion:number};output:MutationResult};
  saveGymLayout:{input:Scope&Command&{gymId:number;orderedActivityIds:string[];hiddenOriginalGameIds:string[];externalVisibility?:{activityId:string;expectedVersion:number;visible:boolean}[];expectedVersion:number};output:MutationResult};
  reorderActivities:{input:Scope&Command&{gymId:number;orderedActivityIds:string[];expectedVersion:number};output:MutationResult};
  moveActivity:{input:Scope&Command&{activityId:string;gymId:number;expectedVersion:number};output:MutationResult};
  setActivityStatus:{input:Scope&Command&{activityId:string;status:'hidden'|'archived';expectedVersion:number};output:MutationResult};
}
export type CommandName=Exclude<keyof Api,'syncAdmission'|'rankingPreference'|'groupRanking'|'myScopes'|'roster'|'groupRequests'|'groupInvitations'|'groupProgress'|'getAcademicProfile'|'requestStatus'|'getPlayerIdentity'|'gamertagAvailability'|'groupEnrollmentLink'|'activityWorkspace'|'teacherPublishedGroupActivities'|'publishedGroupActivities'|'publishedActivity'>;
