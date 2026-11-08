import {useIntegratedFeatures} from '../integration/features';
import {ActivityFinished} from '../components/ActivityFinished';
import {useTrackedProvider} from '../activities/useTrackedProvider';
import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowUpRight,Compass,Shield} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {gyms} from '../data';
import {GameArena} from '../components/GameArena';
import {iframePolicy} from '../activities/urls';
import {academicClient} from '../academic/client';
import {academicEnabled} from '../academic/config';
import type {PublishedActivity} from '../academic/types';
import './GamePlayer.css';
import '../activities/external.css';
const providerName={wordwall:'Wordwall',learningapps:'LearningApps'} as const;
export default function PublishedActivityPlayer({preview=false}:{preview?:boolean}){
  const [attempt,setAttempt]=useState(0);
  const {courseId,termId,groupId,activityId}=useParams(),auth=useAuth();
  if(!academicEnabled)return <section className="paper"><h1>Actividad no disponible</h1><p>Las actividades de clase no están habilitadas en este entorno.</p><Link className="button" to="/mapa">Volver a los gimnasios</Link></section>;
  if(!courseId||!termId||!groupId||!activityId)return <Unavailable/>;
  if(auth.status==='loading')return <p role="status">Preparando la sesión antes de abrir la actividad…</p>;
  if(!auth.user)return <section className="paper"><h1>Inicia sesión para abrir esta actividad</h1><Link className="button" to="/cuenta">Ir a Cuenta</Link></section>;
  return <PublishedSession key={`${preview}:${auth.user.uid}/${courseId}/${termId}/${groupId}/${activityId}/${attempt}`} uid={auth.user.uid} courseId={courseId} termId={termId} groupId={groupId} activityId={activityId} preview={preview} replay={()=>setAttempt(n=>n+1)}/>;
}
function PublishedSession({uid,courseId,termId,groupId,activityId,replay,preview}:{preview:boolean;replay:()=>void;uid:string;courseId:string;termId:string;groupId:string;activityId:string}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;
  const [activity,setActivity]=useState<PublishedActivity|null>(null),[error,setError]=useState(''),[phase,setPhase]=useState<'loading'|'loaded'|'slow'|'error'>('loading'),frame=useRef<HTMLIFrameElement>(null);
  const integrated=useIntegratedFeatures();
  const tracked=useTrackedProvider(activity,frame,preview);
  useEffect(()=>{
    const controller=new AbortController();let active=true;const api=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);
    void (preview?api('teacherPublishedGroupActivities',{courseId,termId,groupId}).then(data=>{const found=data.gyms.flatMap(g=>g.activities).find(a=>a.activityId===activityId);if(!found)throw Error('La actividad ya no está publicada.');return found;}):api('publishedActivity',{courseId,termId,groupId,activityId})).then(result=>{if(active)setActivity(result);}).catch(e=>{if(active&&e?.name!=='AbortError')setError(e.message||'La actividad no está disponible.');});
    const timer=setTimeout(()=>{if(active)setPhase(old=>old==='loading'?'slow':old);},15000);
    return ()=>{active=false;controller.abort();clearTimeout(timer);};
  },[uid,courseId,termId,groupId,activityId,preview]);
  if(error)return <section className="paper"><h1>Actividad no disponible</h1><p role="alert">{error}</p><p>Puede que ya no esté publicada, que haya sido archivada o que tu matrícula ya no esté activa.</p><Link className="button" to={`/gimnasio/3`}>Volver al mapa</Link></section>;
  if(!activity)return <p role="status">Consultando la actividad publicada…</p>;
  const gym=gyms.find(item=>item.id===activity.gymId)??gyms[2];
  const status={loading:'Abriendo la actividad…',loaded:'Visor abierto',slow:'La actividad está tardando en aparecer',error:'No pudimos confirmar la carga del proveedor'}[phase];
  return <section className="game-player external-player published-activity-player" aria-label="Actividad publicada de tu clase"><div className="player-navigation"><Link className="back-link" to={`/gimnasio/${gym.id}`}>← Regresar al gimnasio</Link><a className="text-button" onClick={tracked.onExternalOpen} href={activity.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir externamente <ArrowUpRight size={16}/></a></div>
    <header className="player-title"><div><span className="eyebrow">{gym.name} · {providerName[activity.provider]} · {preview?'Vista previa docente':'Actividad de clase'}</span><h1>{activity.title}</h1><p>{activity.instructions||'Actividad complementaria asignada por tu profesora.'}</p></div><Compass size={44} aria-hidden="true"/></header>
    {activity.embedUrl?<GameArena title={activity.title} region={gym.name} returnTo={`/gimnasio/${gym.id}`} controls={<p className="player-status" role="status"><Shield size={17}/><span>{status}</span></p>}>
      <div className="player-frame-shell external-frame-shell"><iframe ref={frame} src={activity.embedUrl} title={`${activity.title} · ${providerName[activity.provider]}`} {...iframePolicy(activity.provider)} onLoad={()=>{setPhase('loaded');tracked.onLoad();}} onError={()=>setPhase('error')}/></div>
    </GameArena>:<section className="paper external-fallback" aria-labelledby="published-fallback-title"><h2 id="published-fallback-title">Actividad externa segura</h2><p>Este recurso se abre en la página del proveedor. No ofrece una integración incrustada validada. Se abrirá en el sitio de {providerName[activity.provider]} en otra pestaña.</p><a className="button" onClick={tracked.onExternalOpen} href={activity.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir en {providerName[activity.provider]} <ArrowUpRight size={18}/></a></section>}
    {!preview&&integrated&&tracked.completed&&<ActivityFinished activityId={activityId} gymId={gym.id} replay={replay}/>}
    {!preview&&<aside className="paper external-play-state" aria-label="Estado de la actividad"><h2>Actividad de tu clase</h2><p role="status">Actividad abierta · visor de esta sesión.</p><p>Las aperturas y señales compatibles se conservan con tu consentimiento. Solo el recurso LearningApps probado puede comunicar finalización; Wordwall y otros recursos no tienen una señal habilitada. No se inventan puntuaciones ni calificaciones.</p><p className="muted">El proveedor puede usar sus propias cookies. OptiLab no añade datos personales, curso, grupo ni identificadores a la URL.</p></aside>}
    {preview&&<p className="notice">Vista previa docente: no se registra progreso ni participación.</p>}
    <section className="external-fallback" aria-labelledby="published-help-title"><h2 id="published-help-title">¿No aparece o no responde?</h2><p>Algunos navegadores o proveedores pueden impedir la incrustación. Prueba abrir la actividad directamente.</p><a className="button" onClick={tracked.onExternalOpen} href={activity.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir en otra pestaña <ArrowUpRight size={18}/></a></section>
  </section>;
}
function Unavailable(){return <section className="paper"><h1>Actividad no disponible</h1><p>El enlace no identifica una actividad válida de tu clase.</p><Link className="button" to="/mapa">Volver a los gimnasios</Link></section>;}
