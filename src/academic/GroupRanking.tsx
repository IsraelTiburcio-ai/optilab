import {TeacherSkeleton} from './TeacherSkeleton';
import {useEffect,useRef,useState} from 'react';
import {Crown,Medal,RefreshCw,ShieldCheck,Trophy,Users} from 'lucide-react';
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
 const current=state.identity===identity?state:null,board=current?.board,rows=board?.rows??[],podium=rows.length>=3?rows.slice(0,3):[],rest=rows.length>=3?rows.slice(3):rows,self=board?.self??null;
 return <section className="group-ranking ranking-dashboard" aria-label="Ranking de participación del grupo"><div className="ranking-heading"><div><span className="eyebrow">PARTICIPACIÓN DEL GRUPO</span><h2>Ranking de participación</h2><p>Cada actividad distinta cuenta una vez. Repetirla, acertar más o sumar puntos no cambia la posición. No es una calificación ni mide dominio.</p></div><Trophy size={34} aria-hidden="true"/></div>
 <p className="ranking-privacy"><ShieldCheck size={15}/> Solo se muestran alias opacos de estudiantes activos. La profesora no compite.</p>
 <div className="ranking-actions">{self&&<p className="ranking-self" role="status"><Crown size={16}/> Tu posición: <strong>{self.position??'—'}º</strong> de {rows.length} · {self.participation} actividades distintas</p>}<button className="button" disabled={busy||current?.loading} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15}/> Actualizar ranking</button></div>
 {teacher&&canConfigure&&board&&<button className="button ranking-config" disabled={busy} onClick={()=>void (async()=>{if(!api.current||!board)return;setBusy(true);try{await api.current('configureParticipation',{...s,enabled:!board.enabled,expectedVersion:board.controlRevision,idempotencyKey:key()});setRevision(n=>n+1);}catch(e){setState(old=>({...old,error:(e as Error).message}));}finally{setBusy(false);}})()}>{board.enabled?'Pausar ranking del grupo':'Reactivar ranking del grupo'}</button>}
 {current?.error&&<p role="alert" className="teacher-error">{current.error}</p>}{busy&&<p role="status" className="muted">Guardando la preferencia del ranking…</p>}
 {!current||current.loading?<TeacherSkeleton variant="list"/>:!board?<p className="teacher-empty">No pudimos cargar el ranking.</p>:!board.enabled?<div className="ranking-paused" role="status"><Trophy size={28}/><h3>Ranking pausado por la profesora</h3><p>La participación no se está mostrando. Tus registros de actividades se conservan; puedes volver cuando se reactive.</p></div>:!rows.length?<div className="ranking-empty" role="status"><Users size={28}/><h3>Aún no hay participación registrada</h3><p>Cuando el grupo tenga actividades abiertas registradas por el servidor, aparecerán aquí.</p></div>:<>
  {board.truncated&&<p role="alert" className="teacher-dashboard-warning">Lista parcial: hay más integrantes de los que se pudieron leer. Las posiciones no se asignan hasta recuperar el grupo completo.</p>}
  {podium.length===3&&<ol className="ranking-podium" aria-label="Primeros tres lugares">{podium.map(row=><li key={row.alias} className={`ranking-podium-${row.position}`} data-position={row.position}><span className="ranking-medal">{row.position===1?<Crown size={22}/>:row.position===2?<Medal size={22}/>:<Trophy size={22}/>}</span><strong>{row.position}º</strong><span className="ranking-alias">{row.alias}</span><span className="ranking-count">{row.participation} actividades distintas</span></li>)}</ol>}
  <div className="ranking-table-wrap"><table className="ranking-table"><caption>Ranking por actividades distintas registradas en el servidor</caption><thead><tr><th scope="col">Posición</th><th scope="col">Alias del estudiante</th><th scope="col">Actividades distintas</th></tr></thead><tbody>{rest.map(row=><tr key={row.alias} className={self?.alias===row.alias?'is-self':undefined} aria-current={self?.alias===row.alias?'true':undefined}><td data-label="Posición"><strong>{row.position??'—'}º</strong></td><td data-label="Alias">{row.alias}{self?.alias===row.alias&&<small> · tú</small>}</td><td data-label="Actividades distintas">{row.participation}</td></tr>)}</tbody></table></div>
  {self&&<p className="ranking-self-note"><Crown size={14}/> Tu fila está destacada. Solo tú puedes identificarla en esta vista.</p>}
 </>}
 <p className="ranking-footnote">El criterio es el número de actividades distintas con apertura registrada y aceptada por el servidor para este grupo. Las aperturas no son aciertos. Los empates conservan la misma posición.</p>
 </section>;
}

export function GroupRankingDisclosure({scope}:{scope:Scope}){const [open,setOpen]=useState(false);return <details className="ranking-disclosure" onToggle={e=>setOpen(e.currentTarget.open)}><summary><Trophy size={15}/> Ranking de mi grupo</summary>{open&&<GroupRanking scope={scope}/>}</details>;}
