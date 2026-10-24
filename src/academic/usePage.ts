import {useEffect,useState} from 'react';
import type {AcademicCall} from './client';
import type {Api,Page} from './types';
type Read='roster'|'groupRequests'|'groupInvitations'|'myScopes';
export function useAcademicPage<K extends Read>(call:AcademicCall,operation:K,input:Api[K]['input'],refresh:number,enabled=true) {
  const [cursor,setCursor]=useState<string>(),[previous,setPrevious]=useState<(string|undefined)[]>([]);
  const [data,setData]=useState<Api[K]['output']|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const serialized=JSON.stringify(input);
  useEffect(()=>{setCursor(undefined);setPrevious([]);},[serialized,refresh]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;setData(null);setError('');setLoading(enabled);
    if(enabled)void call(operation,{...JSON.parse(serialized),limit:20,...(cursor?{cursor}:{})},controller.signal)
      .then(result=>{if(active)setData(result);}).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[call,operation,serialized,cursor,refresh,enabled]);
  return {data,error,loading,page:previous.length+1,
    next:()=>{if(data?.nextCursor){setPrevious(p=>[...p,cursor]);setCursor(data.nextCursor);}},
    back:()=>{if(previous.length){setCursor(previous.at(-1));setPrevious(p=>p.slice(0,-1));}},hasPrevious:previous.length>0};
}
export type PagedState<T>={data:Page<T>|null;error:string;loading:boolean;page:number;next:()=>void;back:()=>void;hasPrevious:boolean};
