import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ExternalLink} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicEnabled} from './config';
import {academicClient,type AcademicCall} from './client';
import type {PublishedActivity} from './types';
import {games,type Game} from '../data';
import {GameCard} from '../components/GameCard';
import '../activities/external.css';

type Item=PublishedActivity&{courseId:string;termId:string;groupId:string};
const providerName={optilab:'OptiLab',learningapps:'LearningApps',wordwall:'Wordwall'} as const;
function ExternalCard({activity}:{activity:Item}){
  return <article className="cartridge group-activity-cartridge">
    <div className="cartridge-art"><span className="serial">ACTIVIDAD DE CLASE</span><div className="game-glyph" aria-hidden="true"><ExternalLink size={58}/></div><span className="game-region">GIMNASIO {activity.gymId}</span></div>
    <div className="cartridge-body"><span className="cartridge-provider">{providerName[activity.provider]}</span><h3>{activity.title}</h3><p>{activity.description||'Actividad complementaria asignada por tu profesora.'}</p>
      <div className="game-actions"><Link className="button play" to={`/grupo/${encodeURIComponent(activity.courseId)}/${encodeURIComponent(activity.termId)}/${encodeURIComponent(activity.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}>Abrir <ArrowRight size={17}/><span className="sr-only"> {activity.title}</span></Link></div>
      <small className="group-activity-note">Sin telemetría verificada · no otorga insignias</small>
    </div>
  </article>;
}
function GroupCards({gymId}:{gymId:number}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;
  const api=useRef<AcademicCall|null>(null),[items,setItems]=useState<Item[]>([]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;api.current=academicClient({uid:auth.user!.uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(auth.user!.uid)},controller.signal);
    void (async()=>{
      try{
        const scopes=await api.current!('myScopes',{kind:'student',limit:20});
        const collected:Item[]=[];
        for(const scope of scopes.items.filter(scope=>scope.status==='active')){
          const result=await api.current!('publishedGroupActivities',{courseId:scope.courseId,termId:scope.termId,groupId:scope.groupId});
          collected.push(...(result.gyms.find(gym=>gym.gymId===gymId)?.activities??[]).map(activity=>({...activity,courseId:scope.courseId,termId:scope.termId,groupId:scope.groupId})));
        }
        if(active)setItems(collected);
      }catch(error){if(active&&(error as {name?:string})?.name!=='AbortError')setItems([]);}
    })();
    return ()=>{active=false;controller.abort();api.current=null;};
  },[auth.user?.uid,gymId]);
  return <>{items.map(activity=><ExternalCard key={`${activity.activityId}-${activity.groupId}`} activity={activity}/>)}</>;
}
export function GymGameGrid({gymId}:{gymId:number}){
  const list:Game[]=games.filter(game=>game.gimnasio===gymId);
  const auth=useAuth();
  return <div className="game-grid">{list.map((game,index)=><GameCard key={game.repo} game={game} index={index}/>)}{academicEnabled&&auth.user&&<GroupCards gymId={gymId}/>}</div>;
}
