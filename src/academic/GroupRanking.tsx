import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,type AcademicCall} from './client';
import {key} from './components';
import type {Api,Scope} from './types';
import './teacher.css';
export function GroupRanking({scope,teacher=false,canConfigure=false,call:provided}:{scope:Scope;teacher?:boolean;canConfigure?:boolean;call?:AcademicCall}){
 const s={courseId:scope.courseId,termId:scope.termId,groupId:scope.groupId};
 const auth=useAuth(),ref=useRef(auth);ref.current=auth;const identity=JSON.stringify([auth.user?.uid,s]);
 const [state,setState]=useState<{identity:string;board:Api['groupRanking']['output']|null;loading:boolean;error:string}>({identity:'',board:null,loading:true,error:''}),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
 const api=useRef<AcademicCall|null>(null);
 useEffect(()=>{const uid=auth.user?.uid;if(!uid)return;let active=true;const controller=new AbortController();api.current=provided??academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);setState({identity,board:null,loading:true,error:''});
  void api.current('groupRanking',s,controller.signal).then(board=>{if(active)setState({identity,board,loading:false,error:''});}).catch(e=>{if(active&&e.name!=='AbortError')setState({identity,board:null,loading:false,error:e.message});});
  return()=>{active=false;controller.abort();api.current=null;};
 },[identity,revision,teacher,provided]);
 const current=state.identity===identity?state:null;
 return <section className="paper group-ranking" aria-label="Ranking de participación del grupo"><h2>Participación del grupo</h2><p>Clasificación por actividades distintas con apertura informada por el cliente, sincronizada y aceptada por el servidor para este grupo. Una actividad cuenta una vez; repetirla, sus puntos o sus aciertos no suman posiciones. No mide dominio ni es una calificación.</p>
 {teacher&&canConfigure&&current?.board&&<button className="button" disabled={busy} onClick={()=>void (async()=>{if(!api.current||!current.board)return;setBusy(true);try{await api.current('configureParticipation',{...s,enabled:!current.board.enabled,expectedVersion:current.board.controlRevision,idempotencyKey:key()});setRevision(n=>n+1);}catch(e){setState(s=>({...s,error:(e as Error).message}));}finally{setBusy(false);}})()}>{current.board.enabled?'Pausar participación del grupo':'Habilitar participación para este grupo'}</button>}
 {!current?.board?.enabled&&<p role="status">La participación está deshabilitada para este grupo.</p>}
 <p className="muted">La sincronización de aventura e historial requiere consentimientos independientes.</p>
 {busy&&<p role="status">Confirmando el cambio de participación con el servidor…</p>}
 {current?.error&&<p role="alert">{current.error}</p>}<button className="button" disabled={busy||current?.loading} onClick={()=>setRevision(n=>n+1)}>Actualizar participación</button>
 {!current||current.loading?<p role="status">Consultando participación autorizada…</p>:current.board&&<>{current.board.truncated&&<p role="alert">Lista parcial: no se asignan posiciones hasta recuperar el grupo completo.</p>}<p>Los empates conservan la misma posición. Se muestran alias generados para integrantes activos del grupo.</p>{!current.board.rows.length?<p>No hay integrantes activos visibles.</p>:<ol>{current.board.rows.map(row=><li key={row.alias}><strong>{row.position??'—'}. {row.alias}</strong> · {row.participation} actividades distintas</li>)}</ol>}</>}
 </section>;
}

export function GroupRankingDisclosure({scope}:{scope:Scope}){const [open,setOpen]=useState(false);return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Ver participación del grupo</summary>{open&&<GroupRanking scope={scope}/>}</details>;}
