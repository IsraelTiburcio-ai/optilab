import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {academicClient} from './client';
import {games} from '../data';
/** Academic links enforce publication. The independent public catalog remains public. */
export function AcademicGameAccess({children}:{children:ReactNode}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;
  const params=useParams(),[query]=useSearchParams(),gameId=params.id??params.gameId??'';
  const courseId=query.get('courseId')??'',termId=query.get('termId')??'',groupId=query.get('groupId')??'';
  const scoped=!!(courseId||termId||groupId),uid=auth.user?.uid??'',identity=JSON.stringify([uid,courseId,termId,groupId,gameId]);
  const [state,setState]=useState({identity:'',status:'loading'});
  useEffect(()=>{
    if(!scoped)return;const controller=new AbortController();let active=true;
    setState({identity,status:'loading'});
    if(!uid||!courseId||!termId||!groupId){setState({identity,status:'denied'});return;}
    const api=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);
    void api('publishedGroupActivities',{courseId,termId,groupId}).then(data=>{
      const game=games.find(g=>g.repo===gameId),gym=data.gyms.find(g=>g.gymId===game?.gimnasio);
      if(active)setState({identity,status:game&&gym&&!gym.layout.hiddenOriginalGameIds.includes(gameId)?'allowed':'denied'});
    }).catch(()=>{if(active)setState({identity,status:'denied'});});
    return()=>{active=false;controller.abort();};
  },[scoped,uid,courseId,termId,groupId,gameId,identity]);
  if(!scoped)return children;
  if(state.identity!==identity||state.status==='loading')return <p role="status">Comprobando la publicación para tu grupo…</p>;
  return state.status==='allowed'?children:<section className="paper" role="alert"><h1>Actividad no disponible para este grupo</h1><p>No pudimos confirmar tu acceso o esta actividad está oculta.</p><Link to="/mapa" className="button">Volver a mis gimnasios</Link></section>;
}
