import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {useAcademicAccess} from '../academic/AcademicAccess';
import {academicEnabled} from '../academic/config';
import {academicClient} from '../academic/client';
import type {PublishedActivities} from '../academic/types';
import * as attempts from '../attempts/storage';
import {games,gyms} from '../data';
import type {Attempt} from '../attempts/model';

type GroupAccess={status:'loading'|'ready'|'error';data?:PublishedActivities};
const contextKey=(context:NonNullable<Attempt['context']>)=>JSON.stringify([context.courseId,context.termId,context.groupId]);
const activityPath=(gameId:string,context?:Attempt['context'])=>{const game=games.find(item=>item.repo===gameId)!;const path=`${game.repo==='memorama-simplex'?'/jugar':'/jugar-original'}/${game.repo}`;return context?path+'?'+new URLSearchParams({...context}).toString():path;};

export function ContinueActivity(){
 const auth=useAuth(),access=useAcademicAccess(),ref=useRef(auth);ref.current=auth;
 const uid=auth.user?.uid??'guest',[,refresh]=useState(0);
 const [accessState,setAccessState]=useState<{uid:string;values:Record<string,GroupAccess>}>({uid:'',values:{}});
 const accessByGroup=accessState.uid===uid?accessState.values:{};
 useEffect(()=>attempts.subscribe(()=>refresh(value=>value+1)),[uid]);
 let entries:Attempt[]=[];let enabled=false;let readError=false;
 try{enabled=attempts.consent(uid);entries=attempts.history(uid).entries;}catch{readError=true;}
 const ordered=[...entries].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
 const contexts=[...new Set(ordered.slice(0,20).flatMap(entry=>entry.context?[contextKey(entry.context)]:[]))];
 const contextsKey=JSON.stringify(contexts);
 useEffect(()=>{
  if(!academicEnabled||!auth.user||!contexts.length){setAccessState({uid,values:{}});return;}
  const controller=new AbortController();let active=true;const id=auth.user.uid;
  setAccessState({uid,values:Object.fromEntries(contexts.map(key=>[key,{status:'loading' as const}]))});
  const api=academicClient({uid:id,getIdToken:value=>ref.current.getIdToken(value),current:()=>active&&ref.current.isCurrentSession(id)},controller.signal);
  void Promise.all(contexts.map(async key=>{
   const [courseId,termId,groupId]=JSON.parse(key) as [string,string,string];
   try{const data=await api('publishedGroupActivities',{courseId,termId,groupId});return [key,{status:'ready' as const,data}] as const;}
   catch{return [key,{status:'error' as const}] as const;}
  })).then(results=>{if(active)setAccessState({uid,values:Object.fromEntries(results)});});
  return()=>{active=false;controller.abort();};
 },[auth.user?.uid,contextsKey]);
 if(auth.status==='loading')return null;
 if(access.teacher)return null;
 if(readError)return <ContinueEmpty title="No pudimos leer tu historial" text="Revisa y exporta tus datos locales desde Cuenta. No mostraremos una actividad que no podamos confirmar." action="Revisar historial" to="/cuenta" error/>;
 if(!enabled)return <ContinueEmpty title="Activa tu historial" text="Para recordar tu última actividad y ofrecerte un enlace válido, activa el historial de intentos en este navegador." action="Revisar historial" to="/cuenta"/>;
 if(!ordered.length)return <ContinueEmpty title="Aún no hay una actividad guardada" text="Explora un gimnasio o abre una actividad de clase. Cuando haya una actividad real en tu historial, aparecerá aquí." action="Explorar gimnasios" to="/mapa"/>;
 let needsVerification=false, verificationFailed=false;
 for(const entry of ordered.slice(0,50)){
  const game=games.find(item=>item.repo===entry.activityId);
  if(game){
   if(!entry.context)return <ContinueCard title={game.nombre} gym={game.gimnasio} event={entry} url={activityPath(game.repo)}/>;
   if(!auth.user||!academicEnabled)continue;
   const accessRow=accessByGroup[contextKey(entry.context)];
   if(!accessRow||accessRow.status==='loading'){needsVerification=true;continue;}
   if(accessRow.status==='error'){verificationFailed=true;continue;}
   const layout=accessRow.data?.gyms.find(item=>item.gymId===game.gimnasio)?.layout;
   if(!layout||layout.hiddenOriginalGameIds.includes(game.repo))continue;
   return <ContinueCard title={game.nombre} gym={game.gimnasio} event={entry} url={activityPath(game.repo,entry.context)}/>;
  }
  if(!entry.context||!auth.user||!academicEnabled)continue;
  const accessRow=accessByGroup[contextKey(entry.context)];
  if(!accessRow||accessRow.status==='loading'){needsVerification=true;continue;}
  if(accessRow.status==='error'){verificationFailed=true;continue;}
  const activity=accessRow.data?.gyms.flatMap(gym=>gym.activities).find(item=>item.activityId===entry.activityId);
  if(!activity)continue;
  return <ContinueCard title={activity.title} gym={activity.gymId} event={entry} url={`/grupo/${encodeURIComponent(entry.context.courseId)}/${encodeURIComponent(entry.context.termId)}/${encodeURIComponent(entry.context.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}/>;
 }
 if(needsVerification)return <ContinuePending/>;
 if(verificationFailed)return <ContinueEmpty title="No pudimos verificar tu última actividad" text="El historial sigue guardado, pero tu grupo o la actividad ya no están disponibles. Puedes elegir otra actividad." action="Explorar gimnasios" to="/mapa"/>;
 return <ContinueEmpty title="Tu última actividad ya no está visible" text="La actividad fue ocultada, archivada o ya no pertenece a tus grupos. Elige otra desde el mapa." action="Explorar gimnasios" to="/mapa"/>;
}

function ContinueCard({title,gym,event,url}:{title:string;gym:number;event:Attempt;url:string}){
 const label=event.kind==='opened'?'Abierta':event.kind==='declared'?'Práctica declarada':'Resultado informado';
 return <section className="paper continue-activity" aria-label="Continúa donde te quedaste"><span className="eyebrow">TU SIGUIENTE PASO</span><h2>Continúa donde te quedaste</h2><p><strong>{title}</strong> · {gyms.find(item=>item.id===gym)?.name??`Gimnasio ${gym}`}</p><p className="muted">{label} · {new Date(event.observedAt).toLocaleDateString('es-MX')}</p><Link className="button primary" to={url}>Continuar jugando →</Link></section>;
}
function ContinueEmpty({title,text,action,to,error=false}:{title:string;text:string;action:string;to:string;error?:boolean}){
 return <section className="paper continue-activity continue-empty" aria-label="Continúa donde te quedaste"><span className="eyebrow">TU SIGUIENTE PASO</span><h2>Continúa donde te quedaste</h2><p>{title}.</p>{error?<p role="alert">{text}</p>:<p className="muted">{text}</p>}<Link className="button" to={to}>{action}</Link></section>;
}
function ContinuePending(){
 return <section className="paper continue-activity continue-loading" aria-label="Continúa donde te quedaste" aria-busy="true"><span className="eyebrow">TU SIGUIENTE PASO</span><h2>Continúa donde te quedaste</h2><p role="status">Verificando tu última actividad y su acceso al grupo…</p></section>;
}
