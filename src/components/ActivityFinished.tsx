import {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useParams} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {academicClient} from '../academic/client';
import {games} from '../data';
import {validContext} from '../attempts/model';
import {activityPath,orderedVisible} from '../activities/navigation';
export function ActivityFinished({activityId,gymId,replay}:{activityId:string;gymId:number;replay:()=>void}){
 const auth=useAuth(),ref=useRef(auth);ref.current=auth;const params=useParams(),location=useLocation(),query=new URLSearchParams(location.search);
 const candidate={courseId:params.courseId??query.get('courseId'),termId:params.termId??query.get('termId'),groupId:params.groupId??query.get('groupId')},scope=validContext(candidate)?candidate:undefined;
 const key=JSON.stringify([auth.user?.uid,scope,gymId,activityId]);const [state,setState]=useState({key:'',loading:true,next:'',error:''});
 useEffect(()=>{let active=true;const controller=new AbortController();setState({key,loading:true,next:'',error:''});
  const run=async()=>{let ids=games.filter(g=>g.gimnasio===gymId).map(g=>g.repo);
   if(scope){const uid=auth.user?.uid;if(!uid)throw Error('Inicia sesión para consultar el orden de tu clase.');const call=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);const result=await call('publishedGroupActivities',scope);const gym=result.gyms.find(g=>g.gymId===gymId);if(!gym)throw Error('No se confirmó la configuración del gimnasio.');ids=orderedVisible(gymId,gym.layout,gym.activities);}
   const index=ids.indexOf(activityId);if(active)setState({key,loading:false,next:index<0?'':ids[index+1]??'',error:''});
  };void run().catch(e=>{if(active)setState({key,loading:false,next:'',error:e.message||'No pudimos consultar la siguiente actividad.'});});return()=>{active=false;controller.abort();};
 },[key]);
 const current=state.key===key?state:null;
 return <section className="paper activity-finished" aria-label="Actividad finalizada"><h2>¡Actividad finalizada!</h2><p>Finalización informada por el juego; no es una calificación ni una victoria verificada.</p>{current?.error&&<p role="alert">{current.error}</p>}<div className="teacher-actions">{current?.loading||!current?<span role="status">Consultando la siguiente actividad…</span>:current.next?<Link className="button primary" to={activityPath(current.next,scope)}>Siguiente actividad</Link>:<p>No hay otra actividad visible a continuación.</p>}<button className="button" onClick={replay}>Volver a jugar</button><Link className="button" to={`/gimnasio/${gymId}`}>Regresar al gimnasio</Link></div></section>;
}
