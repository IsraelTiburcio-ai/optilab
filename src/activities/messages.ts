import type {ExternalActivity} from './types';
interface MessageLike {origin:string;source:unknown;data:unknown}
export interface ActiveActivityFrame {active:boolean;sessionId:string;activeSessionId:string;frameWindow:unknown;sourceUrl:string}
/** Resource-specific adapter, independently observed on the real LearningApps
 * pznycxd7t21 / tool71 v37. Numeric fields are checked then discarded, NOT scores
 * or resolution times. AppCompleted can mean connected cards, not perfect work. */
export function observedCompletion(event:MessageLike,activity:ExternalActivity,frame:ActiveActivityFrame):'AppSolved'|'AppCompleted'|null {
  if(!frame.active||frame.sessionId!==frame.activeSessionId||!frame.frameWindow||event.source!==frame.frameWindow||frame.sourceUrl!==activity.embedUrl)return null;
  if(activity.provider!=='learningapps'||activity.resourceId!=='pznycxd7t21'||activity.capabilities.completion!=='provider-signal'||event.origin!=='https://learningapps.org')return null;
  if(typeof event.data!=='string'||event.data.length>160)return null;
  if(/^AppSolved\|pznycxd7t21\|100\|[0-9]{1,9}\|0$/.test(event.data))return 'AppSolved';
  if(/^AppCompleted\|pznycxd7t21\|[0-9]{1,9}\|0$/.test(event.data))return 'AppCompleted';
  return null;
}
