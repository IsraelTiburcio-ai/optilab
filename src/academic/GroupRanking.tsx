import {TeacherSkeleton} from './TeacherSkeleton';
import {useEffect,useRef,useState} from 'react';
import {Crown,Medal,RefreshCw,ShieldCheck,Trophy,Users} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,type AcademicCall} from './client';
import {key} from './components';
import {invalidateRanking,readRankingCache,writeRankingCache,type RankingBoard} from './rankingCache';
import type {Api,Scope} from './types';
import './teacher.css';

export function useGroupRanking(scope:Scope|null,provided?:AcademicCall,refreshToken=0){
 const auth=useAuth(),ref=useRef(auth);ref.current=auth;
 const [identity,setIdentity]=useState(''),[state,setState]=useState<{board:RankingBoard|null;loading:boolean;error:string}>({board:null,loading:!!scope,error:''}),[local,setLocal]=useState(0);
 const api=useRef<AcademicCall|null>(null);
 useEffect(()=>{
  const uid=auth.user?.uid;
  if(!scope||!uid){setIdentity('');setState({board:null,loading:false,error:''});api.current=null;return;}
  const next=JSON.stringify([uid,scope]),cached=refreshToken===0&&local===0?readRankingCache(uid,scope):null;
  setIdentity(next);const controller=new AbortController();let active=true;api.current=provided??academicClient({uid,getIdToken:value=>ref.current.getIdToken(value),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);
  if(cached){setState({board:cached,loading:false,error:''});return()=>{active=false;controller.abort();api.current=null;};}
  setState({board:null,loading:true,error:''});
  void api.current('groupRanking',scope,controller.signal).then(board=>{if(!active)return;writeRankingCache(uid,scope,board);setState({board,loading:false,error:''});}).catch(error=>{if(active&&error.name!=='AbortError')setState({board:null,loading:false,error:error.message});});
  return()=>{active=false;controller.abort();api.current=null;};
 },[scope?.courseId,scope?.termId,scope?.groupId,auth.user?.uid,provided,refreshToken,local]);
 return {identity,scope,board:state.board,loading:state.loading,error:state.error,call:api,reload:()=>setLocal(n=>n+1)};
}

export function GroupRanking({scope,teacher=false,canConfigure=false,call:provided}:{scope:Scope;teacher?:boolean;canConfigure?:boolean;call?:AcademicCall}){
 const s={courseId:scope.courseId,termId:scope.termId,groupId:scope.groupId};
 const auth=useAuth(),currentIdentity=JSON.stringify([auth.user?.uid,s]);
 const ranking=useGroupRanking(s,provided),{board:rawBoard,loading:rawLoading,error,call,reload}=ranking;
 const board=ranking.identity===currentIdentity?rawBoard:null,loading=rawLoading||ranking.identity!==currentIdentity;
 const [busy,setBusy]=useState(false),[configError,setConfigError]=useState('');
 const rows=board?.rows??[],podium=rows.length>=3?rows.slice(0,3):[],rest=rows.length>=3?rows.slice(3):[],self=board?.self??null;
 async function configure(){if(!call.current||!board)return;setBusy(true);setConfigError('');try{await call.current('configureParticipation',{...s,enabled:!board.enabled,expectedVersion:board.controlRevision,idempotencyKey:key()});invalidateRanking(s);reload();}catch(e){setConfigError((e as Error).message||'No se pudo cambiar el estado del ranking.');}finally{setBusy(false);}}
 return <section className="group-ranking ranking-dashboard" aria-label="Ranking de participación del grupo"><div className="ranking-heading"><div><span className="eyebrow">PARTICIPACIÓN DEL GRUPO</span><h2>Ranking de participación</h2><p>{board?.groupTitle||'Tu grupo'} · Cada actividad distinta cuenta una vez. Este ranking muestra participación, no calificaciones.</p></div><Trophy size={34} aria-hidden="true"/></div>
 <p className="ranking-privacy"><ShieldCheck size={15}/> Solo se muestran participantes autorizados de este grupo. La profesora no compite.</p>
 <details className="ranking-help"><summary>¿Cómo funciona?</summary><p>La posición se calcula con actividades distintas que tienen apertura registrada y aceptada por el servidor para este grupo. Repetir una actividad no la suma otra vez. Los empates conservan la misma posición. Las aperturas no son aciertos ni una calificación.</p></details>
 <div className="ranking-toolbar"><div className="ranking-actions">{self&&<p className="ranking-self" role="status"><Crown size={16}/> Tu posición: <strong>{self.position??'—'}º</strong> de {rows.length} · {self.participation} actividades distintas</p>}<button className="button" disabled={busy||loading} onClick={()=>reload()}><RefreshCw size={15}/> Actualizar ranking</button></div>{teacher&&canConfigure&&board&&<button className="button ranking-config" disabled={busy} onClick={()=>void configure()}>{board.enabled?'Pausar ranking del grupo':'Reactivar ranking del grupo'}</button>}</div>
 {error&&<p role="alert" className="teacher-error">{error}</p>}{configError&&<p role="alert" className="teacher-error">{configError}</p>}{busy&&<p role="status" className="muted">Guardando la preferencia del ranking…</p>}
 {loading?<TeacherSkeleton variant="list"/>:!board?<p className="teacher-empty">No pudimos cargar el ranking.</p>:!board.enabled?<div className="ranking-paused" role="status"><Trophy size={28}/><h3>El ranking de tu grupo está pausado</h3><p>La profesora lo pausó. Tus registros se conservan y volverán a mostrarse cuando se reactive.</p></div>:!rows.length?<div className="ranking-empty" role="status"><Users size={28}/><h3>Sin participantes por ahora</h3><p>Cuando el grupo tenga actividades distintas registradas por el servidor, aparecerán aquí.</p></div>:<>
  {board.truncated&&<p role="alert" className="teacher-dashboard-warning">Lista parcial: no se asignan posiciones hasta recuperar el grupo completo.</p>}
  {rows.length<3?<ol className="ranking-mini-cards" aria-label="Participantes del ranking">{rows.map(row=><li key={row.alias} className={self?.alias===row.alias?'is-self':undefined}><span className="ranking-mini-position">{row.position??'—'}º</span><span className="ranking-mini-name">{row.displayName}{self?.alias===row.alias&&<small> · Tú</small>}</span><span className="ranking-mini-count">{row.participation} actividades distintas</span></li>)}</ol>:<>
   <ol className="ranking-podium" aria-label="Primeros tres lugares">{podium.map(row=><li key={row.alias} className={`ranking-podium-${row.position} ${self?.alias===row.alias?'is-self':''}`} data-position={row.position}><span className="ranking-medal">{row.position===1?<Crown size={22}/>:row.position===2?<Medal size={22}/>:<Trophy size={22}/>}</span><strong>{row.position}º</strong><span className="ranking-alias">{row.displayName}{self?.alias===row.alias&&<small> · Tú</small>}</span><span className="ranking-count">{row.participation} actividades distintas</span></li>)}</ol>
   {!!rest.length&&<div className="ranking-table-wrap"><table className="ranking-table"><caption>Ranking por actividades distintas registradas en el servidor</caption><thead><tr><th scope="col">Posición</th><th scope="col">Participante</th><th scope="col">Actividades distintas</th></tr></thead><tbody>{rest.map(row=><tr key={row.alias} className={self?.alias===row.alias?'is-self':undefined} aria-current={self?.alias===row.alias?'true':undefined}><td data-label="Posición"><strong>{row.position??'—'}º</strong></td><td data-label="Participante">{row.displayName}{self?.alias===row.alias&&<small> · Tú</small>}</td><td data-label="Actividades distintas">{row.participation}</td></tr>)}</tbody></table></div>}
  </>}
  {self&&<p className="ranking-self-note"><Crown size={14}/> Tu fila está destacada. Solo tú puedes identificarla en esta vista.</p>}
 </>}
 <p className="ranking-footnote">El criterio es el número de actividades distintas con apertura registrada y aceptada por el servidor para este grupo. Las aperturas no son aciertos. Los empates conservan la misma posición.</p>
 </section>;
}

export function GroupRankingDisclosure({scope}:{scope:Scope}){const [open,setOpen]=useState(false);return <details className="ranking-disclosure" onToggle={e=>setOpen(e.currentTarget.open)}><summary><Trophy size={15}/> Ranking de mi grupo</summary>{open&&<GroupRanking scope={scope}/>}</details>;}
