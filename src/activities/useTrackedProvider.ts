import {useIntegratedFeatures} from '../integration/features';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {useAttempts} from '../attempts/local';
import {publicActivity} from './catalog';
import {observedCompletion} from './messages';
/** The only enabled completion adapter remains the individually observed resource. */
export function useTrackedProvider(activity:{activityId:string;provider:'wordwall'|'learningapps';sourceUrl:string;embedUrl:string|null}|null,frame:RefObject<HTMLIFrameElement|null>,preview=false){
 const integrated=useIntegratedFeatures(),enabled=useRef(integrated);enabled.current=integrated&&!preview;
 const attempts=useAttempts(),[session]=useState(()=>crypto.randomUUID()),[completed,setCompleted]=useState(false),loads=useRef(0),active=useRef(false),seen=useRef(false);
 const record=useRef(attempts.record);record.current=attempts.record;
 const id=activity?.activityId??'',source=activity?.embedUrl??'',preset=publicActivity('learningapps-formulas-simplex')?.activity;
 useEffect(()=>{if(preview)return;active.current=true;const receive=(event:MessageEvent)=>{if(!enabled.current||!activity||!preset||seen.current||loads.current!==1||activity.provider!=='learningapps'||activity.embedUrl!==preset.embedUrl||activity.sourceUrl!==preset.sourceUrl)return;
  const node=frame.current;if(!node)return;const signal=observedCompletion(event,preset,{active:active.current,sessionId:session,activeSessionId:session,frameWindow:node.contentWindow,sourceUrl:node.src});if(!signal)return;
  seen.current=true;record.current(id,'reported',session+':result',{completed:true});setCompleted(true);
 };window.addEventListener('message',receive);return()=>{active.current=false;window.removeEventListener('message',receive);};},[id,source,session,frame,attempts.scope,attempts.ready,preview]);
 const open=()=>{if(enabled.current&&id)record.current(id,'opened',session+':open');};
 return {completed,onLoad:()=>{loads.current++;if(loads.current===1)open();else active.current=false;},onExternalOpen:open};
}
