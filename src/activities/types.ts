import type {GymId} from '../data';
export type ActivityProvider='learningapps'|'wordwall';
export interface ExternalActivity {
  activityId:string;
  title:string;
  provider:ActivityProvider;
  resourceId:string;
  sourceUrl:string;
  embedUrl:string;
  capabilities:{completion:'provider-signal'|'unavailable';score:'unavailable';academicValidation:'none'};
  academicStatus:'public-complementary';
}
/** Public gym placement is not a course/group assignment or a membership. */
export interface PublicActivityPlacement {activityId:string;gymId:GymId;status:'published'|'withdrawn'}
export type ActivityObservation={type:'opened';activityId:string;sessionId:string;at:string}|
  {type:'completion-observed';activityId:string;sessionId:string;at:string;signal:'AppSolved'|'AppCompleted';trust:'provider-signal-not-validated'};
