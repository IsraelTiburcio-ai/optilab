import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient} from './client';
import type {PlayerIdentity} from './types';
const Context=createContext<{teacher:boolean;checked:boolean;identity:PlayerIdentity|null|undefined;error:string;refresh:()=>void}>({teacher:false,checked:false,identity:undefined,error:'',refresh:()=>{}});
export const useAcademicAccess=()=>useContext(Context);
export function AcademicAccessProvider({children}:{children:ReactNode}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;
  const [data,setData]=useState<{uid:string;teacher:boolean;checked:boolean;identity:PlayerIdentity|null|undefined}>({uid:'',teacher:false,checked:false,identity:undefined});
  const [revision,setRevision]=useState(0),refresh=()=>setRevision(n=>n+1);
  const [error,setError]=useState('');
  useEffect(()=>{
    const uid=auth.user?.uid;if(!uid){setData({uid:'',teacher:false,checked:auth.status!=='loading',identity:undefined});return;}
    setError('');
    const controller=new AbortController();let active=true;
    const current=()=>active&&ref.current.isCurrentSession(uid),call=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current},controller.signal);
    setData(old=>old.uid===uid?old:{uid,teacher:false,checked:false,identity:undefined});
    void (async()=>{let cursor:string|undefined,teacher=false;
      do{const page=await call('myScopes',{kind:'teacher',limit:20,...cursor?{cursor}:{}});teacher=page.items.length>0;cursor=page.nextCursor??undefined;}while(!teacher&&cursor&&current());
      if(current())setData(old=>({...old,uid,teacher,checked:true}));
    })().catch(e=>{if(current()){setData(old=>({...old,uid,teacher:false,checked:true}));setError(e.message);}});
    void call('getPlayerIdentity',{}).then(result=>{if(current())setData(old=>({...old,uid,identity:result.identity}));}).catch(()=>{});
    return ()=>{active=false;controller.abort();};
  },[auth.user?.uid,auth.status,revision]);
  useEffect(()=>{const update=()=>refresh();window.addEventListener('academic-identity-updated',update);window.addEventListener('focus',update);return ()=>{window.removeEventListener('academic-identity-updated',update);window.removeEventListener('focus',update);};},[]);
  const valid=data.uid===auth.user?.uid;
  return <Context.Provider value={{teacher:valid&&data.teacher,checked:auth.user?valid&&data.checked:auth.status!=='loading',identity:valid?data.identity:undefined,error:valid?error:'',refresh}}>{children}</Context.Provider>;
}
