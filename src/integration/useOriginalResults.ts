import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import {isResultPilot,ORIGINAL_RESULTS_PROTOCOL,OriginalResultReceiver,type OriginalResult} from './originalResults';

export function useOriginalResults(gameId:string,session:string,sourceUrl:string,frame:RefObject<HTMLIFrameElement|null>){
  const enabled=isResultPilot(gameId);
  const [status,setStatus]=useState<'waiting'|'connected'|'playing'|'ended'|'aborted'|'retired'>('waiting');
  const [report,setReport]=useState<{runId:string;result:OriginalResult}|null>(null);
  const load=useRef(()=>{}),loads=useRef(0);
  useEffect(()=>{
    if(!isResultPilot(gameId))return;
    const receiver=new OriginalResultReceiver(gameId,session,sourceUrl);
    let active=true,ready=false;
    const init=()=>{const node=frame.current;if(active&&loads.current===1&&!ready&&node?.isConnected&&node.src===sourceUrl)node.contentWindow?.postMessage({protocol:ORIGINAL_RESULTS_PROTOCOL,version:1,type:'host:init',gameId,session},'*');};
    load.current=()=>{
      if(loads.current>1){active=false;receiver.invalidate();setReport(null);setStatus('retired');return;}
      init();
    };
    const receive=(event:MessageEvent)=>{
      const node=frame.current;if(!active||!loads.current||!node)return;
      const message=receiver.accept(event,{window:node.contentWindow,sourceUrl:node.src,connected:node.isConnected});if(!message)return;
      if(message.type==='game:ready'){ready=true;setStatus('connected');}
      else if(message.type==='game:started'){setReport(null);setStatus('playing');}
      else if(message.type==='game:aborted'){setReport(null);setStatus('aborted');}
      else{setReport({runId:message.runId,result:message.result});setStatus('ended');}
    };
    window.addEventListener('message',receive);if(loads.current)load.current();const timer=setInterval(init,600);
    return ()=>{active=false;receiver.invalidate();load.current=()=>{};window.removeEventListener('message',receive);clearInterval(timer);};
  },[gameId,session,sourceUrl,frame]);
  return {enabled,status,report,onLoad:useCallback(()=>{loads.current++;load.current();},[])};
}
