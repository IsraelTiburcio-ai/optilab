import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ExternalLink} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicEnabled} from '../academic/config';
import {academicClient,type AcademicCall} from '../academic/client';
import type {PublishedActivity} from '../academic/types';
import './external.css';

type Item=PublishedActivity&{courseId:string;termId:string;groupId:string};
export function GroupActivityCards({gymId}:{gymId:number}){
  const auth=useAuth();
  if(!academicEnabled||!auth.user)return null;
  return <GroupActivitiesSession key={auth.user.uid} uid={auth.user.uid} gymId={gymId}/>;
}
function GroupActivitiesSession({uid,gymId}:{uid:string;gymId:number}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;
  const api=useRef<AcademicCall|null>(null),[items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let active=true;api.current=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);
    void (async()=>{
      try{
        const scopes=await api.current!('myScopes',{kind:'student',limit:20});
        const collected:Item[]=[];
        for(const scope of scopes.items.filter(scope=>scope.status==='active')){
          const result=await api.current!('publishedGroupActivities',{courseId:scope.courseId,termId:scope.termId,groupId:scope.groupId});
          collected.push(...(result.gyms.find(gym=>gym.gymId===gymId)?.activities??[]).map(activity=>({...activity,courseId:scope.courseId,termId:scope.termId,groupId:scope.groupId})));
        }
        if(active)setItems(collected);
      }catch(e){if(active&&(e as {name?:string})?.name!=='AbortError')setError('No se pudieron consultar las actividades de tu clase.');}
    })();
    const refresh=()=>setRevision(value=>value+1);
    window.addEventListener('focus',refresh);
    return ()=>{active=false;controller.abort();api.current=null;window.removeEventListener('focus',refresh);};
  },[uid,gymId,revision]);
  if(!items.length)return error?<p className="muted" role="status">{error}</p>:null;
  return <section className="external-gym-activities group-external-activities" aria-labelledby={`group-activities-${gymId}`}><div className="section-heading"><div><span className="eyebrow">ACTIVIDADES DE TU CLASE</span><h2 id={`group-activities-${gymId}`}>Complementos asignados por tu profesora</h2></div></div>
    <p>Estas actividades son complementarias y no forman parte de los 28 juegos ni de tus insignias. No tienen calificación validada.</p>
    <div className="external-activity-grid">{items.map(activity=><article className="paper external-activity-card" key={`${activity.gymId}/${activity.activityId}`}><span className="external-provider"><ExternalLink size={16}/>{activity.provider==='wordwall'?'Wordwall':'LearningApps'} · Actividad de clase</span><h3>{activity.title}</h3><p>{activity.description||'Actividad asignada por tu profesora.'}</p><p className="muted">Sin telemetría verificada. La apertura no demuestra finalización ni calificación.</p><Link className="button primary" to={`/grupo/${encodeURIComponent(activity.courseId)}/${encodeURIComponent(activity.termId)}/${encodeURIComponent(activity.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}>Abrir actividad <ArrowRight size={18}/></Link></article>)}</div>
  </section>;
}
