import {integratedBuild} from '../integration/features';
import {useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {AttemptCloudContext} from '../attempts/cloudContext';
import * as local from '../attempts/storage';
import {academicClient} from './client';
import {digest} from '../progress/model';
export function GroupActivityBridge(){
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 const auth=useAuth(),ref=useRef(auth);ref.current=auth;const cloud=useContext(AttemptCloudContext),uid=auth.user?.uid;
 useEffect(()=>{if(!integratedBuild||!uid||cloud?.view.status!=='synced')return;let alive=true;const controller=new AbortController();
 const call=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>alive&&ref.current.isCurrentSession(uid)},controller.signal);
 void(async()=>{let failed=false;const ledger=await local.readCanonical(uid);for(const event of ledger.entries){if(!alive)return;if(!event.context)continue;const idempotencyKey=await digest(JSON.stringify([event.context,event.activityId,event.id]));
 const ack=`optilab-group-projection:v1:${encodeURIComponent(uid)}:${idempotencyKey}`;try{if(localStorage.getItem(ack)==='ack')continue;}catch{/* Server deduplication still applies. */}
 try{await call('recordGroupActivity',{...event.context,activityId:event.activityId,attemptId:event.id,idempotencyKey});if(alive){try{localStorage.setItem(ack,'ack');}catch{}}}catch(e){if((e as {status?:number}).status!==404)failed=true;}
 }if(alive)setError(failed);})().catch(()=>{if(alive)setError(true);});return()=>{alive=false;controller.abort();};
 },[uid,cloud?.view.status,cloud?.view.pending,retry]);return error?<p role="alert">Tu historial se conserva; la actualización del grupo está pendiente. <button onClick={()=>setRetry(n=>n+1)}>Reintentar actualización académica</button></p>:null;
}
