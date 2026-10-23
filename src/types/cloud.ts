/** Storage contracts only. No client initialization, listeners, migration or sync.
 * Read models use Timestamp; a future writer uses serverTimestamp for receipt times.
 * Types are NOT an authorization boundary: firestore.rules validates writes.
 */
import type {Timestamp} from 'firebase/firestore';
import type {GymId} from '../data';
import type {CompanionId, EvolutionStage} from '../data/companions';
import type {GameResult} from '../integration/protocol';

export type SchemaVersion = 1;
export type Uid = string; // From Firebase Auth only, never trusted from a client field.
export type StableId = string; // Academic IDs: [A-Za-z0-9_-]{1,80}.
export type BaseGameId = string; // Must be a repo in catalog v1; enforced in Rules.
export type AvatarId = `avatar-0${1|2|3|4|5|6}`;
export interface UserDocument {schemaVersion:1; uid:Uid; createdAt:Timestamp}
export interface ProgressDocument {
  schemaVersion:1; uid:Uid; createdAt:Timestamp; updatedAt:Timestamp; revision:number;
  practiced:Partial<Record<BaseGameId,Timestamp>>;
  visited:GymId[];
  nickname:string;
  route:BaseGameId[];
  avatarId:AvatarId|null;
  companionId:CompanionId|null;
  evolutionCelebratedStage:EvolutionStage;
}
export interface SelfReportedReceipt {
  schemaVersion:1; uid:Uid; trust:'self-reported'; createdAt:Timestamp; date:Timestamp;
}
export interface DiagnosticDocument extends SelfReportedReceipt {
  answers:[0|1|2,0|1|2,0|1|2,0|1|2,0|1|2]; score:number;
}
export interface GameRunDocument extends SelfReportedReceipt {
  runId:string; gameId:'memorama-simplex'; result:GameResult;
}
export interface EvolutionMilestoneDocument {
  schemaVersion:1; uid:Uid; trust:'self-reported'; createdAt:Timestamp;
  stage:2|3; ruleVersion:1; unlockedAt:Timestamp; practice:Partial<Record<BaseGameId,Timestamp>>;
}
export interface CourseScope {schemaVersion:1; courseId:StableId}
export interface GroupScope extends CourseScope {termId:StableId; groupId:StableId}
export type GrantStatus = 'active'|'revoked';
export interface CourseDocument extends CourseScope {title:string; status:'active'|'archived'}
export interface TermDocument extends CourseScope {termId:StableId; title:string; status:'active'|'archived'}
export interface GroupDocument extends GroupScope {title:string; status:'active'|'archived'}
/** Separate collections members/staff. Only a trusted operator may write grants. */
export interface CourseGrant extends CourseScope {uid:Uid; status:GrantStatus}
export interface GroupGrant extends GroupScope {uid:Uid; status:GrantStatus}
/** Discovery only, not a permission. Revalidate authoritative grants on each request. */
export interface EnrollmentPointer extends GroupScope {uid:Uid; status:GrantStatus}
export interface StudentSummaryDocument extends GroupScope {
  uid:Uid; trust:'self-reported'; practicedCount:number; updatedAt:Timestamp;
}
export interface LeaderboardDocument extends GroupScope {
  uid:Uid; alias:string; points:number; verifiedRuns:number; updatedAt:Timestamp;
}

// PLANNED contracts: all paths below are denied to clients in issue #3.
// No producer, provider adapter, publication workflow or ranking is implemented.
export type ExternalProvider = 'wordwall'|'learningapps';
export type ActivityRef = {kind:'base'; activityId:BaseGameId; catalogVersion:1}
  | {kind:'external'; activityId:StableId; definitionRevision:number};
export interface TelemetryCapabilities {
  opened:boolean; completed:boolean; accuracy:boolean; errors:boolean; elapsedMs:boolean;
  evidence:'none'|'client-reported'|'provider-measured'|'server-validated';
}
/** courses/{courseId}/activities/{activityId}, one canonical definition per course. */
export interface ActivityDefinition extends CourseScope {
  activityId:StableId; provider:ExternalProvider; sourceUrl:string; embedUrl:string|null;
  title:string; description:string; instructions:string;
  telemetry:TelemetryCapabilities;
  status:'draft'|'published'|'archived'; revision:number;
  createdBy:Uid; createdAt:Timestamp; updatedAt:Timestamp; publishedAt:Timestamp|null;
}
/** Immutable revision under activities/{id}/revisions/{revision}; historical reference. */
export interface ActivityRevision extends ActivityDefinition {revision:number}
/** groupActivities/{activityId}: small assignment, not a copy of the definition. */
export interface GroupActivityAssignment extends GroupScope {
  activityId:StableId; activity:ActivityRef; gymId:GymId;
  status:'draft'|'published'|'hidden'|'archived';
  availableFrom:Timestamp|null; availableUntil:Timestamp|null;
  displayOrder:number; placementRevision:number;
  createdBy:Uid; updatedAt:Timestamp; publishedAt:Timestamp|null;
}
/** activityPlacements/{gymId}: authoritative order, CAS revision in a future transaction.
 * The publisher updates assignment displayOrder projections in the same operation.
 */
export interface ActivityPlacement extends GroupScope {
  gymId:GymId; orderedActivityIds:StableId[]; revision:number; updatedAt:Timestamp; updatedBy:Uid;
}
/** Future sanitized per-group published view: no draft/private definition reads by students. */
export interface PublishedActivityView extends GroupScope {
  activityId:StableId; activity:ActivityRef; gymId:GymId; displayOrder:number;
  title:string; description:string; instructions:string;
  provider:ExternalProvider; embedUrl:string|null; sourceUrl:string;
  telemetry:TelemetryCapabilities; availableFrom:Timestamp|null; availableUntil:Timestamp|null;
  publicationRevision:number;
}
/** Group history stores original scope and activity revision, never inferred from current membership. */
export interface ActivityAttempt extends GroupScope {
  attemptId:StableId; uid:Uid; activity:ActivityRef; gymIdAtAttempt:GymId;
  occurredAt:Timestamp; receivedAt:Timestamp;
  trust:'self-reported'|'provider-measured'|'server-validated';
  metrics:Partial<{completed:boolean; correct:number; errors:number; accuracy:number; elapsedMs:number}>;
}
/** Future day/semester summaries split by trust; no invented missing measurements. */
export interface AcademicSummary extends GroupScope {
  periodKey:string; uid:Uid|null; activityId:StableId|null; gymId:GymId|null;
  trust:ActivityAttempt['trust']; attempts:number; participants:number;
  measuredSamples:number; updatedAt:Timestamp;
}
