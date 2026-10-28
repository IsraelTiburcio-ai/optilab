import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowUpRight,Compass,Shield} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {gyms} from '../data';
import {GameArena} from '../components/GameArena';
import {publicActivity,providerName} from '../activities/catalog';
import {iframePolicy} from '../activities/urls';
import {observedCompletion} from '../activities/messages';
import type {ExternalActivity,PublicActivityPlacement,ActivityObservation} from '../activities/types';
import './GamePlayer.css';
import '../activities/external.css';
export default function ExternalActivityPlayer(){
  const {activityId}=useParams(),auth=useAuth(),entry=useMemo(()=>publicActivity(activityId??''),[activityId]);
  if(!entry)return <section className="paper"><h1>Esta actividad no está disponible</h1><p>Este reproductor solo abre las actividades públicas del catálogo de OptiLab.</p><Link className="button" to="/mapa">Volver a los gimnasios</Link></section>;
  if(auth.status==='loading')return <p role="status">Preparando la sesión antes de abrir la actividad…</p>;
  return <ExternalSession key={`${entry.activity.activityId}/${auth.user?.uid??'guest'}`} {...entry}/>;
}
function ExternalSession({activity,placement}:{activity:ExternalActivity;placement:PublicActivityPlacement}){
  const gym=gyms.find(g=>g.id===placement.gymId)!,frame=useRef<HTMLIFrameElement>(null);
  const [sessionId]=useState(()=>crypto.randomUUID()),[openedAt]=useState(()=>new Date().toISOString());
  const [events,setEvents]=useState<ActivityObservation[]>(()=>[{type:'opened',activityId:activity.activityId,sessionId,at:openedAt}]),[phase,setPhase]=useState<'loading'|'loaded'|'slow'|'error'>('loading');
  const completion=events.find(e=>e.type==='completion-observed');
  const activeSession=useRef<string>(sessionId),observed=useRef(false);
  // The record belongs only to this mounted session; never written to personal
  // progress, academic history, rankings, storage or a fictional backend endpoint.
  useEffect(()=>{let active=true;activeSession.current=sessionId;
    const receive=(event:MessageEvent)=>{
      const node=frame.current;if(!node||observed.current)return;
      const signal=observedCompletion(event,activity,{active,sessionId,activeSessionId:activeSession.current,frameWindow:node.contentWindow,sourceUrl:node.src});
      if(signal){observed.current=true;setEvents(old=>[...old,{type:'completion-observed',activityId:activity.activityId,sessionId,at:new Date().toISOString(),signal,trust:'provider-signal-not-validated'}]);}
    };
    window.addEventListener('message',receive);
    const timer=setTimeout(()=>{if(active)setPhase(old=>old==='loading'?'slow':old);},15000);
    return ()=>{active=false;activeSession.current='';window.removeEventListener('message',receive);clearTimeout(timer);};
  },[activity,sessionId]);
  const status={loading:'Abriendo la actividad…',loaded:'Visor abierto',slow:'La actividad está tardando en aparecer',error:'No pudimos confirmar la carga del proveedor'}[phase];
  return <section className="game-player external-player" aria-label="Reproductor de actividad externa"><div className="player-navigation"><Link className="back-link" to={`/gimnasio/${gym.id}`}>← Regresar al gimnasio</Link><a className="text-button" href={activity.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir externamente <ArrowUpRight size={16}/></a></div>
    <header className="player-title"><div><span className="eyebrow">{gym.name} · {providerName[activity.provider]}</span><h1>{activity.title}</h1><p>Actividad complementaria · sin calificación académica</p></div><Compass size={44} aria-hidden="true"/></header>
    <GameArena title={activity.title} region={gym.name} returnTo={`/gimnasio/${gym.id}`} controls={<p className="player-status" role="status"><Shield size={17}/><span>{status}</span></p>}>
      <div className="player-frame-shell external-frame-shell"><iframe ref={frame} src={activity.embedUrl} title={`${activity.title} · ${providerName[activity.provider]}`} {...iframePolicy(activity.provider)}
        onLoad={()=>setPhase('loaded')} onError={()=>setPhase('error')}/></div>
    </GameArena>
    <aside className="paper external-play-state" aria-label="Estado de la actividad" data-observation-count={events.length}><h2>Tu actividad en esta sesión</h2><p role="status">Actividad abierta · registro de esta sesión.</p>
      {completion?<p role="status" className="external-observed">Finalización observada: {providerName[activity.provider]} envió una señal compatible. No demuestra puntuación perfecta ni constituye una calificación.</p>:
        <p>{activity.capabilities.completion==='unavailable'?'Esta integración no tiene una señal de resultado verificada para Wordwall. Solo se registra la apertura.':'Si LearningApps comunica una finalización compatible, se indicará aquí. Todavía no se recibió esa señal.'}</p>}
      <p>No se registra puntuación, tiempo de resolución, aciertos ni intentos. No se solicitan resultados autodeclarados ni se producen resultados académicos validados.</p>
      <small>Al ampliar o restaurar se conserva la partida. Salir de esta pantalla o recargar termina esta sesión; el proveedor decide si puede recuperar algo.</small>
    </aside>
    <section className="external-fallback" aria-labelledby="external-fallback-title"><h2 id="external-fallback-title">¿No aparece o no responde?</h2><p>Algunos navegadores o proveedores pueden impedir la incrustación. No podemos detectarlo siempre; prueba abrir la actividad directamente.</p><a className="button" href={activity.sourceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir en otra pestaña <ArrowUpRight size={18}/></a></section>
    <p className="muted">El proveedor puede usar sus propias cookies y políticas. OptiLab no añade datos personales, identificadores de cuenta, curso o grupo a sus URLs. Esta actividad pública no es una asignación privada de clase.</p>
  </section>;
}
