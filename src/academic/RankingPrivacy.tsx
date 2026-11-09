import {useEffect,useRef,useState} from 'react';
import {LockKeyhole} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,type AcademicCall} from './client';
import {invalidateRanking} from './rankingCache';
import type {RankingVisibilityMode,Scope} from './types';
import './teacher.css';

export function RankingPrivacy({scope}:{scope:Scope}){
 const auth=useAuth(),ref=useRef(auth);ref.current=auth;const [state,setState]=useState<{identity:string;mode:RankingVisibilityMode;revision:number;canUseName:boolean;canUseGamertag:boolean;loading:boolean;error:string}>({identity:'',mode:'anonymous',revision:0,canUseName:false,canUseGamertag:false,loading:true,error:''}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const api=useRef<AcademicCall|null>(null),identity=JSON.stringify([auth.user?.uid,scope]);
 useEffect(()=>{const uid=auth.user?.uid;if(!uid){setState({identity:'',mode:'anonymous',revision:0,canUseName:false,canUseGamertag:false,loading:false,error:''});return;}let active=true;const controller=new AbortController();api.current=academicClient({uid,getIdToken:value=>ref.current.getIdToken(value),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);setState(old=>({...old,identity,loading:true,error:''}));void api.current('rankingVisibility',scope,controller.signal).then(value=>{if(active)setState({identity,mode:value.mode,revision:value.revision,canUseName:value.canUseName,canUseGamertag:value.canUseGamertag,loading:false,error:''});}).catch(e=>{if(active&&e.name!=='AbortError')setState(old=>({...old,identity,loading:false,error:e.message}));});return()=>{active=false;controller.abort();api.current=null;};},[identity]);
 const current=state.identity===identity?state:null;
 async function save(){if(!api.current||!current||busy)return;setBusy(true);setNotice('');try{const result=await api.current('setRankingVisibility',{...scope,mode:current.mode,expectedVersion:current.revision,idempotencyKey:crypto.randomUUID()});setState(old=>({...old,revision:typeof result.revision==='number'?result.revision:old.revision}));invalidateRanking(scope);setNotice('Preferencia guardada. El nombre que verán tus compañeros se actualizará en el ranking.');}catch(e){setState(old=>({...old,error:(e as Error).message}));}finally{setBusy(false);}}
 return <details className="ranking-privacy-settings"><summary><LockKeyhole size={15}/> Privacidad del ranking</summary><div><p>Elige cómo quieres aparecer ante tus compañeros. Es independiente de los consentimientos de historial y sincronización. Por defecto eres anónimo.</p>
  {!current||current.loading?<p role="status">Consultando tu preferencia…</p>:<>
   <label>Nombre visible en el ranking<select value={current.mode} disabled={busy} onChange={e=>setState(old=>({...old,mode:e.target.value as RankingVisibilityMode}))}><option value="anonymous">Mantenerme anónimo</option><option value="name" disabled={!current.canUseName}>Mostrar mi nombre académico</option><option value="gamertag" disabled={!current.canUseGamertag}>Mostrar mi gamertag</option></select></label>
   {current.error&&<p role="alert" className="teacher-error">{current.error}</p>}
   <button className="button" disabled={busy||!current} onClick={()=>void save()}>{busy?'Guardando…':'Guardar preferencia'}</button>{notice&&<p role="status" className="muted">{notice}</p>}
  </>}
 </div></details>;
}
