import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {useStudentGymConfig} from '../academic/GymGameGrid';
import * as attempts from '../attempts/storage';
import {games,gyms} from '../data';
import type {Attempt} from '../attempts/model';
export function ContinueActivity(){
 const auth=useAuth(),config=useStudentGymConfig(0),uid=auth.user?.uid??'guest',[,refresh]=useState(0);
 useEffect(()=>attempts.subscribe(()=>refresh(n=>n+1)),[uid]);
 if(auth.status==='loading'||config.teacher)return null;
 let entries:Attempt[]=[];try{entries=attempts.history(uid).entries;}catch{return null;}
 const group=config.groups.find(s=>JSON.stringify([s.courseId,s.termId,s.groupId])===config.selected);
 for(const entry of [...entries].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))){
  const game=games.find(g=>g.repo===entry.activityId);
  if(entry.context&&(!group||config.loading||config.error||entry.context.courseId!==group.courseId||entry.context.termId!==group.termId||entry.context.groupId!==group.groupId))continue;
  if(game){const layout=config.gyms.find(g=>g.gymId===game.gimnasio)?.layout;if(entry.context&&(!layout||layout.hiddenOriginalGameIds.includes(game.repo)))continue;
   const url=`${game.repo==='memorama-simplex'?'/jugar':'/jugar-original'}/${game.repo}`+(entry.context?'?'+new URLSearchParams({...entry.context}).toString():'');
   return <ContinueCard title={game.nombre} gym={game.gimnasio} event={entry} url={url}/>;}
  if(!entry.context||!group||config.loading||config.error)continue;
  const activity=config.gyms.flatMap(g=>g.activities).find(a=>a.activityId===entry.activityId);if(!activity)continue;
  return <ContinueCard title={activity.title} gym={activity.gymId} event={entry} url={`/grupo/${encodeURIComponent(group.courseId)}/${encodeURIComponent(group.termId)}/${encodeURIComponent(group.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}/>;
 }
 return null;
}
function ContinueCard({title,gym,event,url}:{title:string;gym:number;event:Attempt;url:string}){
 const label=event.kind==='opened'?'Abierta':event.kind==='declared'?'Práctica declarada':'Resultado informado';
 return <section className="paper continue-activity" aria-label="Continúa donde te quedaste"><span className="eyebrow">TU SIGUIENTE PASO</span><h2>Continúa donde te quedaste</h2><p><strong>{title}</strong> · {gyms.find(g=>g.id===gym)?.name??`Gimnasio ${gym}`}</p><p className="muted">{label} · {new Date(event.observedAt).toLocaleDateString('es-MX')}</p><Link className="button primary" to={url}>Retomar actividad →</Link></section>;
}
